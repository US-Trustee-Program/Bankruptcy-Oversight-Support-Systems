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
 * Every run writes a per-CANDIDATE CSV report to ./data (repo root, gitignored — real trustee
 * PII, never committed) at data/replay-backtest-report.csv: one row per (record, raw candidate)
 * pair — a genuine cartesian product, since a record's candidate pool can range from 0 to 909 —
 * with fields laid out in ACMS/CAMS pairs (acmsFullName next to camsName, acmsAddress next to
 * camsAddress, etc.) for left-right visual scanning, rather than grouped by pipeline stage. Each
 * row also carries introductionStage (the first stage that surfaced this specific candidate) and
 * candidateOutcome (what happened to THIS candidate specifically — resolved / rejected at the
 * name gate / rejected at corroboration / part of a group that stayed ambiguous), plus
 * fullNameSimilarity (see FULL_NAME_SIMILARITY NOTE below) and a short auto-generated note.
 *
 * FULL_NAME_SIMILARITY NOTE: this is natural.JaroWinklerDistance (already a project dependency)
 * on the normalized (lowercased, punctuation-stripped) full names — a coarse, cheap SIGNAL for
 * cutting a long noise tail (an 18- or 909-candidate list down to a handful worth a human's
 * attention), NOT a surname-aware replacement for calculateNameScore/the existing lastName-token
 * exact-match discipline. It does NOT reliably catch a same-surname-different-person false
 * positive (confirmed: "William Van Arsdale" vs "William A. Van Meter" scores 0.87 despite being
 * two different real trustees — in the same range as genuine matches). Never auto-resolve or prune
 * candidates off this score alone; it's here for visual/AI triage only.
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
import * as natural from 'natural';
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

type IntroductionStage = 'matchTrusteeByName' | 'tokenIntersection' | 'levenshtein';

type CandidateOutcome =
  | 'resolved'
  | 'rejected-name'
  | 'rejected-corroboration'
  | 'rejected-ambiguous-group';

