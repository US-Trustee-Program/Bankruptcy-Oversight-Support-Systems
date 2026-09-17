#!/usr/bin/env node
/**
 * Audits every NOTIFICATION_ROUTING record's recipientAddresses for domains that
 * cannot accept mail (no MX, A, or AAAA record). Read-only -- this script never
 * writes to the database.
 *
 * Background: GitHub issue #2766 (US-Trustee-Program/Bankruptcy-Oversight-Support-Systems)
 * found NOTIFICATION_ROUTING records with recipient addresses at the wrong domain
 * (@UST.DOJ.GOV instead of @usdoj.gov). The address was syntactically valid, so
 * ACS accepted the send and the message was silently never delivered -- no error,
 * no bounce, no alert. New or edited records are validated at save time by the
 * CAMS admin API (NotificationRoutingController, see
 * backend/lib/controllers/admin/notification-routing.controller.ts), but a
 * record saved before that validation existed -- or never edited since -- is
 * never re-checked just because the admin panel is used to edit a different
 * record. This script finds those.
 *
 * Usage:
 *   1. cd into this directory and run: npm install
 *   2. Run:
 *        MONGO_CONNECTION_STRING="<your Cosmos Mongo API connection string>" \
 *        COSMOS_DATABASE_NAME="<your Cosmos database name>" \
 *        node audit-notification-routing-domains.mjs
 *
 *      These are the same two environment variables CAMS itself uses to
 *      connect to Cosmos DB (see
 *      backend/lib/configs/application-configuration.ts) -- reuse the values
 *      your deployment already has configured (Key Vault / App Service
 *      settings) rather than creating new ones.
 *
 * This script only reads the `notification-routing` collection. It does not
 * modify, insert, or delete anything. Flagged addresses must be corrected by
 * hand through the existing "Notification Routing" admin panel, which is
 * where the same domain check runs and is enforced going forward.
 *
 * Exit code: 0 if every address is clean, 1 if anything was flagged (including
 * a connection/config failure).
 */

import { MongoClient } from 'mongodb';
import { Resolver } from 'node:dns/promises';

// Deliberately more generous than the 3s timeout used by the app's own
// DnsDomainVerificationGateway (backend/lib/adapters/gateways/dns/dns-domain-verification.gateway.ts):
// that gateway runs inside the Azure Function App's own network, but this script may run from an
// arbitrary customer network (corporate proxy, VPN-forced DNS, etc.) where legitimate resolution
// can take longer. A too-tight timeout here would misreport valid domains as indeterminate.
const DNS_LOOKUP_TIMEOUT_MS = 8_000;
const COLLECTION_NAME = 'notification-routing';

function withTimeout(promise, ms, cancel) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      cancel();
      reject(Object.assign(new Error('DNS lookup timed out'), { code: 'ETIMEOUT' }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve(value);
        }
      },
      (error) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    );
  });
}

function isDomainNotFoundError(error) {
  return error?.code === 'ENOTFOUND' || error?.code === 'ENODATA';
}

async function check(domain, method) {
  const resolver = new Resolver();
  try {
    const records = await withTimeout(resolver[method](domain), DNS_LOOKUP_TIMEOUT_MS, () =>
      resolver.cancel(),
    );
    return records.length > 0 ? 'valid' : 'not-found';
  } catch (error) {
    return isDomainNotFoundError(error) ? 'not-found' : 'indeterminate';
  }
}

// Mirrors backend/lib/adapters/gateways/dns/dns-domain-verification.gateway.ts's
// verifyMailDomain exactly, so a domain this script flags is a domain the live
// admin API would also reject (and vice versa). Keep the two in sync if that
// file's logic ever changes.
async function verifyMailDomain(domain) {
  const mxResult = await check(domain, 'resolveMx');
  if (mxResult === 'valid') return 'valid';

  const aResult = await check(domain, 'resolve');
  if (aResult === 'valid') return 'valid';

  const aaaaResult = await check(domain, 'resolve6');
  if (aaaaResult === 'valid') return 'valid';

  const allConfirmedAbsent =
    mxResult === 'not-found' && aResult === 'not-found' && aaaaResult === 'not-found';
  return allConfirmedAbsent ? 'not-found' : 'indeterminate';
}

function addressesFor(doc) {
  if (doc.recipientAddresses?.length) return doc.recipientAddresses;
  if (doc.recipientAddress) return [doc.recipientAddress];
  return [];
}

function domainOf(address) {
  return address.slice(address.lastIndexOf('@') + 1).toLowerCase();
}

async function main() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const databaseName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !databaseName) {
    console.error(
      'Missing required environment variables. Set MONGO_CONNECTION_STRING and ' +
        'COSMOS_DATABASE_NAME (the same values CAMS itself uses) and try again.',
    );
    process.exitCode = 1;
    return;
  }

  const client = new MongoClient(connectionString);
  let flaggedCount = 0;
  let checkedAddressCount = 0;

  try {
    await client.connect();
    const collection = client.db(databaseName).collection(COLLECTION_NAME);
    const records = await collection.find({ documentType: 'NOTIFICATION_ROUTING' }).toArray();

    if (records.length === 0) {
      console.log(`No NOTIFICATION_ROUTING records found in collection '${COLLECTION_NAME}'.`);
      return;
    }

    // Resolve each unique domain once, not once per address -- same reasoning as
    // NotificationRoutingController.validateAndCollectDomainWarnings.
    const allDomains = new Set();
    for (const record of records) {
      for (const address of addressesFor(record)) {
        allDomains.add(domainOf(address));
      }
    }
    const domainResults = new Map(
      await Promise.all(
        Array.from(allDomains).map(async (domain) => [domain, await verifyMailDomain(domain)]),
      ),
    );

    console.log(
      `Checked ${allDomains.size} distinct domain(s) across ${records.length} routing record(s).\n`,
    );

    for (const record of records) {
      const addresses = addressesFor(record);
      const lines = [];
      for (const address of addresses) {
        checkedAddressCount++;
        const domain = domainOf(address);
        const dnsResult = domainResults.get(domain);
        const flags = [];
        if (dnsResult === 'not-found') flags.push('NO MX/A/AAAA RECORD -- cannot accept mail');
        if (dnsResult === 'indeterminate') {
          flags.push('DNS lookup indeterminate -- could not confirm either way');
        }

        if (flags.length > 0) {
          flaggedCount++;
          lines.push(`    FLAGGED  ${address}  (${flags.join('; ')})`);
        } else {
          lines.push(`    ok       ${address}`);
        }
      }

      console.log(
        `${record.displayName ?? record.id} [${record.id}] covers: ${(record.covers ?? []).join(', ')}`,
      );
      if (lines.length === 0) {
        console.log('    (no recipient addresses configured)');
      } else {
        console.log(lines.join('\n'));
      }
      console.log('');
    }

    console.log(
      `Summary: ${flaggedCount} of ${checkedAddressCount} address(es) flagged for review.`,
    );
    process.exitCode = flaggedCount > 0 ? 1 : 0;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Audit script failed:', error);
  process.exitCode = 1;
});
