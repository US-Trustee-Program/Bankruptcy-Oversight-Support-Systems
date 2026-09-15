/**
 * Backtest (NOT a harness, not committed anywhere as a regression gate): replays every real
 * error-disposition (no-match/ambiguous) record from a staging trustee-professional-ids export
 * through the ACTUAL, unmodified current-`main`-branch matching pipeline
 * (runTrusteeMatchPipeline, trustee-match-pipeline-orchestrator.ts).
 *
 * Calls the real, exported toAcmsTrusteeProfessional/shouldSkipAsNotAPerson
 * (sync-acms-professional-ids.ts) and the real runTrusteeMatchPipeline directly - there is no
 * separate reimplementation of matching logic to keep in sync with production.
 *
 * Requires a REAL local MongoDB (not the mocked in-memory adapter) — searchTrusteesByNameScored's
 * phonetic-token matching is a Mongo aggregation pipeline stage that cannot be faithfully
 * replicated outside Mongo. Seeds a disposable local trustees collection from a trustees export,
 * then calls the real repository/matching code unmodified via a real (non-mocked)
 * ApplicationContext.
 *
 * Every run writes two files to ./data (repo root, gitignored — real trustee PII, never
 * committed):
 *   - data/replay-backtest-report.csv: one row per (record, candidate) pair, ACMS/CAMS field pairs
 *     for visual scanning, sorted by fullNameSimilarity within each record - consumed by the
 *     AI-review tooling (ai-candidate-review.ts).
 *   - data/replay-backtest-report.jsonl: one JSON line per record, the FULL serialized pipeline
 *     state (serializeState) - every candidate's complete score history from every stage that
 *     touched it, not just the winner. This is the reactive-investigation record: for an
 *     ambiguous/no-match record, a reviewer can see exactly which stages ran, what each one
 *     concluded, and why the pipeline didn't collapse to a match.
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
import * as natural from 'natural';
import { getNameVariations } from 'name-match/src/name-normalizer';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';
import { AcmsTrusteeProfessionalDetailRecord } from '../../../../backend/lib/use-cases/gateways.types';
import {
  ProjectedTrustee,
  SerializedState,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline';

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
 * The persisted `variant` string carries a DIFFERENT shape than the live
 * AcmsTrusteeProfessionalDetailRecord toAcmsTrusteeProfessional/shouldSkipAsNotAPerson expect
 * (cityStateZipCountry as one combined string vs. separate city/state/zip; middleName vs.
 * middleInitial) - this adapts the decoded historical variant back into the live record shape so
 * this backtest can call the exact same production functions live sync calls, rather than
 * reimplementing their logic. address2/address3 are joined into address1 (the live record only
 * has two address line fields; decoded variants keep three), and cityStateZipCountry is passed
 * through as `city` alone (state/zip are folded into it already) since
 * toAcmsTrusteeProfessional's legacy composition only needs SOME representation of the combined
 * string to end up in cityStateZipCountry, not a byte-exact round trip through the original
 * separate fields (which the persisted variant no longer has).
 */
function toDetailRecord(
  acmsProfessionalId: string,
  variant: DecodedVariant,
): AcmsTrusteeProfessionalDetailRecord {
  return {
    acmsProfessionalId,
    ustProfCode: 0,
    firstName: variant.firstName,
    lastName: variant.lastName,
    middleInitial: variant.middleName || undefined,
    address1:
      [variant.address1, variant.address2, variant.address3].filter(Boolean).join(', ') ||
      undefined,
    phone: variant.phone || undefined,
    fax: variant.fax || undefined,
    // toAcmsLegacy composes cityStateZipCountry via formatCityStateZipCountry(city, state,
    // formatAcmsZip(zip), undefined) - passing the already-combined string as `city` alone with
    // state/zip omitted reproduces the same final cityStateZipCountry value, since
    // formatCityStateZipCountry just joins whatever non-empty parts it's given.
    city: variant.cityStateZipCountry || undefined,
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

type CandidateOutcome =
  'resolved' | 'rejected-name' | 'rejected-corroboration' | 'rejected-ambiguous-group';

type CandidateRow = {
  acmsProfessionalId: string;
  acmsFullName: string;
  acmsAddress: string;
  acmsPhone: string;
  introductionStage: string;
  candidateOutcome: CandidateOutcome;
  camsTrusteeId: string;
  camsName: string;
  camsAddress: string;
  camsPhone: string;
  nameScore: number;
  addressScore: number | null;
  phoneScore: number | null;
  fullNameSimilarity: number;
  tokenNameMatchRate: number;
  surnameExactMatch: boolean;
  notes: string;
};

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvEscape).join(',');
}

