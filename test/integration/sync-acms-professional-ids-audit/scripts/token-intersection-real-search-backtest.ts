/**
 * Backtest for cams-e75yv: re-runs the token-intersection idea using the REAL phoneticTokens
 * containment logic searchTrusteesByNameScored's Mongo aggregation relies on
 * (trustees.mongo.repository.ts:301 - doc('phoneticTokens').contains(allTokens) pre-filter,
 * combinePhoneticTokens/generateStructuredQueryTokens from phonetic-helper.ts) - NOT the plain
 * substring proxy the original experiment (token-intersection-experiment.ts) used.
 *
 * This still does not require a live Mongo instance: phoneticTokens is a precomputed field
 * already stored on every Trustee document (see the 2026-08-18-trustees.json fixture), and
 * generateAllTokensForWords/generateStructuredQueryTokens are pure functions - this backtest
 * calls them directly and does the containment check in-process, faithfully reproducing the
 * CANDIDATE SET the real query would return (the contains() pre-filter), though not the exact
 * matchScore-based ranking within that set (which executes as a Mongo aggregation $function this
 * backtest cannot run without a live instance - ranking doesn't affect which trustees intersect,
 * only what order they'd come back in from a live query).
 *
 * Usage: npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/token-intersection-real-search-backtest.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateNameScore,
  tokenizeNameForIntersection,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import {
  generateStructuredQueryTokens,
  combinePhoneticTokens,
} from '../../../../backend/lib/adapters/utils/phonetic-helper';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const NAME_THRESHOLD = 85;

type DecodedVariant = {
  firstName: string;
  middleName: string;
  lastName: string;
  generation: string;
  address1: string;
  address2: string;
  address3: string;
  cityStateZipCountry: string;
  phone: string;
  fax: string;
  email: string;
};

function stripMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, '_id'> {
  const { _id, ...rest } = doc;
  return rest;
}

function loadProfessionalIds(): TrusteeProfessionalId[] {
  const file = path.join(FIXTURES_DIR, '2026-08-26-trustee-professional-ids.json');
  const raw: (TrusteeProfessionalId & { _id?: unknown })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  return raw.map(stripMongoId);
}

function loadTrustees(): (Trustee & { phoneticTokens?: string[] })[] {
  const file = path.join(FIXTURES_DIR, '2026-08-18-trustees.json');
  const raw: (Trustee & { _id?: unknown; phoneticTokens?: string[] })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  return raw.map((doc) => stripMongoId(doc) as Trustee & { phoneticTokens?: string[] });
}

function toAcmsTrusteeParty(variant: DecodedVariant): DxtrTrusteeParty {
  const fullName = [variant.firstName, variant.middleName, variant.lastName]
    .filter(Boolean)
    .join(' ');
  return {
    fullName,
    firstName: variant.firstName || undefined,
    middleName: variant.middleName || undefined,
    lastName: variant.lastName || undefined,
    generation: variant.generation || undefined,
    legacy: {
      address1: variant.address1 || undefined,
      address2: variant.address2 || undefined,
      address3: variant.address3 || undefined,
      cityStateZipCountry: variant.cityStateZipCountry || undefined,
      phone: variant.phone || undefined,
      fax: variant.fax || undefined,
      email: variant.email || undefined,
    },
  };
}

/**
 * Faithful in-process reproduction of searchTrusteesByNameScored's candidate-set pre-filter
 * (the phoneticTokens.contains(allTokens) match stage) - NOT its matchScore ranking, which
 * executes as a live Mongo aggregation this backtest cannot run offline. A trustee is a candidate
 * for `token` if ANY of the query's combined phonetic/bigram tokens for that single word appear in
 * the trustee's own precomputed phoneticTokens array - mirroring Mongo's array $in-style contains
 * semantics for a single-element "search string".
 */
function searchTrusteesByNameScoredOffline(
  token: string,
  trustees: (Trustee & { phoneticTokens?: string[] })[],
): Trustee[] {
  const structured = generateStructuredQueryTokens(token);
  const queryTokens = new Set(combinePhoneticTokens(structured));
  if (queryTokens.size === 0) return [];

  return trustees.filter((t) => {
    const trusteeTokens = t.phoneticTokens ?? [];
    return trusteeTokens.some((tt) => queryTokens.has(tt));
  });
}

function run() {
  const records = loadProfessionalIds();
  const trustees = loadTrustees();

  const placeholderPattern = /\bno trustee\b/i;
  const errored = records.filter((r) => r.error && r.variant);

  const noNameCandidateRecords: { acmsFullName: string; acmsProfessionalId: string }[] = [];
  for (const record of errored) {
    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsTrustee = toAcmsTrusteeParty(decoded);
    if (placeholderPattern.test(acmsTrustee.fullName)) continue;

    let qualifies = false;
    for (const trustee of trustees) {
      if (calculateNameScore(acmsTrustee, trustee) >= NAME_THRESHOLD) {
        qualifies = true;
        break;
      }
    }
    if (!qualifies) {
      noNameCandidateRecords.push({
        acmsFullName: acmsTrustee.fullName,
        acmsProfessionalId: record.acmsProfessionalId,
      });
    }
  }

  console.log(`no-name-candidate population (excluding placeholders): ${noNameCandidateRecords.length}\n`);

  type Result = {
    acmsFullName: string;
    acmsProfessionalId: string;
    tokens: string[];
    intersection: Trustee[];
  };
  const results: Result[] = [];

  for (const { acmsFullName, acmsProfessionalId } of noNameCandidateRecords) {
    const tokens = tokenizeNameForIntersection(acmsFullName);
    if (tokens.length < 2) continue;

    let candidateSet: Map<string, Trustee> | null = null;
    for (const token of tokens) {
      const matches = searchTrusteesByNameScoredOffline(token, trustees);
      const matchesById = new Map(matches.map((t) => [t.trusteeId, t]));
      if (candidateSet === null) {
        candidateSet = matchesById;
      } else {
        for (const id of candidateSet.keys()) {
          if (!matchesById.has(id)) candidateSet.delete(id);
        }
      }
      if (candidateSet.size === 0) break;
    }

    const intersection = candidateSet ? [...candidateSet.values()] : [];
    results.push({ acmsFullName, acmsProfessionalId, tokens, intersection });
  }

  console.log(`Records with >=2 usable tokens, intersection attempted: ${results.length}\n`);

  const bySize = new Map<number, number>();
  for (const r of results) {
    const n = r.intersection.length;
    bySize.set(n, (bySize.get(n) ?? 0) + 1);
  }
  console.log('Intersection result-set size distribution (REAL phoneticTokens containment):');
  for (const [size, count] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${size.toString().padStart(3)} candidate(s): ${count} records`);
  }
  console.log();

  const exactlyOne = results.filter((r) => r.intersection.length === 1);
  console.log(`=== Exactly one candidate: ${exactlyOne.length} ===\n`);
  for (const r of exactlyOne.slice(0, 40)) {
    console.log(
      `  "${r.acmsFullName}" (${r.acmsProfessionalId}) tokens=[${r.tokens.join(', ')}] -> "${r.intersection[0].name}" (${r.intersection[0].trusteeId})`,
    );
  }
  if (exactlyOne.length > 40) console.log(`  ... and ${exactlyOne.length - 40} more`);
}

run();
