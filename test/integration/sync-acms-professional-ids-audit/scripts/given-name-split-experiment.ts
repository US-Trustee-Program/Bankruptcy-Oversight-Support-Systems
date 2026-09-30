/**
 * Experiment (NOT a harness, not committed to any pipeline): does re-deriving firstName/middleName
 * from the JOINED name text beat the current two-splitter arrangement?
 *
 * The pipeline splits a compound given name with two different functions - splitCompoundFirstName
 * for the ACMS side, splitCamsInitialPlusGivenName for the CAMS side - and each stops splitting
 * once its own side already carries a middle name. normalizeNamePart then strips whitespace along
 * with punctuation, so an unsplit compound collapses into a single glued token ("C. DAVID" + "L"
 * -> first "cdavid", middle "l", while the same name on the other side becomes first "c", middle
 * "david"). The same person compares as a first-name mismatch.
 *
 * Three strategies are scored over every staging record that has a winning match, against the
 * trustee staging actually chose:
 *
 *   current   - the two splitters exactly as the pipeline runs them today.
 *   joined    - concatenate firstName + middleName, convert punctuation to spaces, split on
 *               whitespace: first token is the first name, the remainder is the middle. Identical
 *               treatment on both sides, so the field boundary cannot differ.
 *   tokenSet  - ignore position entirely; compare the two given-name token multisets, allowing an
 *               initial to stand for a full token. Included to test whether the weaker rule is
 *               enough, or whether it manufactures matches between different people.
 *
 * For each strategy the script reports agreement with staging's winner, and - the number that
 * actually decides this - how many pairs it newly calls a match that the OTHER strategies reject,
 * listed so they can be read by eye.
 *
 * Usage (from test/integration/):
 *   npx tsx --tsconfig ../../backend/tsconfig.json \
 *     sync-acms-professional-ids-audit/scripts/given-name-split-experiment.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  isFirstMiddleSwap,
  isKnownNicknamePair,
  isOneSidedMiddleNameMatch,
  isPlausibleNicknameByDistance,
  normalizeNamePart,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { splitCompoundFirstName } from '../../../../backend/lib/use-cases/dataflows/acms-name-normalization.helpers';
import { TrusteeProfessionalId } from '../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types';
import { Trustee } from '../../../../common/src/cams/trustees';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const PROFESSIONAL_IDS = '2026-09-25-trustee-professional-ids.json';
const TRUSTEES = '2026-09-25-trustees.json';

type GivenName = { first: string; middle: string };

/** Mirrors splitCamsInitialPlusGivenName in trustee-match-pipeline-stages.ts, which is private. */
function splitCamsInitialPlusGivenName(
  firstName: string | undefined,
  middleName: string | undefined,
): { firstName: string | undefined; middleName: string | undefined } {
  if (middleName || !firstName) return { firstName, middleName };
  const tokens = firstName.trim().split(/\s+/);
  if (tokens.length !== 2) return { firstName, middleName };
  const [first, second] = tokens;
  const firstIsInitial = first.replace(/\.$/, '').length === 1;
  const secondIsInitial = second.replace(/\.$/, '').length === 1;
  if (firstIsInitial === secondIsInitial) return { firstName, middleName };
  return firstIsInitial
    ? { firstName: first, middleName: second }
    : { firstName: second, middleName: first };
}

function currentSource(first?: string, middle?: string): GivenName {
  const split = splitCompoundFirstName(first, middle);
  return {
    first: normalizeNamePart(split.firstName),
    middle: normalizeNamePart(split.middleName),
  };
}

function currentCams(first?: string, middle?: string): GivenName {
  const split = splitCamsInitialPlusGivenName(first, middle);
  return {
    first: normalizeNamePart(split.firstName),
    middle: normalizeNamePart(split.middleName),
  };
}

/** Generational suffixes and ACMS placeholder junk are not given-name tokens. Joining the fields
 * exposes them where the current per-field split happened to keep them out of the comparison. */
const NON_NAME_TOKENS = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'x']);

/** Punctuation becomes a token boundary, whitespace is preserved as one - the space between an
 * initial and an adjacent name carries real structure and must survive normalization. */
function givenNameTokens(first?: string, middle?: string): string[] {
  return [first ?? '', middle ?? '']
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .filter((t) => !NON_NAME_TOKENS.has(t));
}

function joined(first?: string, middle?: string): GivenName {
  const tokens = givenNameTokens(first, middle);
  return { first: tokens[0] ?? '', middle: tokens.slice(1).join('') };
}

const isInitialOf = (initial: string, full: string) =>
  initial.length === 1 && full.length > 0 && full.startsWith(initial);

/** The same relaxations matchNamePart allows, minus the memo. */
function partsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (isInitialOf(a, b) || isInitialOf(b, a)) return true;
  if (a.length === 1 || b.length === 1) return false;
  return isKnownNicknamePair(a, b) || isPlausibleNicknameByDistance(a, b);
}

/** Positional: first names must relate, and a middle present on BOTH sides must not conflict. */
function positionalMatch(source: GivenName, cams: GivenName): boolean {
  if (!partsMatch(source.first, cams.first)) return false;
  if (source.middle && cams.middle && !partsMatch(source.middle, cams.middle)) return false;
  return true;
}

/** Positional, ignoring the middle entirely - isolates how much of any gain comes purely from
 * repairing the first-name boundary rather than from relaxing the middle comparison. */
