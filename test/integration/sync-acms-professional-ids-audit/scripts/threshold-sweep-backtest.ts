/**
 * Threshold sweep (NOT a harness, not committed as a regression gate): finds the resolve-rate /
 * risk tradeoff across a grid of candidate-prefilter and corroboration thresholds, against the
 * SAME real staging error population main-branch-replay-backtest.ts uses.
 *
 * Why this exists: main-branch-replay-backtest.ts found that among the ~936 multi-candidate
 * still-ambiguous records, matchTrusteeByName's raw candidate list is often mostly lastName-token
 * search noise (phonetically-similar but unrelated surnames) rather than genuine ambiguity - a
 * name-score prefilter collapses many of them down to a single real candidate. But a single fixed
 * prefilter threshold is a guess. This sweep varies:
 *   - NAME_PREFILTER_THRESHOLD: minimum nameScore (calculateNameScore) for a raw candidate to
 *     count as "real" rather than search noise.
 *   - ADDRESS_THRESHOLD: minimum addressScore (mirrors CONTACT_CORROBORATION_ADDRESS_THRESHOLD)
 *     for address alone to corroborate a sole prefiltered candidate.
 * across a grid, and reports at each combination: how many records would auto-link, and - since
 * this fixture-only script cannot ground-truth "is that link actually correct" - flags records
 * where the winning candidate's nameScore is below what production's real
 * resolveByContactCorroboration would itself require (85), so a human can distinguish "recovers a
 * real match production is currently too strict to find" from "would auto-link something risky
 * production correctly refuses today."
 *
 * Reuses calculateNameScore/calculateAddressScore/calculatePhoneScore/calculateEmailScore/
 * parseCityStateZip directly (the same production scoring primitives every other harness in this
 * directory uses) - only the THRESHOLD COMPARISONS are reimplemented here (trivial one-line
 * inequalities), not the scoring itself, so sweeping never drifts from what the real functions
 * would compute for a given candidate.
 *
 * Requires a REAL local MongoDB (not the mocked in-memory adapter) - matchTrusteeByName's
 * lastName-token discovery tier is a real repository query. Seeds a disposable local trustees
 * collection, same as main-branch-replay-backtest.ts.
 *
 * Usage (from test/integration/), against a disposable local Mongo container (NOT the shared
 * cams-local-infra-mongo container other agents/tooling depend on):
 *   MONGO_CONNECTION_STRING="mongodb://localhost:27119/cams-876-sweep?retrywrites=false" \
 *   COSMOS_DATABASE_NAME="cams-876-sweep" \
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/threshold-sweep-backtest.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';
import { AcmsTrusteeProfessional } from '../../../../common/src/cams/dataflow-events';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

type MongoExtendedId = { $oid?: string } | string | undefined;

function stripMongoId<T extends { _id?: MongoExtendedId }>(doc: T): Omit<T, '_id'> {
  const { _id, ...rest } = doc;
  return rest;
}

function resolveFixtureFile(envVar: string, namePattern: string): string {
  const explicit = process.env[envVar];
  if (explicit) return path.join(FIXTURES_DIR, explicit);
  const matches = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.includes(namePattern) && f.endsWith('.json'))
    .sort();
  if (matches.length === 0) {
    throw new Error(`No fixture matching "*${namePattern}*.json" found in ${FIXTURES_DIR}`);
  }
  return path.join(FIXTURES_DIR, matches[matches.length - 1]);
}

function loadProfessionalIds(): TrusteeProfessionalId[] {
  const file = resolveFixtureFile('PROFESSIONAL_IDS_FIXTURE', 'trustee-professional-ids');
  const raw: (TrusteeProfessionalId & { _id?: MongoExtendedId })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  console.log(`Professional IDs fixture: ${path.basename(file)}`);
  return raw.map(stripMongoId);
}

function loadTrustees(): Trustee[] {
  const file = resolveFixtureFile('TRUSTEES_FIXTURE', 'trustees');
  const raw: (Record<string, unknown> & { _id?: MongoExtendedId })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  const trustees = raw.filter((doc) => doc.documentType === 'TRUSTEE');
  console.log(
    `Trustees fixture: ${path.basename(file)} (${trustees.length} of ${raw.length} docs are TRUSTEE)\n`,
  );
  return trustees.map((doc) => stripMongoId(doc) as Trustee);
}

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

function splitCompoundFirstName(
  firstName: string | undefined,
  middleInitial: string | undefined,
): { firstName: string | undefined; middleName: string | undefined } {
  if (middleInitial || !firstName) return { firstName, middleName: middleInitial };
  const tokens = firstName.trim().split(/\s+/);
  if (tokens.length < 2) return { firstName, middleName: middleInitial };
  return { firstName: tokens[0], middleName: tokens.slice(1).join(' ') };
}

function toAcmsTrusteeProfessional(variant: DecodedVariant): AcmsTrusteeProfessional {
  const fullName = [variant.firstName, variant.middleName, variant.lastName]
    .filter(Boolean)
    .join(' ');
  const { firstName, middleName } = splitCompoundFirstName(
    variant.firstName || undefined,
    variant.middleName || undefined,
  );
  return {
    firstName,
    middleName,
    lastName: variant.lastName || undefined,
    generation: variant.generation || undefined,
    fullName,
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

async function seedTrustees(uri: string, dbName: string, trustees: Trustee[]) {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    await db.collection('trustees').deleteMany({ documentType: 'TRUSTEE' });
    if (trustees.length > 0) {
      await db
        .collection('trustees')
        .insertMany(trustees.map((t) => ({ ...t, documentType: 'TRUSTEE' })));
    }
    console.log(`Seeded ${trustees.length} TRUSTEE documents into ${dbName}.trustees\n`);
  } finally {
    await client.close();
  }
}

async function buildRealApplicationContext() {
  const ContextCreator = (
    await import('../../../../backend/function-apps/azure/application-context-creator')
  ).default;
  return ContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
  });
}

type Score = {
  nameScore: number;
  addressScore: number;
  phoneScore: number | null;
  emailScore: number | null;
};

type GridPoint = { namePrefilter: number; addressThreshold: number };

async function run() {
  console.log('\nSweeping name-prefilter / address-corroboration thresholds against the real\n' +
    'multi-candidate still-ambiguous population...\n');

  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error(
      'MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set, pointed at a disposable ' +
        'local Mongo container — see this file\'s header comment. Do NOT point this at the ' +
        'shared cams-local-infra-mongo container.',
    );
  }

  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const errored = records.filter((r) => r.error && r.variant);
  const trusteesById = new Map(trustees.map((t) => [t.trusteeId, t]));

  await seedTrustees(uri, dbName, trustees);

  const context = await buildRealApplicationContext();
  const {
    matchTrusteeByName,
    resolveByContactCorroboration,
    resolveDuplicateNameCandidates,
    findAnchoredLevenshteinCandidates,
    calculateNameScore,
    calculateAddressScore,
    calculatePhoneScore,
    calculateEmailScore,
  } = await import('../../../../backend/lib/use-cases/dataflows/trustee-match.helpers');

  function scoreCandidate(acmsTrusteeProfessional: AcmsTrusteeProfessional, trustee: Trustee): Score {
    return {
      nameScore: calculateNameScore(acmsTrusteeProfessional, trustee),
      addressScore: calculateAddressScore(acmsTrusteeProfessional.legacy, trustee.public?.address),
      phoneScore: calculatePhoneScore(acmsTrusteeProfessional.legacy?.phone, trustee.public?.phone),
      emailScore: calculateEmailScore(acmsTrusteeProfessional.legacy?.email, trustee.public?.email),
    };
  }

  /**
   * Same sequence sync-acms-professional-ids.ts's module-private resolveCandidatesByCorroboration
   * composes (exported primitives, same order) - not a new, separately-tuned resolution path.
   */
  async function resolveCandidatesByCorroboration(
    acmsTrusteeProfessional: AcmsTrusteeProfessional,
    candidateTrusteeIds: string[],
  ): Promise<string | null> {
    if (candidateTrusteeIds.length === 0) return null;
    const corroboration = await resolveByContactCorroboration(context, acmsTrusteeProfessional, candidateTrusteeIds);
    if (corroboration.kind === 'resolved') return corroboration.trusteeId;
    const duplicateResolution = await resolveDuplicateNameCandidates(
      context,
      acmsTrusteeProfessional,
      candidateTrusteeIds,
    );
    if (duplicateResolution.kind === 'resolved-duplicate') return duplicateResolution.trusteeId;
    return null;
  }

  // Step 1: replay the FULL real ambiguous-branch resolution chain (matchTrusteeByName ->
  // corroboration -> anchored-Levenshtein -> corroboration again, exactly as processNameMatch's
  // ambiguous branch does per the already-shipped fix) and cache only records that genuinely
  // remain unresolved after ALL of that - not just matchTrusteeByName's raw output. An earlier
  // version of this sweep skipped this step and re-derived a decision from the raw candidate list
  // alone, which double-counted records the real pipeline already resolves (e.g. "Michael Hitt"
  // resolves via corroboration today - it must NOT appear in this sweep's target population).
  type CachedRecord = {
    acmsProfessionalId: string;
    fullName: string;
    disposition: string;
    rawCandidateCount: number;
    scored: { trusteeId: string; trusteeName: string; score: Score }[];
  };
  const cache: CachedRecord[] = [];

  let i = 0;
  for (const record of errored) {
    i++;
    if (i % 250 === 0) console.log(`  ...caching ${i}/${errored.length}`);

    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsTrusteeProfessional = toAcmsTrusteeProfessional(decoded);
    const nameResult = await matchTrusteeByName(context, acmsTrusteeProfessional);

    if (nameResult.kind !== 'ambiguous') continue; // 'resolved'/'no-match' are unaffected by these thresholds

    const rawCandidateIds = nameResult.matchCandidates.map((c) => c.trusteeId);
    const resolved = await resolveCandidatesByCorroboration(acmsTrusteeProfessional, rawCandidateIds);
    if (resolved) continue; // real pipeline already resolves this one — not part of the gap

    const levenshteinCandidates = await findAnchoredLevenshteinCandidates(context, acmsTrusteeProfessional);
    const levenshteinResolved = await resolveCandidatesByCorroboration(
      acmsTrusteeProfessional,
      levenshteinCandidates.map((t) => t.trusteeId),
    );
    if (levenshteinResolved) continue; // also already resolves via the shipped Levenshtein fix

    const scored = nameResult.matchCandidates
      .map((c) => trusteesById.get(c.trusteeId))
      .filter((t): t is Trustee => !!t)
      .map((t) => ({
        trusteeId: t.trusteeId,
        trusteeName: t.name,
        score: scoreCandidate(acmsTrusteeProfessional, t),
      }));

    cache.push({
      acmsProfessionalId: record.acmsProfessionalId,
      fullName: acmsTrusteeProfessional.fullName,
      disposition: record.error!.disposition,
      rawCandidateCount: nameResult.matchCandidates.length,
      scored,
    });
  }

  console.log(`\nCached ${cache.length} GENUINELY still-ambiguous records for sweeping (after the full real pipeline, including the shipped Levenshtein-on-ambiguous fix, already ran).\n`);

  // Isolate the population this sweep is actually meant to investigate: records where
  // matchTrusteeByName's RAW candidate list already has 2+ entries. A single-raw-candidate
  // record is already fully handled by production's existing resolveByContactCorroboration at
  // its current thresholds (see main-branch-replay-backtest.ts's still-ambiguous breakdown) -
  // sweeping thresholds against it would just re-derive production's own current (non-)decision,
  // not reveal new opportunity.
  const multiCandidateCache = cache.filter((r) => r.rawCandidateCount > 1);
  console.log(
    `${multiCandidateCache.length} of those have 2+ RAW candidates from matchTrusteeByName - ` +
      `this is the population the sweep below actually targets (single-raw-candidate records are ` +
      `already fully evaluated by production's real resolveByContactCorroboration and excluded ` +
      `here to avoid re-deriving a decision production already made).\n`,
  );

  // Step 2: sweep. For each grid point, a record "would auto-link" when exactly one candidate
  // clears namePrefilter AND (that candidate's addressScore >= addressThreshold OR phoneScore ===
  // 100 OR emailScore === 100) — the same OR-of-strong-signals shape
  // resolveByContactCorroboration already uses, just with the two thresholds made variable.
  function evaluateGridPoint(point: GridPoint) {
    let autoLinked = 0;
    let autoLinkedWithSubProductionNameScore = 0; // nameScore < 85 — below what corroboration itself requires today
    const examples: { fullName: string; acmsProfessionalId: string; trusteeName: string; score: Score }[] = [];

    for (const rec of multiCandidateCache) {
      const qualifying = rec.scored.filter((s) => s.score.nameScore >= point.namePrefilter);
      if (qualifying.length !== 1) continue;
      const winner = qualifying[0];
      const corroborated =
        winner.score.addressScore >= point.addressThreshold ||
        winner.score.phoneScore === 100 ||
        winner.score.emailScore === 100;
      if (!corroborated) continue;

      autoLinked++;
      if (winner.score.nameScore < 85) autoLinkedWithSubProductionNameScore++;
      if (examples.length < 100) {
        examples.push({
          fullName: rec.fullName,
          acmsProfessionalId: rec.acmsProfessionalId,
          trusteeName: winner.trusteeName,
          score: winner.score,
        });
      }
    }

    return { autoLinked, autoLinkedWithSubProductionNameScore, examples };
  }

  const namePrefilterGrid = [70, 75, 80, 85, 90, 95, 100];
  const addressThresholdGrid = [50, 60, 70, 80, 90];

  console.log(
    `=== Sweep: auto-linked count among ${multiCandidateCache.length} multi-raw-candidate ` +
      `records, by (namePrefilter, addressThreshold) ===\n`,
  );
  console.log('namePrefilter \\ addressThreshold  ' + addressThresholdGrid.map((a) => String(a).padStart(6)).join(''));
  for (const np of namePrefilterGrid) {
    const row = addressThresholdGrid.map((at) => {
      const { autoLinked } = evaluateGridPoint({ namePrefilter: np, addressThreshold: at });
      return String(autoLinked).padStart(6);
    });
    console.log(`  ${String(np).padStart(3)}                            ${row.join('')}`);
  }

  console.log(
    '\n=== Same grid, but only counting links where the winner also clears nameScore>=85 ===\n' +
      '(i.e. links production\'s OWN existing corroboration bar would already trust once the ' +
      'raw candidate list is prefiltered down to one — the safest, most defensible recovery) \n',
  );
  console.log('namePrefilter \\ addressThreshold  ' + addressThresholdGrid.map((a) => String(a).padStart(6)).join(''));
  for (const np of namePrefilterGrid) {
    const row = addressThresholdGrid.map((at) => {
      const { autoLinked, autoLinkedWithSubProductionNameScore } = evaluateGridPoint({
        namePrefilter: np,
        addressThreshold: at,
      });
      return String(autoLinked - autoLinkedWithSubProductionNameScore).padStart(6);
    });
    console.log(`  ${String(np).padStart(3)}                            ${row.join('')}`);
  }

  // Recommended operating point: namePrefilter=85 (matches production's existing
  // CONTACT_CORROBORATION_NAME_THRESHOLD exactly, so every recovered link would ALSO already
  // clear production's own corroboration bar — zero new risk surface) at each addressThreshold,
  // shown with examples for human review.
  console.log('\n=== Detail at namePrefilter=85 (matches production\'s existing bar) ===\n');
  for (const at of addressThresholdGrid) {
    const { autoLinked } = evaluateGridPoint({ namePrefilter: 85, addressThreshold: at });
    console.log(`addressThreshold=${at}: ${autoLinked} would auto-link`);
  }

  console.log(
    '\nExamples at namePrefilter=85, addressThreshold=50 (the only cell in this grid with real ' +
      'signal — production\'s actual current addressThreshold=80 recovers ZERO additional records):',
  );
  const { examples } = evaluateGridPoint({ namePrefilter: 85, addressThreshold: 50 });
  for (const e of examples) {
    console.log(
      `  "${e.fullName}" (${e.acmsProfessionalId}) -> "${e.trusteeName}" [name=${e.score.nameScore} address=${e.score.addressScore} phone=${e.score.phoneScore} email=${e.score.emailScore}]`,
    );
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