function normalizeForSimilarity(name: string): string {
  return name.toLowerCase().replaceAll("'", '').replace(/[.,-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fullNameSimilarity(acmsFullName: string, camsName: string): number {
  const a = normalizeForSimilarity(acmsFullName);
  const b = normalizeForSimilarity(camsName);
  if (!a || !b) return 0;
  return Math.round(natural.JaroWinklerDistance(a, b) * 1000) / 1000;
}

function isInitialOf(a: string, b: string): boolean {
  return a.length === 1 && b.length > 0 && b.startsWith(a);
}

function isNicknamePair(a: string, b: string): boolean {
  try {
    if ((getNameVariations(a) as string[]).includes(b)) return true;
  } catch {
    // No variations available for a.
  }
  try {
    if ((getNameVariations(b) as string[]).includes(a)) return true;
  } catch {
    // No variations available for b.
  }
  return false;
}

function tokenNameMatchRate(acmsFullName: string, camsName: string): number {
  const acmsTokens = normalizeForSimilarity(acmsFullName).split(' ').filter(Boolean);
  const camsTokens = normalizeForSimilarity(camsName).split(' ').filter(Boolean);
  if (acmsTokens.length === 0) return 0;
  let matched = 0;
  for (const at of acmsTokens) {
    const hit = camsTokens.some(
      (ct) => at === ct || isInitialOf(at, ct) || isInitialOf(ct, at) || isNicknamePair(at, ct),
    );
    if (hit) matched++;
  }
  return Math.round((matched / acmsTokens.length) * 1000) / 1000;
}

function buildNotes(
  nameScore: number,
  addressScore: number | null,
  phoneScore: number | null,
  similarity: number,
  tokenMatchRate: number,
): string {
  const notes: string[] = [];
  if (nameScore >= 85 && (addressScore ?? 0) < 50 && phoneScore !== 100) {
    notes.push('name matches but corroboration (address/phone) is weak');
  }
  if (nameScore < 85 && ((addressScore ?? 0) >= 80 || phoneScore === 100)) {
    notes.push('strong address/phone despite weak name score');
  }
  if (phoneScore === 0) {
    notes.push('phone present on both sides but disagrees');
  }
  if (similarity >= 0.85 && nameScore < 85) {
    notes.push(
      'high full-name similarity despite low structured nameScore (possible nickname/reorder)',
    );
  }
  if (similarity < 0.5 && nameScore >= 85) {
    notes.push('low full-name similarity despite high structured nameScore (verify by eye)');
  }
  if (tokenMatchRate === 1 && similarity < 0.7 && nameScore < 85) {
    notes.push(
      'every ACMS token matches some CAMS token but low char-similarity (likely nickname/reorder)',
    );
  }
  if (tokenMatchRate === 1 && similarity >= 0.7 && nameScore < 85) {
    notes.push(
      'all tokens match and names look similar but structured nameScore still low (verify surname)',
    );
  }
  return notes.join('; ');
}

const REPORT_HEADER = [
  'acmsProfessionalId',
  'introductionStage',
  'candidateOutcome',
  'acmsFullName',
  'camsName',
  'surnameExactMatch',
  'nameScore',
  'fullNameSimilarity',
  'tokenNameMatchRate',
  'acmsAddress',
  'camsAddress',
  'addressScore',
  'acmsPhone',
  'camsPhone',
  'phoneScore',
  'camsTrusteeId',
  'notes',
];

/** Streams both the CSV and JSONL reports one record at a time - a record's candidate pool can
 * range from 0 to several hundred, so buffering every row across the whole population before
 * writing risks holding tens of thousands of objects in memory at once for no reason. */
class ReportWriter {
  private readonly csvStream: fs.WriteStream;
  private readonly jsonlStream: fs.WriteStream;
  private rowCount = 0;

  constructor(csvPath: string, jsonlPath: string) {
    this.csvStream = fs.createWriteStream(csvPath, { encoding: 'utf-8' });
    this.csvStream.write(csvRow(REPORT_HEADER) + '\n');
    this.jsonlStream = fs.createWriteStream(jsonlPath, { encoding: 'utf-8' });
  }

  writeCsvRow(r: CandidateRow): void {
    this.csvStream.write(
      csvRow([
        r.acmsProfessionalId,
        r.introductionStage,
        r.candidateOutcome,
        r.acmsFullName,
        r.camsName,
        r.surnameExactMatch,
        r.nameScore,
        r.fullNameSimilarity,
        r.tokenNameMatchRate,
        r.acmsAddress,
        r.camsAddress,
        r.addressScore,
        r.acmsPhone,
        r.camsPhone,
        r.phoneScore,
        r.camsTrusteeId,
        r.notes,
      ]) + '\n',
    );
    this.rowCount++;
  }

  writeJsonlLine(acmsProfessionalId: string, serialized: SerializedState): void {
    this.jsonlStream.write(JSON.stringify({ acmsProfessionalId, ...serialized }) + '\n');
  }

  async close(): Promise<number> {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.csvStream.end((error?: Error | null) => (error ? reject(error) : resolve()));
      }),
      new Promise<void>((resolve, reject) => {
        this.jsonlStream.end((error?: Error | null) => (error ? reject(error) : resolve()));
      }),
    ]);
    return this.rowCount;
  }
}

