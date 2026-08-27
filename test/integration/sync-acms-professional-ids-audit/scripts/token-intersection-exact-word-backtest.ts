/**
 * Second attempt: re-runs token-intersection using EXACT-WORD
 * substring containment against trustee.name (the same case-insensitive regex approach
 * TrusteesMongoRepository.searchTrusteesByName already uses - trustees.mongo.repository.ts:269)
 * instead of searchTrusteesByNameScored's phonetic/bigram pre-filter, which the first real-search
 * backtest (token-intersection-real-search-backtest.ts) found was far too broad to narrow
 * anything (most records intersected to hundreds/thousands of candidates; the rare
 * exactly-one-candidate hits were false positives).
 *
 * Token length floor lowered to >=2 per Brian's direction (was >=3 in the phonetic-search
 * attempt and the original substring-proxy experiment) - exact-word containment doesn't have the
 * same "single initial matches everything" problem a phonetic/bigram token does, since a 2-letter
 * token like "jo" only matches trustees whose NAME TEXT literally contains "jo" as a substring,
 * not any trustee sharing a phonetic code.
 *
 * Usage: npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/token-intersection-exact-word-backtest.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateNameScore,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const NAME_THRESHOLD = 85;
const MIN_TOKEN_LENGTH = 2;

const STOPWORDS = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'tr', 'trustee', 'inc', 'esq', 'not', 'use', 'do',
]);

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

function loadTrustees(): Trustee[] {
  const file = path.join(FIXTURES_DIR, '2026-08-18-trustees.json');
  const raw: (Trustee & { _id?: unknown })[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return raw.map((doc) => stripMongoId(doc) as Trustee);
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

function tokenize(fullName: string): string[] {
  const raw = fullName
    .toLowerCase()
    .replace(/[.,()/*]/g, ' ')
    .replace(/[-']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(raw)].filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t));
}

/**
 * Faithful reproduction of TrusteesMongoRepository.searchTrusteesByName - case-insensitive
 * substring match against trustee.name, same regex approach (escapeRegex + RegExp(..., 'i')).
 */
function searchTrusteesByNameExact(token: string, trustees: Trustee[]): Trustee[] {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'i');
  return trustees.filter((t) => pattern.test(t.name));
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
    const tokens = tokenize(acmsFullName);
    if (tokens.length < 2) continue;

    let candidateSet: Map<string, Trustee> | null = null;
    for (const token of tokens) {
      const matches = searchTrusteesByNameExact(token, trustees);
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
  console.log('Intersection result-set size distribution (EXACT-WORD containment):');
  for (const [size, count] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
    if (size <= 10 || count > 3) {
      console.log(`  ${size.toString().padStart(4)} candidate(s): ${count} records`);
    }
  }
  const over10 = [...bySize.entries()].filter(([size]) => size > 10);
  const over10Total = over10.reduce((sum, [, count]) => sum + count, 0);
  console.log(`  (${over10Total} records total with >10 candidates)`);
  console.log();

  const exactlyOne = results.filter((r) => r.intersection.length === 1);
  console.log(`=== Exactly one candidate: ${exactlyOne.length} ===\n`);
  for (const r of exactlyOne.slice(0, 60)) {
    console.log(
      `  "${r.acmsFullName}" (${r.acmsProfessionalId}) tokens=[${r.tokens.join(', ')}] -> "${r.intersection[0].name}" (${r.intersection[0].trusteeId})`,
    );
  }
  if (exactlyOne.length > 60) console.log(`  ... and ${exactlyOne.length - 60} more`);

  const smallSet = results.filter((r) => r.intersection.length >= 2 && r.intersection.length <= 4);
  console.log(`\n=== 2-4 candidates: ${smallSet.length} ===\n`);
  for (const r of smallSet.slice(0, 20)) {
    const names = r.intersection.map((t) => t.name).join(' | ');
    console.log(`  "${r.acmsFullName}" (${r.acmsProfessionalId}) -> ${names}`);
  }
  if (smallSet.length > 20) console.log(`  ... and ${smallSet.length - 20} more`);
}

run();
