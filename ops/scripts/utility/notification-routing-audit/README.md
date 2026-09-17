# Notification Routing Domain Audit

Standalone, read-only script that checks every recipient email address stored in the
`notification-routing` Cosmos DB collection for one thing: does the domain have an MX, A, or AAAA
record (i.e. can it accept mail at all)? A domain with none of the three is flagged as
`NO MX/A/AAAA RECORD`.

## Why this exists

GitHub issue #2766 found that some `NOTIFICATION_ROUTING` records had recipient addresses at the
wrong domain (`@UST.DOJ.GOV` instead of `@usdoj.gov`). The address was syntactically valid, so the
email service accepted the send and the message was silently never delivered -- no error, no bounce,
no alert.

CAMS's admin API validates a record's domains at the moment that record is edited and saved (see
`backend/lib/controllers/admin/notification-routing.controller.ts`), but a record saved before that
validation existed -- or never edited since -- is never re-checked just because someone edits a
_different_ routing record through the admin panel. This script finds records in that state.

## Requirements

- Node.js 18 or newer.
- Network access from wherever you run this to both your Cosmos DB account and to the public DNS
  resolvers your machine/network normally uses (the domain checks use standard DNS lookups, not a
  call back to CAMS or to any Flexion-operated service).

## Usage

```bash
cd ops/scripts/utility/notification-routing-audit
npm install
MONGO_CONNECTION_STRING="<your Cosmos Mongo API connection string>" \
COSMOS_DATABASE_NAME="<your Cosmos database name>" \
node audit-notification-routing-domains.mjs
```

`MONGO_CONNECTION_STRING` and `COSMOS_DATABASE_NAME` are the same two environment variables CAMS
itself uses to connect to Cosmos DB. Reuse the values already configured for your deployment (Key
Vault / App Service settings) rather than creating new ones.

## What it does NOT do

- It does not modify, insert, or delete any document. It only issues a `find` against the
  `notification-routing` collection.
- It does not fix anything automatically. Flagged addresses must be corrected by hand through the
  existing "Notification Routing" admin panel in CAMS, which is where this same domain check runs
  and is enforced going forward.
- It does not confirm the mailbox itself exists, only that the domain can accept mail in principle
  (has an MX, A, or AAAA record). A domain that resolves but has no mailbox for that specific
  address will not be flagged.

## Exit code

`0` if every address is clean. `1` if anything was flagged, or if the script could not connect
(missing/invalid environment variables, network failure).
