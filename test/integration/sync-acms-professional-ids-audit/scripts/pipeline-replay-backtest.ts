/**
 * Backtest (NOT a harness, not committed anywhere as a regression gate): replays EVERY record
 * (including already auto-linked ones) from a staging trustee-professional-ids export through the
 * ACTUAL, unmodified current-branch matching pipeline (runTrusteeMatchPipeline,
 * trustee-match-pipeline-orchestrator.ts), so a fresh staging export can be diffed against what
 * current code would now produce for the same population - both new resolutions among the
 * previously-unresolved population, AND false-positive detection among what staging already
 * trusted: an auto-linked record current code would now resolve to a DIFFERENT trusteeId, or not
 * auto-link at all, is written to data/replay-backtest-divergences-detail.csv alongside every other
 * staging-vs-current disagreement, one row per (diverged ACMS record, candidate) pair. Each row
 * carries the ACMS source's own address/phone, staging's trustee's address/phone (looked up from
 * the trustees fixture independently of whether that trustee is even a candidate in the current
 * record's pool), the current pipeline's trustee's address/phone (when disposition is
 * 'auto-linked' - blank for 'ambiguous'/'no-match', which have no single winning trustee), and
 * that candidate's own scores - so a reviewer can see WHY a transition happened, and what the
 * record was choosing BETWEEN, without opening replay-backtest-report.jsonl for every row.
 *
 * Reads record.evidence.sourceRaw directly as the pipeline's input - CanonicalTrusteeSource/
 * DxtrTrusteeParty/AcmsTrusteeProfessional are the same type (dataflow-events.ts), so the exact
 * ACMS record staging already composed and persisted is replayed as-is, with no re-decoding or
 * reconstruction step. (An older fixture generation, pre-CAMS-876, instead persisted a raw
 * `variant` JSON string at the top level and required decoding it back into an
 * AcmsTrusteeProfessionalDetailRecord before calling toAcmsTrusteeProfessional - that shape is no
 * longer what staging exports produce.)
 *
 * Calls the real, exported shouldSkipAsNotAPerson/isRecordDisavowed
 * (acms-name-normalization.helpers.ts) and the real runTrusteeMatchPipeline directly - there is
 * no separate reimplementation of matching logic to keep in sync with production.
 *
 * Requires a REAL local MongoDB (not the mocked in-memory adapter) — searchTrusteesByNameScored's
 * phonetic-token matching is a Mongo aggregation pipeline stage that cannot be faithfully
 * replicated outside Mongo. Seeds a disposable local trustees collection from a trustees export,
 * then calls the real repository/matching code unmodified via a real (non-mocked)
 * ApplicationContext.
 *
 * Writes data/replay-backtest-report.jsonl (repo root, gitignored — real trustee PII, never
 * committed): one JSON line per record, the FULL serialized pipeline state (serializeState) -
 * every candidate's complete score history from every stage that touched it, not just the winner.
 * This is the reactive-investigation record: for an ambiguous/no-match record, a reviewer can see
 * exactly which stages ran, what each one concluded, and why the pipeline didn't collapse to a
 * match. ai-candidate-review.ts reads this file directly and produces the human-facing CSV (with
 * an AI second-opinion verdict per candidate) - this script has no CSV output of its own, since it
 * would only ever be a strict subset of what that CSV already shows.
 *
 * Usage (from test/integration/), against a disposable local Mongo container (NOT the shared
 * cams-local-infra-mongo container other agents/tooling depend on):
 *   MONGO_CONNECTION_STRING="mongodb://localhost:27118/cams-876-replay?retrywrites=false" \
 *   COSMOS_DATABASE_NAME="cams-876-replay" \
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/pipeline-replay-backtest.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types';
import { TrusteeSerializedState as SerializedState } from '../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline';

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

type CandidateOutcome =
  'resolved' | 'rejected-name' | 'rejected-corroboration' | 'rejected-ambiguous-group';

/**
 * A record whose CURRENT-pipeline disposition/camsTrusteeId disagrees with what staging actually
 * persisted - the false-positive-detection surface. Two shapes matter most:
 *  - staging said 'auto-linked' but current code no longer reaches the SAME trusteeId (either a
 *    different trusteeId, which is the actual false-positive risk worth manual review, or a
 *    downgrade to ambiguous/no-match/skipped/conflict, which is a REGRESSION worth investigating -
 *    something that used to resolve confidently no longer does).
 *  - staging said something else but current code now resolves to auto-linked - an IMPROVEMENT,
 *    not a risk, but still worth surfacing since it's new behavior relative to what's deployed.
 */