type CandidateRow = {
  acmsProfessionalId: string;
  acmsFullName: string;
  acmsAddress: string;
  acmsPhone: string;
  introductionStage: IntroductionStage;
  candidateOutcome: CandidateOutcome;
  camsTrusteeId: string;
  camsName: string;
  camsAddress: string;
  camsPhone: string;
  score: Score;
  fullNameSimilarity: number;
  notes: string;
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

/** Lowercase, drop punctuation, collapse whitespace — same normalization shape as
 * stripNamePunctuation in trustee-match.helpers.ts, reimplemented here rather than imported since
 * it's module-private. Applied before fullNameSimilarity so case/punctuation differences don't
 * masquerade as real dissimilarity. */
function normalizeForSimilarity(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("'", '')
    .replace(/[.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fullNameSimilarity(acmsFullName: string, camsName: string): number {
  const a = normalizeForSimilarity(acmsFullName);
  const b = normalizeForSimilarity(camsName);
  if (!a || !b) return 0;
  return Math.round(natural.JaroWinklerDistance(a, b) * 1000) / 1000;
}

function buildNotes(score: Score, similarity: number): string {
  const notes: string[] = [];
  if (score.nameScore >= 85 && score.addressScore < 50 && score.phoneScore !== 100) {
    notes.push('name matches but corroboration (address/phone) is weak');
  }
  if (score.nameScore < 85 && (score.addressScore >= 80 || score.phoneScore === 100)) {
    notes.push('strong address/phone despite weak name score');
  }
  if (score.phoneScore === 0) {
    notes.push('phone present on both sides but disagrees');
  }
  if (similarity >= 0.85 && score.nameScore < 85) {
    notes.push('high full-name similarity despite low structured nameScore (possible nickname/reorder)');
  }
  if (similarity < 0.5 && score.nameScore >= 85) {
    notes.push('low full-name similarity despite high structured nameScore (verify by eye)');
  }
  return notes.join('; ');
}

const REPORT_HEADER = [
  'acmsProfessionalId',
  'introductionStage',
  'candidateOutcome',
  'acmsFullName',
  'camsName',
  'nameScore',
  'fullNameSimilarity',
  'acmsAddress',
  'camsAddress',
  'addressScore',
  'acmsPhone',
  'camsPhone',
  'phoneScore',
  'camsTrusteeId',
  'notes',
];

/**
 * A record's candidate pool ranges from 0 to 909 - buffering every CandidateRow across all 2734
 * records before writing risks holding tens of thousands of objects in memory at once for no
 * reason. Opens the file once and writes each row as it's produced instead.
 */
class ReportWriter {
  private readonly stream: fs.WriteStream;
  private rowCount = 0;

  constructor(reportPath: string) {
    this.stream = fs.createWriteStream(reportPath, { encoding: 'utf-8' });
    this.stream.write(csvRow(REPORT_HEADER) + '\n');
  }

  writeRow(r: CandidateRow): void {
    this.stream.write(
      csvRow([
        r.acmsProfessionalId,
        r.introductionStage,
        r.candidateOutcome,
        r.acmsFullName,
        r.camsName,
        r.score.nameScore,
        r.fullNameSimilarity,
        r.acmsAddress,
        r.camsAddress,
        r.score.addressScore,
        r.acmsPhone,
        r.camsPhone,
        r.score.phoneScore,
        r.camsTrusteeId,
        r.notes,
      ]) + '\n',
    );
    this.rowCount++;
  }

  async close(): Promise<number> {
    await new Promise<void>((resolve, reject) => {
      this.stream.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
    return this.rowCount;
  }
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

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const reportPath = path.join(DATA_DIR, 'replay-backtest-report.csv');
  const report = new ReportWriter(reportPath);

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

  /** Same composition as sync-acms-professional-ids.ts's module-private
   * resolveCandidatesByCorroboration (exported primitives, same order) - returns the resolved
   * trusteeId (if any) plus the raw ids that CLEARED the name-qualify bar inside
   * resolveByContactCorroboration, so the caller can classify every candidate's fate precisely
   * (rejected-name vs rejected-corroboration vs rejected-ambiguous-group). */
  async function resolveCandidatesByCorroboration(
    acmsTrusteeProfessional: AcmsTrusteeProfessional,
    candidateTrusteeIds: string[],
  ): Promise<{ resolvedTrusteeId: string | null; nameQualifyingIds: Set<string> }> {
    if (candidateTrusteeIds.length === 0) {
      return { resolvedTrusteeId: null, nameQualifyingIds: new Set() };
    }
    const corroboration = await resolveByContactCorroboration(context, acmsTrusteeProfessional, candidateTrusteeIds);
    const nameQualifyingIds = new Set(
      corroboration.kind !== 'no-match'
        ? corroboration.candidateScores.filter((c) => c.nameScore >= 85).map((c) => c.trusteeId)
        : [],
    );
    if (corroboration.kind === 'resolved') {
      return { resolvedTrusteeId: corroboration.trusteeId, nameQualifyingIds };
    }
    const duplicateResolution = await resolveDuplicateNameCandidates(context, acmsTrusteeProfessional, candidateTrusteeIds);
    if (duplicateResolution.kind === 'resolved-duplicate') {
      return { resolvedTrusteeId: duplicateResolution.trusteeId, nameQualifyingIds };
    }
    return { resolvedTrusteeId: null, nameQualifyingIds };
  }

  function classifyCandidate(
    trusteeId: string,
    resolvedTrusteeId: string | null,
    nameQualifyingIds: Set<string>,
  ): CandidateOutcome {
    if (trusteeId === resolvedTrusteeId) return 'resolved';
    if (!nameQualifyingIds.has(trusteeId)) return 'rejected-name';
    return nameQualifyingIds.size === 1 ? 'rejected-corroboration' : 'rejected-ambiguous-group';
  }

  const outcomeCounts = { resolved: 0, ambiguous: 0, 'no-match': 0 };
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
    const acmsTrusteeProfessional = toAcmsTrusteeProfessional(decoded);
    const acmsFullName = acmsTrusteeProfessional.fullName;
    const acmsAddress = acmsAddressString(acmsTrusteeProfessional);
    const acmsPhone = acmsTrusteeProfessional.legacy?.phone ?? '';

    // introducedAt: trusteeId -> first stage that surfaced it, so a candidate found by multiple
    // stages (e.g. matchTrusteeByName AND levenshtein) is reported once, at its earliest stage.
    const introducedAt = new Map<string, IntroductionStage>();
    const recordCandidateIds = new Set<string>();
    let resolvedTrusteeId: string | null = null;
    let finalOutcome: 'resolved' | 'ambiguous' | 'no-match';
    let nameQualifyingIds = new Set<string>();

    const nameResult = await matchTrusteeByName(context, acmsTrusteeProfessional);
    const rawIds = nameResult.kind === 'ambiguous' ? nameResult.matchCandidates.map((c) => c.trusteeId) : [];
    for (const id of rawIds) {
      introducedAt.set(id, 'matchTrusteeByName');
      recordCandidateIds.add(id);
    }

    if (nameResult.kind === 'resolved') {
      resolvedTrusteeId = nameResult.trusteeId;
      introducedAt.set(nameResult.trusteeId, 'matchTrusteeByName');
      recordCandidateIds.add(nameResult.trusteeId);
      nameQualifyingIds = new Set([nameResult.trusteeId]);
      finalOutcome = 'resolved';
    } else if (nameResult.kind === 'ambiguous') {
      const corroboration = await resolveCandidatesByCorroboration(acmsTrusteeProfessional, rawIds);
      nameQualifyingIds = corroboration.nameQualifyingIds;
      resolvedTrusteeId = corroboration.resolvedTrusteeId;

      if (!resolvedTrusteeId) {
        const levenshteinCandidates = await findAnchoredLevenshteinCandidates(context, acmsTrusteeProfessional);
        const levenshteinIds = levenshteinCandidates.map((t) => t.trusteeId);
        for (const id of levenshteinIds) {
          if (!introducedAt.has(id)) introducedAt.set(id, 'levenshtein');
          recordCandidateIds.add(id);
        }
        const levenshteinResult = await resolveCandidatesByCorroboration(acmsTrusteeProfessional, levenshteinIds);
        for (const id of levenshteinResult.nameQualifyingIds) nameQualifyingIds.add(id);
        resolvedTrusteeId = levenshteinResult.resolvedTrusteeId;
      }
      finalOutcome = resolvedTrusteeId ? 'resolved' : 'ambiguous';
    } else {
      const tokenIntersectionCandidates = await findTokenIntersectionCandidates(context, acmsTrusteeProfessional);
      const tokenIntersectionIds = tokenIntersectionCandidates.map((t) => t.trusteeId);
      for (const id of tokenIntersectionIds) {
        introducedAt.set(id, 'tokenIntersection');
        recordCandidateIds.add(id);
      }
      const tokenIntersectionResult = await resolveCandidatesByCorroboration(acmsTrusteeProfessional, tokenIntersectionIds);
      nameQualifyingIds = tokenIntersectionResult.nameQualifyingIds;
      resolvedTrusteeId = tokenIntersectionResult.resolvedTrusteeId;

      if (!resolvedTrusteeId) {
        const levenshteinCandidates = await findAnchoredLevenshteinCandidates(context, acmsTrusteeProfessional);
        const levenshteinIds = levenshteinCandidates.map((t) => t.trusteeId);
        for (const id of levenshteinIds) {
          if (!introducedAt.has(id)) introducedAt.set(id, 'levenshtein');
          recordCandidateIds.add(id);
        }
        const levenshteinResult = await resolveCandidatesByCorroboration(acmsTrusteeProfessional, levenshteinIds);
        for (const id of levenshteinResult.nameQualifyingIds) nameQualifyingIds.add(id);
        resolvedTrusteeId = levenshteinResult.resolvedTrusteeId;
      }
      finalOutcome = resolvedTrusteeId ? 'resolved' : 'no-match';
    }

    outcomeCounts[finalOutcome]++;

    for (const trusteeId of recordCandidateIds) {
      const trustee = trusteesById.get(trusteeId);
      if (!trustee) continue;
      const score = scoreCandidate(acmsTrusteeProfessional, trustee);
      const similarity = fullNameSimilarity(acmsFullName, trustee.name);
      const candidateOutcome = classifyCandidate(trusteeId, resolvedTrusteeId, nameQualifyingIds);
      report.writeRow({
        acmsProfessionalId: record.acmsProfessionalId,
        acmsFullName,
        acmsAddress,
        acmsPhone,
        introductionStage: introducedAt.get(trusteeId)!,
        candidateOutcome,
        camsTrusteeId: trustee.trusteeId,
        camsName: trustee.name,
        camsAddress: camsAddressString(trustee),
        camsPhone: trustee.public?.phone?.number ?? '',
        score,
        fullNameSimilarity: similarity,
        notes: buildNotes(score, similarity),
      });
      outcomeByCandidate[candidateOutcome]++;
      candidateRowCount++;
    }
  }

  console.log('\n=== Replay outcome (current main vs. what was actually persisted) ===\n');
  for (const [k, v] of Object.entries(outcomeCounts)) {
    console.log(`  ${k.padEnd(20)} ${v.toString().padStart(6)}  (${((v / errored.length) * 100).toFixed(1)}%)`);
  }

  console.log(`\nTotal candidate rows across all records: ${candidateRowCount}`);
  console.log('Candidate rows by outcome:');
  for (const [k, v] of Object.entries(outcomeByCandidate)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  const writtenRowCount = await report.close();
  console.log(`\nWrote ${writtenRowCount} candidate rows to ${reportPath}`);

  console.log(
    `\nConclusion: a full purge + re-sync against current main would recover ` +
      `${outcomeCounts.resolved} of ${errored.length} (${((outcomeCounts.resolved / errored.length) * 100).toFixed(1)}%) ` +
      `of this export's error population WITHOUT any matcher code change beyond what's already on ` +
      `main. See data/replay-backtest-report.csv for the full per-candidate trace.`,
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
