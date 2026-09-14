/**
 * Backtest (NOT a harness, not committed anywhere as a regression gate): replays every real
 * error-disposition (no-match/ambiguous) record from a staging trustee-professional-ids export
 * through the ACTUAL, unmodified current-`main`-branch matching pipeline, exactly as
 * sync-acms-professional-ids.ts's processNameMatch calls it — not a re-derived scoring
 * approximation like sync-acms-professional-ids-audit-harness.ts's Pass 2.
 *
 * Why this exists: a Friday-to-weekend sync run against staging persisted a batch of `ambiguous`
 * trustee-professional-ids records. Spot-checking one (Kenneth Battley, AK-00027) by hand against
 * the real matchTrusteeByName/resolveByContactCorroboration code showed it SHOULD have resolved
 * (name=100, address=100, phone=100) — but trustee-professional-ids is write-once per
 * (fingerprint, acmsProfessionalId): once written, a duplicate-key hit on retry just returns the
 * stale existing document instead of re-evaluating (see
 * TrusteesProfessionalIdsMongoRepository.createErroredProfessionalId). So a persisted `ambiguous`
 * record does not necessarily reflect what current `main` would decide today. Before writing any
 * matcher change, this backtest answers: if the whole error population were re-run against
 * current `main` right now (which is what the planned staging/prod purge + full re-sync will
 * effectively do), how many would resolve?
 *
 * Requires a REAL local MongoDB (not the mocked in-memory adapter) — searchTrusteesByNameScored's
 * phonetic-token matching is a Mongo aggregation pipeline stage (buildPhoneticScore) that cannot
 * be faithfully replicated by re-implementing it outside Mongo without risking drift from the real
 * query semantics. Seeds a disposable local trustees collection from the same trustees export
 * sync-acms-professional-ids-audit-harness.ts uses, then calls the real repository/matching code
 * unmodified via a real (non-mocked) ApplicationContext — same pattern
 * sync-acms-professional-ids/scripts/sync-acms-professional-ids-harness.ts's
 * buildRealApplicationContext() uses.
 *
 * Every run writes a per-record CSV report to ./data (repo root, gitignored — real trustee PII,
 * never committed) at data/replay-backtest-report.csv, one row per error record with ACMS fields
 * on the left, the final outcome, and one column group per pipeline stage the record actually
 * passed through (which stage, its result, its candidate count, and — when it produced a
 * representative winner — that winner's CAMS fields and four component scores). This makes "where
 * exactly did this record fall through the pipeline" answerable by filtering the CSV, not by
 * re-reading a raw console log.
 *
 * Usage (from test/integration/), against a disposable local Mongo container (NOT the shared
 * cams-local-infra-mongo container other agents/tooling depend on):
 *   MONGO_CONNECTION_STRING="mongodb://localhost:27118/cams-876-replay?retrywrites=false" \
 *   COSMOS_DATABASE_NAME="cams-876-replay" \
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/main-branch-replay-backtest.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';
import { AcmsTrusteeProfessional } from '../../../../common/src/cams/dataflow-events';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const DATA_DIR = path.resolve(__dirname, '../../../../data');

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

/**
 * Reimplements sync-acms-professional-ids.ts's module-private splitCompoundFirstName exactly:
 * production's real matchTrusteeByName call (via toAcmsTrusteeProfessional, called on the LIVE
 * ACMS record during a sync run) applies this split before matching, but buildAcmsVariant (which
 * builds the persisted `variant` string this backtest decodes) does NOT apply it — the persisted
 * variant always carries the raw, unsplit firstName/middleInitial. Skipping this step here would
 * silently regress a case production's original sync already benefited from, inflating this
 * backtest's "matcher gap" findings with a replay-methodology artifact rather than a real gap.
 */
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

/**
 * Same construct sync-acms-professional-ids-harness.ts's buildRealApplicationContext() uses:
 * the non-HTTP ApplicationContext a real dataflow invocation gets, pointed at whatever
 * MONGO_CONNECTION_STRING/COSMOS_DATABASE_NAME are set to. Deliberately NOT
 * createMockApplicationContext, which forces the mocked in-memory adapter this backtest needs to
 * bypass.
 */
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

type Winner = {
  trusteeId: string;
  name: string;
  address: string;
  phone: string;
  score: Score;
};