type Divergence = {
  acmsProfessionalId: string;
  acmsFullName: string;
  acmsAddress: string;
  acmsPhone: string;
  stagingDisposition: string;
  stagingTrusteeId: string | null;
  stagingTrusteeAddress: string;
  stagingTrusteePhone: string;
  currentDisposition: string;
  currentTrusteeId: string | null;
  currentTrusteeAddress: string;
  currentTrusteePhone: string;
  /** Compact summary of the score facet(s) that actually drove the transition - which candidate
   * the current pipeline considered (staging's trusteeId if still present in the pool, otherwise
   * whichever candidate has the highest doesNameMatch score) and its doesNameMatch/doesStateMatch/
   * resolvedBy values, so a reviewer can see WHY without re-opening the full JSONL for every row. */
};

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

/** Shared by the ACMS source record (legacy address fields), the staging trustee lookup (a raw
 * Trustee's public.address), and the current pipeline's key candidate (ProjectedTrustee.address) -
 * all three carry the same city/state/zip shape, just under different field names one level up. */
function acmsAddressString(legacy: SerializedState['sourceRaw']['legacy']): string {
  if (!legacy) return '';
  return [legacy.address1, legacy.cityStateZipCountry].filter(Boolean).join(', ');
}

function trusteeAddressString(address: Trustee['public']['address'] | undefined): string {
  if (!address) return '';
  return [
    address.address1,
    [address.city, address.state, address.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

const DIVERGENCE_DETAIL_COLUMNS = [
  'acmsProfessionalId',
  'acmsFullName',
  'acmsAddress',
  'acmsPhone',
  'stagingDisposition',
  'stagingTrusteeId',
  'stagingTrusteeName',
  'stagingTrusteeAddress',
  'stagingTrusteePhone',
  'currentDisposition',
  'currentTrusteeId',
  'currentTrusteeName',
  'currentTrusteeAddress',
  'currentTrusteePhone',
  'camsTrusteeId',
  'camsName',
  'camsAddress',
  'camsPhone',
  'isWinner',
  'nameQuality',
  'namePass',
  'statePass',
  'addressScore',
  'addressPass',
  'phoneMatch',
  'resolvedBy',
] as const;

/**
 * One row per (diverged ACMS record, candidate) pair, so a reviewer can see EVERY candidate's own
 * score detail behind a divergence and what the record was choosing between. A record with zero
 * candidates (e.g. skipped) still produces exactly one row, matching candidateCsvRows's own
 * convention in partition-backtest-report.ts, with every candidate-specific column blank. The
 * ACMS/staging/current contact columns repeat on every row of a record (this is a cartesian
 * product, not a normalized join), so no row needs to be read against another to be understood.
 */
function divergenceCandidateRows(
  d: Divergence,
  candidates: SerializedState['candidates'],
  resolvedBy: string | undefined,
  trusteeNameById: Map<string, string>,
): string[][] {
  const base = [
    d.acmsProfessionalId,
    d.acmsFullName,
    d.acmsAddress,
    d.acmsPhone,
    d.stagingDisposition,
    d.stagingTrusteeId ?? '',
    (d.stagingTrusteeId && trusteeNameById.get(d.stagingTrusteeId)) ?? '',
    d.stagingTrusteeAddress,
    d.stagingTrusteePhone,
    d.currentDisposition,
    d.currentTrusteeId ?? '',
    (d.currentTrusteeId && trusteeNameById.get(d.currentTrusteeId)) ?? '',
    d.currentTrusteeAddress,
    d.currentTrusteePhone,
  ];
  if (candidates.length === 0) {
    return [[...base, '', '', '', '', '', '', '', '', '', '', '', '', '', resolvedBy ?? '']];
  }
  return candidates.map((candidate) => {
    const s = candidate.scores;
    return [
      ...base,
      candidate.camsRaw.trusteeId,
      candidate.camsRaw.name ?? '',
      trusteeAddressString(candidate.camsRaw.address),
      candidate.camsRaw.phone?.number ?? '',
      String(candidate.camsRaw.trusteeId === d.currentTrusteeId),
      String(s.doesNameMatch?.quality ?? ''),
      String(s.doesNameMatch?.pass ?? ''),
      String(s.doesStateMatch?.pass ?? ''),
      String(s.contactCorroborationAddress?.value ?? ''),
      String(s.contactCorroborationAddress?.pass ?? ''),
      s.doesPhoneMatch ? String(s.doesPhoneMatch.quality ?? 'no-match') : '',
      candidate.camsRaw.trusteeId === d.currentTrusteeId ? (resolvedBy ?? '') : '',
    ];
  });
}

/** Streams the JSONL report one record at a time - a record's candidate pool can range from 0 to
 * several hundred, so buffering every record across the whole population before writing risks
 * holding tens of thousands of objects in memory at once for no reason. */
class ReportWriter {
  private readonly jsonlStream: fs.WriteStream;

  constructor(jsonlPath: string) {
    this.jsonlStream = fs.createWriteStream(jsonlPath, { encoding: 'utf-8' });
  }

  writeJsonlLine(acmsProfessionalId: string, serialized: SerializedState): void {
    this.jsonlStream.write(JSON.stringify({ acmsProfessionalId, ...serialized }) + '\n');
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.jsonlStream.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
  }
}

/**
 * Classifies a candidate for the console summary only (see outcomeByCandidate below) - inferred
 * from the pipeline's own serialized score history (last-write-wins per key, same rule the
 * pipeline itself uses for control flow): resolved if this candidate IS the match, rejected-name
 * if its nameScore never cleared calculateNameScore's threshold, rejected-corroboration if it did
 * but nothing resolved and it was the only qualifying candidate in its group,
 * rejected-ambiguous-group if it did and multiple candidates qualified.
 */
function classifyCandidate(
  trusteeId: string,
  resolvedTrusteeId: string | undefined,
  nameQualifyingCount: number,
  nameQualifies: boolean,
): CandidateOutcome {
  if (trusteeId === resolvedTrusteeId) return 'resolved';
  if (!nameQualifies) return 'rejected-name';
  return nameQualifyingCount === 1 ? 'rejected-corroboration' : 'rejected-ambiguous-group';
}

async function run() {
  console.log(
    '\nReplaying every trustee-professional-ids record (all dispositions) through ' +
      'runTrusteeMatchPipeline against current code...\n',
  );

  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error(
      'MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set, pointed at a disposable ' +
        "local Mongo container — see this file's header comment. Do NOT point this at the " +
        'shared cams-local-infra-mongo container.',
    );
  }
  // This script deleteMany()s + insertMany()s the trustees collection wholesale (see
  // seedTrustees below) - an enforced check, not just the comment above, since a wrong host here
  // wipes a real trustees collection.
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(uri)) {
    throw new Error(
      `Refusing to run against a non-local Mongo host: ${uri}. This script wipes the trustees ` +
        'collection - only a disposable local container is safe.',
    );
  }

  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const trusteeById = new Map(trustees.map((t) => [t.trusteeId, t]));
  const trusteeNameById = new Map(trustees.map((t) => [t.trusteeId, t.name]));
  const errored = records.filter((r) => r.evidence?.sourceRaw);
  console.log(`${errored.length} records to replay (all dispositions, including auto-linked).\n`);

  await seedTrustees(uri, dbName, trustees);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const jsonlPath = path.join(DATA_DIR, 'replay-backtest-report.jsonl');
  const report = new ReportWriter(jsonlPath);

  const context = await buildRealApplicationContext();
  const { shouldSkipAsNotAPerson, isRecordDisavowed } =
    await import('../../../../backend/lib/use-cases/dataflows/acms-name-normalization.helpers');
  const { runTrusteeMatchPipeline } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline-orchestrator');
  const { serializeState } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline');
  const { deriveDisposition, deriveSuspectDuplicateCamsTrustee } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types');

  const outcomeCounts = {
    resolved: 0,
    ambiguous: 0,
    'no-match': 0,
    skipped: 0,
  };
  let suspectDuplicateCamsTrusteeCount = 0;
  const outcomeByCandidate: Record<CandidateOutcome, number> = {
    resolved: 0,
    'rejected-name': 0,
    'rejected-corroboration': 0,
    'rejected-ambiguous-group': 0,
  };
  let candidateRowCount = 0;
  const divergences: Divergence[] = [];
  const divergenceDetailRows: string[][] = [];

  let i = 0;
  for (const record of errored) {
    i++;
    if (i % 250 === 0) console.log(`  ...${i}/${errored.length}`);

    const acmsTrusteeProfessional = record.evidence.sourceRaw;
    const stagingTrusteeId = record.disposition === 'auto-linked' ? record.camsTrusteeId : null;

    if (
      shouldSkipAsNotAPerson(acmsTrusteeProfessional.fullName) ||
      isRecordDisavowed(acmsTrusteeProfessional)
    ) {
      outcomeCounts.skipped++;
      if (record.disposition !== 'skipped') {
        const stagingTrustee = stagingTrusteeId ? trusteeById.get(stagingTrusteeId) : undefined;
        const divergence: Divergence = {
          acmsProfessionalId: record.acmsProfessionalId,
          acmsFullName: acmsTrusteeProfessional.fullName,
          acmsAddress: acmsAddressString(acmsTrusteeProfessional.legacy),
          acmsPhone: acmsTrusteeProfessional.legacy?.phone ?? '',
          stagingDisposition: record.disposition,
          stagingTrusteeId,
          stagingTrusteeAddress: trusteeAddressString(stagingTrustee?.public?.address),
          stagingTrusteePhone: stagingTrustee?.public?.phone?.number ?? '',
          currentDisposition: 'skipped',
          currentTrusteeId: null,
          currentTrusteeAddress: '',
          currentTrusteePhone: '',
        };
        divergences.push(divergence);
        divergenceDetailRows.push(
          ...divergenceCandidateRows(divergence, [], undefined, trusteeNameById),
        );
      }
      continue;
    }

    const state = await runTrusteeMatchPipeline(context, acmsTrusteeProfessional);
    const serialized = serializeState(state);

    report.writeJsonlLine(record.acmsProfessionalId, serialized);

    // Uses the real production deriveDisposition rather than re-deriving the same rule here, so
    // this script's reported counts match what sync-acms-professional-ids.ts would actually persist.
    const disposition = deriveDisposition(serialized);
    const finalOutcome: 'resolved' | 'ambiguous' | 'no-match' =
      disposition === 'auto-linked'
        ? 'resolved'
        : disposition === 'ambiguous'
          ? 'ambiguous'
          : 'no-match';
    outcomeCounts[finalOutcome]++;
    if (disposition === 'ambiguous' && deriveSuspectDuplicateCamsTrustee(serialized)) {
      suspectDuplicateCamsTrusteeCount++;
    }

    // False-positive detection: staging vs. current disagree on either the disposition or, for a
    // record BOTH sides call auto-linked, which trusteeId it resolved to. Every other combination
    // (disposition unchanged, or an intentional improvement/regression already visible in
    // outcomeCounts) is normal drift, not flagged here - this is specifically for "staging trusts
    // this link and current code contradicts it," or vice versa. A staging export written before
    // ambiguous-duplication was folded back into a plain 'ambiguous' disposition (plus a separate
    // suspectDuplicateCamsTrustee flag) still carries the old string value, so it's normalized
    // here for comparison only - it was never a different disposition from current code's
    // perspective, just an older persisted shape.
    const normalizedStagingDisposition =
      record.disposition === 'ambiguous-duplication' ? 'ambiguous' : record.disposition;
    const currentTrusteeId =
      disposition === 'auto-linked' ? (state.match?.trusteeId ?? null) : null;
    const dispositionsDiffer = disposition !== normalizedStagingDisposition;
    const sameDispositionDifferentTrustee =
      disposition === 'auto-linked' &&
      normalizedStagingDisposition === 'auto-linked' &&
      currentTrusteeId !== stagingTrusteeId;
    if (dispositionsDiffer || sameDispositionDifferentTrustee) {
      const resolvedBy = state.match?.resolvedBy;
      const stagingTrustee = stagingTrusteeId ? trusteeById.get(stagingTrusteeId) : undefined;
      const currentCandidate = currentTrusteeId
        ? serialized.candidates.find((c) => c.camsRaw.trusteeId === currentTrusteeId)
        : undefined;
      const divergence: Divergence = {
        acmsProfessionalId: record.acmsProfessionalId,
        acmsFullName: acmsTrusteeProfessional.fullName,
        acmsAddress: acmsAddressString(acmsTrusteeProfessional.legacy),
        acmsPhone: acmsTrusteeProfessional.legacy?.phone ?? '',
        stagingDisposition: record.disposition,
        stagingTrusteeId,
        stagingTrusteeAddress: trusteeAddressString(stagingTrustee?.public?.address),
        stagingTrusteePhone: stagingTrustee?.public?.phone?.number ?? '',
        currentDisposition: disposition,
        currentTrusteeId,
        currentTrusteeAddress: trusteeAddressString(currentCandidate?.camsRaw.address),
        currentTrusteePhone: currentCandidate?.camsRaw.phone?.number ?? '',
      };
      divergences.push(divergence);
      divergenceDetailRows.push(
        ...divergenceCandidateRows(divergence, serialized.candidates, resolvedBy, trusteeNameById),
      );
    }

    // nameQualifyingCount mirrors classifyCandidate's group-size rule: how many candidates in
    // THIS record's pool cleared calculateNameScore's threshold, regardless of which stage scored
    // them - needed to distinguish a lone qualifying candidate that still failed corroboration
    // (rejected-corroboration) from one of several that left the group genuinely ambiguous
    // (rejected-ambiguous-group).
    const nameQualifyingCount = serialized.candidates.filter(
      (c) => c.scores.doesNameMatch?.pass === true,
    ).length;

    for (const candidate of serialized.candidates) {
      const candidateOutcome = classifyCandidate(
        candidate.camsRaw.trusteeId,
        state.match?.trusteeId,
        nameQualifyingCount,
        candidate.scores.doesNameMatch?.pass === true,
      );
      outcomeByCandidate[candidateOutcome]++;
      candidateRowCount++;
    }
  }

  console.log('\n=== Replay outcome (current main vs. what was actually persisted) ===\n');
  for (const [k, v] of Object.entries(outcomeCounts)) {
    console.log(
      `  ${k.padEnd(20)} ${v.toString().padStart(6)}  (${((v / errored.length) * 100).toFixed(1)}%)`,
    );
  }
  console.log(
    `    of which suspectDuplicateCamsTrustee: ${suspectDuplicateCamsTrusteeCount} ` +
      `(${((suspectDuplicateCamsTrusteeCount / errored.length) * 100).toFixed(1)}%)`,
  );

  console.log(`\nTotal candidates across all records: ${candidateRowCount}`);
  console.log('Candidates by outcome:');
  for (const [k, v] of Object.entries(outcomeByCandidate)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  const falsePositiveCandidates = divergences.filter((d) => d.stagingDisposition === 'auto-linked');
  console.log(
    `\n=== Divergences: staging vs. current pipeline (${divergences.length} of ${errored.length}) ===\n`,
  );
  console.log(
    `  Staging said auto-linked, current code disagrees: ${falsePositiveCandidates.length} ` +
      '(false-positive risk - staging trusted a link current code no longer reaches the same way)',
  );
  console.log(
    `  All other direction changes (improvement/regression away from a non-auto-linked staging ` +
      `disposition): ${divergences.length - falsePositiveCandidates.length}`,
  );

  if (divergences.length > 0) {
    const divergenceDetailCsvPath = path.join(DATA_DIR, 'replay-backtest-divergences-detail.csv');
    const detailLines = [
      DIVERGENCE_DETAIL_COLUMNS.join(','),
      ...divergenceDetailRows.map((row) => row.map(csvEscape).join(',')),
    ];
    fs.writeFileSync(divergenceDetailCsvPath, detailLines.join('\n') + '\n', 'utf-8');
    console.log(
      `\nWrote ${divergenceDetailRows.length} divergence rows (one per candidate in each diverged ` +
        `record's pool) to ${divergenceDetailCsvPath}`,
    );
  }

  await report.close();
  console.log(`\nWrote full pipeline state for each replayed record to ${jsonlPath}`);

  console.log(
    `\nConclusion: replaying ${errored.length} staging records through the current pipeline ` +
      `resolves ${outcomeCounts.resolved} (${((outcomeCounts.resolved / errored.length) * 100).toFixed(1)}%), with ` +
      `${divergences.length} record(s) whose disposition/trusteeId disagrees with what staging ` +
      `actually persisted (see the divergences CSV above for detail).`,
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