function acmsAddressString(cityStateZipCountry: string, address1: string): string {
  return [address1, cityStateZipCountry].filter(Boolean).join(', ');
}

function camsAddressString(candidate: ProjectedTrustee): string {
  const a = candidate.address;
  if (!a) return '';
  return [a.address1, [a.city, a.state, a.zipCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

/**
 * Derives this backtest's per-candidate CSV columns from the pipeline's own serialized score
 * history, rather than re-deriving scores separately: candidateOutcome is inferred from the
 * candidate's merged score (last-write-wins per key, same rule the pipeline itself uses for
 * control flow) - resolved if this candidate IS the match, rejected-name if its nameScore never
 * cleared calculateNameScore's threshold, rejected-corroboration if it did but nothing resolved
 * and it was the only qualifying candidate in its group, rejected-ambiguous-group if it did and
 * multiple candidates qualified.
 */
function classifyCandidate(
  trusteeId: string,
  resolvedTrusteeId: string | undefined,
  nameQualifyingCount: number,
  candidateNameScore: number,
): CandidateOutcome {
  if (trusteeId === resolvedTrusteeId) return 'resolved';
  if (candidateNameScore < 85) return 'rejected-name';
  return nameQualifyingCount === 1 ? 'rejected-corroboration' : 'rejected-ambiguous-group';
}

async function run() {
  console.log(
    '\nReplaying error-disposition trustee-professional-ids records through runTrusteeMatchPipeline\n' +
      '(the pipeline-based successor to processNameMatch)...\n',
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

  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const errored = records.filter((r) => r.error && r.variant);
  console.log(`${errored.length} error-disposition records to replay.\n`);

  await seedTrustees(uri, dbName, trustees);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const csvPath =
    process.env.REPLAY_BACKTEST_REPORT_CSV ?? path.join(DATA_DIR, 'replay-backtest-report.csv');
  const jsonlPath = path.join(DATA_DIR, 'replay-backtest-report.jsonl');
  const report = new ReportWriter(csvPath, jsonlPath);

  const context = await buildRealApplicationContext();
  const { toAcmsTrusteeProfessional, shouldSkipAsNotAPerson } =
    await import('../../../../backend/lib/use-cases/dataflows/sync-acms-professional-ids');
  const { runTrusteeMatchPipeline } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline-orchestrator');
  const { serializeState } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline');

  const outcomeCounts = { resolved: 0, ambiguous: 0, 'no-match': 0, skipped: 0 };
  const outcomeByCandidate: Record<CandidateOutcome, number> = {
    resolved: 0,
    'rejected-name': 0,
    'rejected-corroboration': 0,
    'rejected-ambiguous-group': 0,
  };
  let candidateRowCount = 0;

  let i = 0;
  for (const record of errored) {
    i++;
    if (i % 250 === 0) console.log(`  ...${i}/${errored.length}`);

    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const detailRecord = toDetailRecord(record.acmsProfessionalId, decoded);

    if (shouldSkipAsNotAPerson(detailRecord.firstName, detailRecord.lastName)) {
      outcomeCounts.skipped++;
      continue;
    }

    const acmsTrusteeProfessional = toAcmsTrusteeProfessional(detailRecord);
    const state = await runTrusteeMatchPipeline(context, acmsTrusteeProfessional);
    const serialized = serializeState(state);

    report.writeJsonlLine(record.acmsProfessionalId, serialized);

    const finalOutcome: 'resolved' | 'ambiguous' | 'no-match' = state.match
      ? 'resolved'
      : serialized.candidates.length > 0
        ? 'ambiguous'
        : 'no-match';
    outcomeCounts[finalOutcome]++;

    const acmsAddress = acmsAddressString(
      acmsTrusteeProfessional.legacy?.cityStateZipCountry ?? '',
      acmsTrusteeProfessional.legacy?.address1 ?? '',
    );
    const acmsPhone = acmsTrusteeProfessional.legacy?.phone ?? '';

    // nameQualifyingCount mirrors classifyCandidate's group-size rule: how many candidates in
    // THIS record's pool cleared calculateNameScore's threshold, regardless of which stage scored
    // them - needed to distinguish a lone qualifying candidate that still failed corroboration
    // (rejected-corroboration) from one of several that left the group genuinely ambiguous
    // (rejected-ambiguous-group).
    const nameQualifyingCount = serialized.candidates.filter(
      (c) => (Object.assign({}, ...c.scores).nameScore ?? 0) >= 85,
    ).length;

    const rows: CandidateRow[] = serialized.candidates.map((candidate) => {
      // The winning candidate's addressScore/phoneScore live on state.match.score (a CandidateScore
      // from resolveByContactCorroboration/resolveDuplicateNameCandidates, see corroborationStage) -
      // that object is never pushed through addScore onto candidate.scores itself, so it must be
      // merged in here for the one row where candidate.camsRaw.trusteeId === state.match?.trusteeId.
      const isWinner = candidate.camsRaw.trusteeId === state.match?.trusteeId;
      const merged = Object.assign(
        {},
        ...candidate.scores,
        isWinner ? state.match?.score : {},
      ) as Record<string, unknown>;
      const nameScore = typeof merged.nameScore === 'number' ? merged.nameScore : 0;
      const addressScore = typeof merged.addressScore === 'number' ? merged.addressScore : null;
      const phoneScore = typeof merged.phoneScore === 'number' ? merged.phoneScore : null;
      const similarity = fullNameSimilarity(
        acmsTrusteeProfessional.fullName,
        candidate.camsRaw.name,
      );
      const tokenMatchRate = tokenNameMatchRate(
        acmsTrusteeProfessional.fullName,
        candidate.camsRaw.name,
      );
      const candidateOutcome = classifyCandidate(
        candidate.camsRaw.trusteeId,
        state.match?.trusteeId,
        nameQualifyingCount,
        nameScore,
      );
      return {
        acmsProfessionalId: record.acmsProfessionalId,
        acmsFullName: acmsTrusteeProfessional.fullName,
        acmsAddress,
        acmsPhone,
        introductionStage: typeof merged.scorer === 'string' ? merged.scorer : 'unknown',
        candidateOutcome,
        camsTrusteeId: candidate.camsRaw.trusteeId,
        camsName: candidate.camsRaw.name,
        camsAddress: camsAddressString(candidate.camsRaw),
        camsPhone: candidate.camsRaw.phone?.number ?? '',
        nameScore,
        addressScore,
        phoneScore,
        fullNameSimilarity: similarity,
        tokenNameMatchRate: tokenMatchRate,
        surnameExactMatch:
          typeof merged.stateMismatch === 'boolean' ? !merged.stateMismatch : false,
        notes: buildNotes(nameScore, addressScore, phoneScore, similarity, tokenMatchRate),
      };
    });
    rows.sort((a, b) => b.fullNameSimilarity - a.fullNameSimilarity);
    for (const row of rows) {
      report.writeCsvRow(row);
      outcomeByCandidate[row.candidateOutcome]++;
      candidateRowCount++;
    }
  }

  console.log('\n=== Replay outcome (current main vs. what was actually persisted) ===\n');
  for (const [k, v] of Object.entries(outcomeCounts)) {
    console.log(
      `  ${k.padEnd(20)} ${v.toString().padStart(6)}  (${((v / errored.length) * 100).toFixed(1)}%)`,
    );
  }

  console.log(`\nTotal candidate rows across all records: ${candidateRowCount}`);
  console.log('Candidate rows by outcome:');
  for (const [k, v] of Object.entries(outcomeByCandidate)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  const writtenRowCount = await report.close();
  console.log(`\nWrote ${writtenRowCount} candidate rows to ${csvPath}`);
  console.log(`Wrote full pipeline state for each replayed record to ${jsonlPath}`);

  console.log(
    `\nConclusion: a full purge + re-sync against current main would recover ` +
      `${outcomeCounts.resolved} of ${errored.length} (${((outcomeCounts.resolved / errored.length) * 100).toFixed(1)}%) ` +
      `of this export's error population WITHOUT any matcher code change beyond what's already on main.`,
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