type StageName = 'matchTrusteeByName' | 'corroboration' | 'tokenIntersection' | 'levenshtein';
type StageResult = 'resolved' | 'ambiguous' | 'no-match' | 'unresolved' | 'skipped';

type StageTrace = {
  stage: StageName;
  result: StageResult;
  candidateCount: number;
  winner?: Winner;
};

type RecordTrace = {
  acmsProfessionalId: string;
  acmsFullName: string;
  acmsAddress: string;
  acmsPhone: string;
  priorDisposition: string;
  finalOutcome: 'resolved' | 'ambiguous' | 'no-match';
  resolvedTrusteeId?: string;
  resolvedVia?: StageName | 'name-exact' | 'name-fuzzy';
  stages: StageTrace[];
};

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvEscape).join(',');
}

function acmsAddressString(acmsTrusteeProfessional: AcmsTrusteeProfessional): string {
  return [
    acmsTrusteeProfessional.legacy?.address1,
    acmsTrusteeProfessional.legacy?.cityStateZipCountry,
  ]
    .filter(Boolean)
    .join(', ');
}

function camsAddressString(trustee: Trustee): string {
  const a = trustee.public?.address;
  if (!a) return '';
  return [a.address1, [a.city, a.state, a.zipCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

const MAX_STAGES = 3; // matchTrusteeByName + up to 2 fallback tiers (ambiguous: corroboration, levenshtein; no-match: tokenIntersection, levenshtein)

// Stage 1 is always matchTrusteeByName, which only ever reaches this backtest's population in
// its 'ambiguous'/'no-match' shape - any record where matchTrusteeByName alone resolved outright
// would have auto-linked at write time and never become an error record to replay in the first
// place. So stage1's winner/score columns are always empty by construction (confirmed against a
// full run: 0 of 2734 rows). Only candidateCount carries real signal for stage 1.
function stageHeaderColumns(stageIndex: number): string[] {
  const base = [`stage${stageIndex}_name`, `stage${stageIndex}_result`, `stage${stageIndex}_candidateCount`];
  if (stageIndex === 1) return base;
  return [
    ...base,
    `stage${stageIndex}_winnerTrusteeId`,
    `stage${stageIndex}_winnerName`,
    `stage${stageIndex}_winnerAddress`,
    `stage${stageIndex}_winnerPhone`,
    `stage${stageIndex}_nameScore`,
    `stage${stageIndex}_addressScore`,
    `stage${stageIndex}_phoneScore`,
    `stage${stageIndex}_emailScore`,
  ];
}

function stageRowFields(
  stageIndex: number,
  s: StageTrace | undefined,
): (string | number | null | undefined)[] {
  const skippedBase = ['', 'skipped', ''];
  const skippedWinner = ['', '', '', '', '', '', '', ''];

  if (stageIndex === 1) {
    return s ? [s.stage, s.result, s.candidateCount] : skippedBase;
  }
  if (!s) return [...skippedBase, ...skippedWinner];
  return [
    s.stage,
    s.result,
    s.candidateCount,
    s.winner?.trusteeId,
    s.winner?.name,
    s.winner?.address,
    s.winner?.phone,
    s.winner?.score.nameScore,
    s.winner?.score.addressScore,
    s.winner?.score.phoneScore,
    s.winner?.score.emailScore,
  ];
}

function writeReportCsv(traces: RecordTrace[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const header: string[] = [
    'acmsProfessionalId',
    'acmsFullName',
    'acmsAddress',
    'acmsPhone',
    'priorDisposition',
    'finalOutcome',
    'resolvedTrusteeId',
    'resolvedVia',
  ];
  for (let i = 1; i <= MAX_STAGES; i++) {
    header.push(...stageHeaderColumns(i));
  }

  const rows = traces.map((t) => {
    const fields: (string | number | null | undefined)[] = [
      t.acmsProfessionalId,
      t.acmsFullName,
      t.acmsAddress,
      t.acmsPhone,
      t.priorDisposition,
      t.finalOutcome,
      t.resolvedTrusteeId,
      t.resolvedVia,
    ];
    for (let i = 1; i <= MAX_STAGES; i++) {
      fields.push(...stageRowFields(i, t.stages[i - 1]));
    }
    return csvRow(fields);
  });

  const reportPath = path.join(DATA_DIR, 'replay-backtest-report.csv');
  fs.writeFileSync(reportPath, [csvRow(header), ...rows].join('\n') + '\n');
  console.log(`\nWrote ${rows.length} rows to ${reportPath}`);
}

async function run() {
  console.log(
    '\nReplaying error-disposition trustee-professional-ids records through the real, unmodified\n' +
      'current-main matching pipeline...\n',
  );

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
  console.log(`${errored.length} error-disposition records to replay.\n`);

  await seedTrustees(uri, dbName, trustees);

  const context = await buildRealApplicationContext();
  const {
    matchTrusteeByName,
    resolveByContactCorroboration,
    resolveDuplicateNameCandidates,
    findTokenIntersectionCandidates,
    findAnchoredLevenshteinCandidates,
    calculateNameScore,
    calculateAddressScore,
    calculatePhoneScore,
    calculateEmailScore,
  } = await import('../../../../backend/lib/use-cases/dataflows/trustee-match.helpers');

  const trusteesById = new Map(trustees.map((t) => [t.trusteeId, t]));

  function scoreCandidate(acmsTrusteeProfessional: AcmsTrusteeProfessional, trustee: Trustee): Score {
    return {
      nameScore: calculateNameScore(acmsTrusteeProfessional, trustee),
      addressScore: calculateAddressScore(acmsTrusteeProfessional.legacy, trustee.public?.address),
      phoneScore: calculatePhoneScore(acmsTrusteeProfessional.legacy?.phone, trustee.public?.phone),
      emailScore: calculateEmailScore(acmsTrusteeProfessional.legacy?.email, trustee.public?.email),
    };
  }

  function toWinner(trustee: Trustee, score: Score): Winner {
    return {
      trusteeId: trustee.trusteeId,
      name: trustee.name,
      address: camsAddressString(trustee),
      phone: trustee.public?.phone?.number ?? '',
      score,
    };
  }

  /**
   * Runs the real resolveByContactCorroboration -> resolveDuplicateNameCandidates sequence
   * (same composition as sync-acms-professional-ids.ts's module-private
   * resolveCandidatesByCorroboration) and returns BOTH the resolved trusteeId (if any) and a
   * StageTrace describing what happened, so the CSV can show a representative winner even for an
   * 'unresolved'/'ambiguous' outcome (the best-scoring candidate by name then address, for human
   * review — not a claim that candidate should have won).
   */
  async function runCorroborationStage(
    acmsTrusteeProfessional: AcmsTrusteeProfessional,
    candidateTrusteeIds: string[],
  ): Promise<{ resolvedTrusteeId: string | null; trace: StageTrace }> {
    if (candidateTrusteeIds.length === 0) {
      return {
        resolvedTrusteeId: null,
        trace: { stage: 'corroboration', result: 'no-match', candidateCount: 0 },
      };
    }

    const corroboration = await resolveByContactCorroboration(
      context,
      acmsTrusteeProfessional,
      candidateTrusteeIds,
    );
    if (corroboration.kind === 'resolved') {
      const trustee = trusteesById.get(corroboration.trusteeId);
      const score = corroboration.candidateScores.find((c) => c.trusteeId === corroboration.trusteeId);
      return {
        resolvedTrusteeId: corroboration.trusteeId,
        trace: {
          stage: 'corroboration',
          result: 'resolved',
          candidateCount: candidateTrusteeIds.length,
          winner:
            trustee && score
              ? toWinner(trustee, {
                  nameScore: score.nameScore,
                  addressScore: score.addressScore,
                  phoneScore: score.phoneScore,
                  emailScore: score.emailScore,
                })
              : undefined,
        },
      };
    }

    const duplicateResolution = await resolveDuplicateNameCandidates(
      context,
      acmsTrusteeProfessional,
      candidateTrusteeIds,
    );
    const representative = pickRepresentative(candidateTrusteeIds, acmsTrusteeProfessional);
    if (duplicateResolution.kind === 'resolved-duplicate') {
      const trustee = trusteesById.get(duplicateResolution.trusteeId);
      return {
        resolvedTrusteeId: duplicateResolution.trusteeId,
        trace: {
          stage: 'corroboration',
          result: 'resolved',
          candidateCount: candidateTrusteeIds.length,
          winner: trustee ? toWinner(trustee, scoreCandidate(acmsTrusteeProfessional, trustee)) : undefined,
        },
      };
    }

    return {
      resolvedTrusteeId: null,
      trace: {
        stage: 'corroboration',
        result: candidateTrusteeIds.length === 1 ? 'unresolved' : 'ambiguous',
        candidateCount: candidateTrusteeIds.length,
        winner: representative,
      },
    };
  }

  /** Best-scoring (name, then address) candidate among a raw id list — for CSV review only. */
  function pickRepresentative(
    candidateTrusteeIds: string[],
    acmsTrusteeProfessional: AcmsTrusteeProfessional,
  ): Winner | undefined {
    let best: { trustee: Trustee; score: Score } | undefined;
    for (const id of candidateTrusteeIds) {
      const trustee = trusteesById.get(id);
      if (!trustee) continue;
      const score = scoreCandidate(acmsTrusteeProfessional, trustee);
      if (
        !best ||
        score.nameScore > best.score.nameScore ||
        (score.nameScore === best.score.nameScore && score.addressScore > best.score.addressScore)
      ) {
        best = { trustee, score };
      }
    }
    return best ? toWinner(best.trustee, best.score) : undefined;
  }

  const traces: RecordTrace[] = [];
  const counts = { resolved: 0, ambiguous: 0, 'no-match': 0 };

  let i = 0;
  for (const record of errored) {
    i++;
    if (i % 250 === 0) console.log(`  ...${i}/${errored.length}`);

    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsTrusteeProfessional = toAcmsTrusteeProfessional(decoded);
    const stages: StageTrace[] = [];

    const nameResult = await matchTrusteeByName(context, acmsTrusteeProfessional);
    stages.push({
      stage: 'matchTrusteeByName',
      result: nameResult.kind,
      candidateCount: nameResult.kind === 'ambiguous' ? nameResult.matchCandidates.length : nameResult.kind === 'resolved' ? 1 : 0,
      winner:
        nameResult.kind === 'resolved'
          ? (() => {
              const trustee = trusteesById.get(nameResult.trusteeId);
              return trustee ? toWinner(trustee, scoreCandidate(acmsTrusteeProfessional, trustee)) : undefined;
            })()
          : undefined,
    });

    let finalOutcome: RecordTrace['finalOutcome'];
    let resolvedTrusteeId: string | undefined;
    let resolvedVia: RecordTrace['resolvedVia'];

    if (nameResult.kind === 'resolved') {
      finalOutcome = 'resolved';
      resolvedTrusteeId = nameResult.trusteeId;
      resolvedVia = nameResult.nameMatchQuality === 'exact' ? 'name-exact' : 'name-fuzzy';
    } else if (nameResult.kind === 'ambiguous') {
      const rawCandidateIds = nameResult.matchCandidates.map((c) => c.trusteeId);
      const corroborationStage = await runCorroborationStage(acmsTrusteeProfessional, rawCandidateIds);
      stages.push(corroborationStage.trace);

      if (corroborationStage.resolvedTrusteeId) {
        finalOutcome = 'resolved';
        resolvedTrusteeId = corroborationStage.resolvedTrusteeId;
        resolvedVia = 'corroboration';
      } else {
        const levenshteinCandidates = await findAnchoredLevenshteinCandidates(context, acmsTrusteeProfessional);
        const levenshteinIds = levenshteinCandidates.map((t) => t.trusteeId);
        const levenshteinStage = await runCorroborationStage(acmsTrusteeProfessional, levenshteinIds);
        stages.push({ ...levenshteinStage.trace, stage: 'levenshtein' });

        if (levenshteinStage.resolvedTrusteeId) {
          finalOutcome = 'resolved';
          resolvedTrusteeId = levenshteinStage.resolvedTrusteeId;
          resolvedVia = 'levenshtein';
        } else {
          finalOutcome = 'ambiguous';
        }
      }
    } else {
      const tokenIntersectionCandidates = await findTokenIntersectionCandidates(context, acmsTrusteeProfessional);
      const tokenIntersectionIds = tokenIntersectionCandidates.map((t) => t.trusteeId);
      const tokenIntersectionStage = await runCorroborationStage(acmsTrusteeProfessional, tokenIntersectionIds);
      stages.push({ ...tokenIntersectionStage.trace, stage: 'tokenIntersection' });

      if (tokenIntersectionStage.resolvedTrusteeId) {
        finalOutcome = 'resolved';
        resolvedTrusteeId = tokenIntersectionStage.resolvedTrusteeId;
        resolvedVia = 'tokenIntersection';
      } else {
        const levenshteinCandidates = await findAnchoredLevenshteinCandidates(context, acmsTrusteeProfessional);
        const levenshteinIds = levenshteinCandidates.map((t) => t.trusteeId);
        const levenshteinStage = await runCorroborationStage(acmsTrusteeProfessional, levenshteinIds);
        stages.push({ ...levenshteinStage.trace, stage: 'levenshtein' });

        if (levenshteinStage.resolvedTrusteeId) {
          finalOutcome = 'resolved';
          resolvedTrusteeId = levenshteinStage.resolvedTrusteeId;
          resolvedVia = 'levenshtein';
        } else {
          finalOutcome = 'no-match';
        }
      }
    }

    counts[finalOutcome]++;
    traces.push({
      acmsProfessionalId: record.acmsProfessionalId,
      acmsFullName: acmsTrusteeProfessional.fullName,
      acmsAddress: acmsAddressString(acmsTrusteeProfessional),
      acmsPhone: acmsTrusteeProfessional.legacy?.phone ?? '',
      priorDisposition: record.error!.disposition,
      finalOutcome,
      resolvedTrusteeId,
      resolvedVia,
      stages,
    });
  }

  console.log('\n=== Replay outcome (current main vs. what was actually persisted) ===\n');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(20)} ${v.toString().padStart(6)}  (${((v / errored.length) * 100).toFixed(1)}%)`);
  }

  const resolved = traces.filter((t) => t.finalOutcome === 'resolved');
  const byPriorDisposition: Record<string, number> = {};
  for (const t of resolved) {
    byPriorDisposition[t.priorDisposition] = (byPriorDisposition[t.priorDisposition] ?? 0) + 1;
  }
  console.log(
    `\n${resolved.length} records that were persisted as error dispositions would resolve ` +
      `under current main. Broken down by their PERSISTED (stale) disposition:`,
  );
  for (const [d, c] of Object.entries(byPriorDisposition)) {
    console.log(`  ${d.padEnd(15)} ${c}`);
  }

  const byResolvedVia: Record<string, number> = {};
  for (const t of resolved) {
    const via = t.resolvedVia ?? 'unknown';
    byResolvedVia[via] = (byResolvedVia[via] ?? 0) + 1;
  }
  console.log('\nBroken down by which stage resolved them:');
  for (const [via, c] of Object.entries(byResolvedVia)) {
    console.log(`  ${via.padEnd(15)} ${c}`);
  }

  const ambiguous = traces.filter((t) => t.finalOutcome === 'ambiguous');
  const matchStage = (t: RecordTrace) => t.stages[0];
  const singleCandidateStuck = ambiguous.filter((t) => matchStage(t).candidateCount === 1);
  const multiCandidateStuck = ambiguous.filter((t) => matchStage(t).candidateCount > 1);
  const candidateCounts = ambiguous.map((t) => matchStage(t).candidateCount).sort((a, b) => a - b);
  const percentile = (p: number) =>
    candidateCounts.length > 0 ? candidateCounts[Math.floor(candidateCounts.length * p)] : 0;

  console.log(
    `\n=== Ambiguous breakdown (${ambiguous.length} records, genuine remaining matcher gap) ===\n`,
  );
  console.log(`  single-candidate: ${singleCandidateStuck.length}`);
  console.log(`  multi-candidate:  ${multiCandidateStuck.length}`);
  if (candidateCounts.length > 0) {
    console.log(
      `  candidate-count percentiles: p50=${percentile(0.5)} p75=${percentile(0.75)} p90=${percentile(0.9)} max=${candidateCounts[candidateCounts.length - 1]}`,
    );
  }

  writeReportCsv(traces);

  console.log(
    `\nConclusion: a full purge + re-sync against current main would recover ` +
      `${resolved.length} of ${errored.length} (${((resolved.length / errored.length) * 100).toFixed(1)}%) ` +
      `of this export's error population WITHOUT any matcher code change beyond what's already on ` +
      `main. See data/replay-backtest-report.csv for the full per-record, per-stage trace.`,
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Real ApplicationContext callers normally live for a whole Function invocation and are torn
    // down by the runtime; a one-shot script must exit the process itself once done, or the open
    // Mongo connection pool keeps node alive indefinitely.
    process.exit(process.exitCode ?? 0);
  });