function firstOnlyMatch(source: GivenName, cams: GivenName): boolean {
  return partsMatch(source.first, cams.first);
}

/** The actual proposal: `joined` normalization feeding matchName's existing positional rules,
 * including the swap handlers, which already demand a spelled-out token in common before
 * accepting a crossed pairing. */
function pipelineMatch(source: GivenName, cams: GivenName): boolean {
  if (positionalMatch(source, cams)) return true;
  if (partsMatch(source.first, cams.first)) return false; // middle conflicted; swap cannot apply
  return (
    isFirstMiddleSwap(source.first, source.middle, cams.first, cams.middle) ||
    isOneSidedMiddleNameMatch(source.first, source.middle, cams.first, cams.middle)
  );
}

function tokenSetMatch(sourceTokens: string[], camsTokens: string[]): boolean {
  const [small, big] =
    sourceTokens.length <= camsTokens.length
      ? [sourceTokens, camsTokens]
      : [camsTokens, sourceTokens];
  if (small.length === 0) return false;
  const used = new Set<number>();
  for (const token of small) {
    const index = big.findIndex((other, i) => !used.has(i) && partsMatch(token, other));
    if (index < 0) return false;
    used.add(index);
  }
  return true;
}

function main(): void {
  const records: TrusteeProfessionalId[] = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, PROFESSIONAL_IDS), 'utf-8'),
  );
  const trustees: Trustee[] = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, TRUSTEES), 'utf-8'),
  );
  const trusteeById = new Map(trustees.map((t) => [t.trusteeId, t]));

  const strategies = ['current', 'joined', 'pipeline', 'firstOnly', 'tokenSet'] as const;
  const agree: Record<string, number> = Object.fromEntries(strategies.map((s) => [s, 0]));
  const verdicts: { id: string; src: string; cams: string; result: Record<string, boolean> }[] = [];

  let considered = 0;
  for (const record of records) {
    const evidence = record.evidence as
      | { sourceRaw?: { firstName?: string; middleName?: string; fullName?: string } }
      | undefined;
    const match = (record.evidence as { match?: { trusteeId: string } } | undefined)?.match;
    if (!match?.trusteeId || !evidence?.sourceRaw) continue;
    const trustee = trusteeById.get(match.trusteeId);
    if (!trustee) continue;
    considered++;

    const sr = evidence.sourceRaw;
    const result: Record<string, boolean> = {
      current: positionalMatch(
        currentSource(sr.firstName, sr.middleName),
        currentCams(trustee.firstName, trustee.middleName),
      ),
      joined: positionalMatch(
        joined(sr.firstName, sr.middleName),
        joined(trustee.firstName, trustee.middleName),
      ),
      pipeline: pipelineMatch(
        joined(sr.firstName, sr.middleName),
        joined(trustee.firstName, trustee.middleName),
      ),
      firstOnly: firstOnlyMatch(
        joined(sr.firstName, sr.middleName),
        joined(trustee.firstName, trustee.middleName),
      ),
      tokenSet: tokenSetMatch(
        givenNameTokens(sr.firstName, sr.middleName),
        givenNameTokens(trustee.firstName, trustee.middleName),
      ),
    };
    for (const s of strategies) if (result[s]) agree[s]++;
    verdicts.push({
      id: record.acmsProfessionalId,
      src: [sr.firstName, sr.middleName].filter(Boolean).join(' '),
      cams: [trustee.firstName, trustee.middleName].filter(Boolean).join(' '),
      result,
    });
  }

  console.log(`\nStaging-matched records with a resolvable trustee: ${considered}\n`);
  console.log('Agreement with the trustee staging actually chose:');
  for (const s of strategies) {
    const pct = ((agree[s] / considered) * 100).toFixed(1);
    console.log(`  ${s.padEnd(10)} ${String(agree[s]).padStart(5)}  (${pct}%)`);
  }

  const gained = verdicts.filter((v) => !v.result.current && v.result.pipeline);
  const lost = verdicts.filter((v) => v.result.current && !v.result.pipeline);
  console.log(`\npipeline vs current:  +${gained.length} newly matched, -${lost.length} lost`);
  console.log('\nNewly matched by "pipeline" (current rejects these):');
  for (const v of gained) console.log(`  ${v.id.padEnd(10)} ${v.src}  ||  ${v.cams}`);
  if (lost.length) {
    console.log('\nLOST by "pipeline" (current matched, pipeline does not):');
    for (const v of lost) console.log(`  ${v.id.padEnd(10)} ${v.src}  ||  ${v.cams}`);
  }

  const compound = verdicts.filter((v) =>
    /^(lee ann|mary jo|lou ann|beth ann|beth jo|nancy jo|st\. clair|chapter|office of)/i.test(
      v.cams,
    ),
  );
  console.log(`\nCompound-given-name / placeholder CAMS records in the matched set: ${compound.length}`);
  for (const v of compound) {
    console.log(
      `  ${v.id.padEnd(10)} ${v.src}  ||  ${v.cams}   current=${v.result.current} pipeline=${v.result.pipeline}`,
    );
  }

  const tokenOnly = verdicts.filter((v) => !v.result.pipeline && v.result.tokenSet);
  console.log(`\nMatched ONLY by tokenSet, which pipeline rejects: ${tokenOnly.length}`);
  console.log('(what position-free matching would additionally admit - check for coincidences)');
  for (const v of tokenOnly) {
    console.log(`  ${v.id.padEnd(10)} ${v.src}  ||  ${v.cams}`);
  }
}

main();
