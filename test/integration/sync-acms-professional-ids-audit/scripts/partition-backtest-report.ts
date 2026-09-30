/**
 * One-off partitioning of data/replay-backtest-report.jsonl (produced by
 * pipeline-replay-backtest.ts) into flat per-disposition CSVs for human review:
 * data/no-match-acms-trustees.csv, data/ambiguous-acms-trustees.csv,
 * data/ambiguous-duplication-acms-trustees.csv (a filtered view of the ambiguous rows whose own
 * suspectDuplicateCamsTrustee flag is true), data/skipped-acms-trustees.csv.
 *
 * All four files share ONE column layout (CANDIDATE_CSV_COLUMNS) - every row is a cartesian
 * product, one row per (ACMS record, candidate) pair, same shape ai-candidate-review.ts's own CSV
 * output uses. skipped rows (never reach the pipeline at all - see below) and any record with zero
 * candidates still produce exactly one row, with every candidate-specific column blank - a record
 * with only ONE real candidate still produces exactly one ambiguous row, since deriveDisposition's
 * 'ambiguous' verdict does not require 2+ candidates (see its own doc comment). no-match records
 * genuinely can, and often do, have real REJECTED candidates (a name-score failure, or a lone
 * qualifying candidate that failed corroboration) - these are shown here too, not just the bare
 * ACMS source fields, so a reviewer can see exactly why nothing resolved.
 *
 * Every row carries stagingDisposition/stagingTrusteeId/stagingTrusteeName/stagingTrusteeAddress/
 * stagingTrusteePhone (what the trustee-professional-ids fixture actually persisted for this ACMS
 * record BEFORE this replay, looked up independently from the trustees fixture rather than copied
 * from any candidate row - staging's trustee is often not even a candidate in the current record's
 * pool) and currentDisposition (which of these four files this row belongs to, restated as a column
 * so a reviewer filtering/sorting a single exported CSV doesn't lose that context) - so the
 * staging-vs-current picture is visible without cross-referencing replay-backtest-divergences.csv.
 *
 * skipped records never reach the pipeline (skipAdministrativePlaceholder short-circuits before any
 * candidate discovery runs, and pipeline-replay-backtest.ts does not write them to the JSONL at
 * all), so this script re-derives that population directly from the professional-ids fixture's own
 * evidence.sourceRaw and the same three skip checks skipAdministrativePlaceholder itself runs
 * (shouldSkipAsNotAPerson, isRecordDisavowed, shouldSkipAsUstStaff) - all three, not a subset, so a
 * UST-annotated record is never miscounted as no-match here the way it would be if this script's
 * own skip check silently drifted from the real gate's.
 *
 * Usage (from test/integration/):
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/partition-backtest-report.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types';
import {
  ProjectedTrustee,
  ScoreByScorer,
  TrusteeSerializedState as SerializedState,
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
  return raw.map(stripMongoId);
}

function loadTrustees(): Trustee[] {
  const file = resolveFixtureFile('TRUSTEES_FIXTURE', 'trustees');
  const raw: (Record<string, unknown> & { _id?: MongoExtendedId })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  return raw
    .filter((doc) => doc.documentType === 'TRUSTEE')
    .map((doc) => stripMongoId(doc) as Trustee);
}

const CSV_COLUMNS = [
  'acmsProfessionalId',
  'firstName',
  'middleName',
  'lastName',
  'fullName',
  'address1',
  'cityStateZipCountry',
  'phone',
  'fax',
] as const;

function csvEscape(value: string | number | undefined): string {
  const s = value === undefined ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function csvRowFromSourceRaw(
  acmsProfessionalId: string,
  sourceRaw: SerializedState['sourceRaw'],
): Record<(typeof CSV_COLUMNS)[number], string> {
  return {
    acmsProfessionalId,
    firstName: sourceRaw.firstName ?? '',
    middleName: sourceRaw.middleName ?? '',
    lastName: sourceRaw.lastName ?? '',
    fullName: sourceRaw.fullName ?? '',
    address1: sourceRaw.legacy?.address1 ?? '',
    cityStateZipCountry: sourceRaw.legacy?.cityStateZipCountry ?? '',
    phone: sourceRaw.legacy?.phone ?? '',
    fax: sourceRaw.legacy?.fax ?? '',
  };
}

/** Shared cartesian-product columns across all four output files (no-match, ambiguous,
 * ambiguous-duplication, skipped): every ACMS source field, the staging before-picture, this row's
 * currentDisposition, and - for a row with a real candidate - that candidate's own fields and the
 * same scores ai-candidate-review.ts displays (nameScore/addressScore/phoneScore/stateMatch/
 * introductionStage). A record with zero candidates (skipped, or a no-match/ambiguous record with
 * an empty pool) still produces exactly one row, with every candidate-specific column (camsTrusteeId
 * onward) blank - see candidateCsvRows's own doc comment.
 *
 * stagingDisposition/stagingTrusteeId/stagingTrusteeName/stagingTrusteeAddress/stagingTrusteePhone
 * carry what staging actually persisted for this ACMS record BEFORE this replay - repeated
 * identically on every candidate row for the same acmsProfessionalId. Looked up independently from
 * the trustees fixture by stagingTrusteeId, NOT copied from camsAddress/camsPhone below - staging's
 * trustee is often not even a candidate in the current record's pool (a divergence can mean the
 * current pipeline no longer discovers that trustee as a candidate at all, not just that it declined
 * to link to one still present), so those two fields would silently read empty for exactly the rows
 * this is meant to explain. currentDisposition is which of the four output files this row belongs
 * to, restated as a column so a reviewer filtering/sorting a single exported CSV doesn't lose that
 * context once rows from multiple files are combined. */
const CANDIDATE_CSV_COLUMNS = [
  ...CSV_COLUMNS,
  'stagingDisposition',
  'stagingTrusteeId',
  'stagingTrusteeName',
  'stagingTrusteeAddress',
  'stagingTrusteePhone',
  'currentDisposition',
  'suspectDuplicateCamsTrustee',
  'camsTrusteeId',
  'camsName',
  'camsAddress',
  'camsPhone',
  'introductionStage',
  'nameScore',
  'addressScore',
  'phoneScore',
  'stateMatch',
] as const;

type CandidateCsvRow = Record<(typeof CANDIDATE_CSV_COLUMNS)[number], string>;

function writeCandidateCsv(filePath: string, rows: CandidateCsvRow[]): void {
  const lines = [CANDIDATE_CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CANDIDATE_CSV_COLUMNS.map((col) => csvEscape(row[col])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${rows.length} rows to ${filePath}`);
}

/** Shared by both the current candidate pool (ProjectedTrustee) and the staging trustee lookup
 * (a raw Trustee's public.address) - both use the exact same Address shape (common/src/cams/
 * contact.ts), so one formatter covers either source without a ProjectedTrustee conversion step. */
function addressString(address: ProjectedTrustee['address']): string {
  if (!address) return '';
  return [
    address.address1,
    [address.city, address.state, address.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

/** Whichever scorer most recently touched this candidate - purely a display label, matching
 * pipeline-replay-backtest.ts/ai-candidate-review.ts's own convention. */
function introductionStageOf(scores: ScoreByScorer): string {
  const names = Object.keys(scores);
  return names[names.length - 1] ?? 'unknown';
}

type StagingInfo = {
  disposition: string;
  trusteeId: string | null;
  trusteeName: string;
  trusteeAddress: string;
  trusteePhone: string;
};

/** Builds one CSV row per candidate in rec.candidates, or - when rec.candidates is empty (a
 * skipped record, which never reaches candidate discovery at all, or a no-match/ambiguous record
 * whose own pool happens to be empty) - exactly ONE row with every candidate-specific column
 * blank. Every row this returns always carries the ACMS source fields, the staging before-picture,
 * and currentDisposition, regardless of candidate count - the one-row-per-record guarantee is what
 * lets all four output files share this same function and column layout. */
function candidateCsvRows(
  rec: { acmsProfessionalId: string } & Pick<SerializedState, 'sourceRaw' | 'candidates' | 'match'>,
  currentDisposition: string,
  suspectDuplicateCamsTrustee: boolean,
  staging: StagingInfo | undefined,
): CandidateCsvRow[] {
  const acmsRow = csvRowFromSourceRaw(rec.acmsProfessionalId, rec.sourceRaw);
  const stagingColumns = {
    stagingDisposition: staging?.disposition ?? '',
    stagingTrusteeId: staging?.trusteeId ?? '',
    stagingTrusteeName: staging?.trusteeName ?? '',
    stagingTrusteeAddress: staging?.trusteeAddress ?? '',
    stagingTrusteePhone: staging?.trusteePhone ?? '',
    currentDisposition,
  };
  if (rec.candidates.length === 0) {
    return [
      {
        ...acmsRow,
        ...stagingColumns,
        suspectDuplicateCamsTrustee: String(suspectDuplicateCamsTrustee),
        camsTrusteeId: '',
        camsName: '',
        camsAddress: '',
        camsPhone: '',
        introductionStage: '',
        nameScore: '',
        addressScore: '',
        phoneScore: '',
        stateMatch: '',
      },
    ];
  }
  return rec.candidates.map((candidate) => {
    const isWinner = candidate.camsRaw.trusteeId === rec.match?.trusteeId;
    const winnerScores = isWinner ? (rec.match?.score as ScoreByScorer | undefined) : undefined;
    const merged: ScoreByScorer = { ...candidate.scores, ...winnerScores };
    return {
      ...acmsRow,
      ...stagingColumns,
      suspectDuplicateCamsTrustee: String(suspectDuplicateCamsTrustee),
      camsTrusteeId: candidate.camsRaw.trusteeId,
      camsName: candidate.camsRaw.name ?? '',
      camsAddress: addressString(candidate.camsRaw.address),
      camsPhone: candidate.camsRaw.phone?.number ?? '',
      introductionStage: introductionStageOf(candidate.scores),
      nameQuality: String(merged.doesNameMatch?.quality ?? ''),
      addressScore: String(merged.contactCorroborationAddress?.value ?? ''),
      phoneScore: String(merged.contactCorroborationPhone?.value ?? ''),
      stateMatch: String(merged.doesStateMatch?.pass ?? true),
    };
  });
}

async function main(): Promise<void> {
  const jsonlPath = path.join(DATA_DIR, 'replay-backtest-report.jsonl');
  if (!fs.existsSync(jsonlPath)) {
    throw new Error(`${jsonlPath} does not exist. Run pipeline-replay-backtest.ts first.`);
  }

  const { deriveDisposition, deriveSuspectDuplicateCamsTrustee } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types');
  const { shouldSkipAsNotAPerson, isRecordDisavowed, shouldSkipAsUstStaff } =
    await import('../../../../backend/lib/use-cases/dataflows/acms-name-normalization.helpers');

  const records = loadProfessionalIds();
  const trusteeById = new Map(loadTrustees().map((t) => [t.trusteeId, t]));
  const stagingByAcmsId = new Map(
    records.map((r) => {
      const trustee =
        r.disposition === 'auto-linked' ? trusteeById.get(r.camsTrusteeId) : undefined;
      const staging: StagingInfo = {
        disposition: r.disposition,
        trusteeId: r.disposition === 'auto-linked' ? r.camsTrusteeId : null,
        trusteeName: trustee?.name ?? '',
        trusteeAddress: addressString(trustee?.public?.address),
        trusteePhone: trustee?.public?.phone?.number ?? '',
      };
      return [r.acmsProfessionalId, staging];
    }),
  );

  const noMatchRows: CandidateCsvRow[] = [];
  const ambiguousRows: CandidateCsvRow[] = [];
  const ambiguousDuplicationRows: CandidateCsvRow[] = [];

  const lines = fs
    .readFileSync(jsonlPath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const rec: { acmsProfessionalId: string } & SerializedState = JSON.parse(line);
    const disposition = deriveDisposition(rec);
    const staging = stagingByAcmsId.get(rec.acmsProfessionalId);
    if (disposition === 'no-match') {
      noMatchRows.push(...candidateCsvRows(rec, disposition, false, staging));
    } else if (disposition === 'ambiguous') {
      const suspectDuplicate = deriveSuspectDuplicateCamsTrustee(rec);
      const rows = candidateCsvRows(rec, disposition, suspectDuplicate, staging);
      ambiguousRows.push(...rows);
      if (suspectDuplicate) {
        ambiguousDuplicationRows.push(...rows);
      }
    }
  }

  // Same three checks skipAdministrativePlaceholder itself runs (trustee-match-pipeline-stages.ts)
  // - a skipped record never reaches candidate discovery, so pipeline-replay-backtest.ts never
  // writes it to the JSONL at all, and this population has to be re-derived directly from the
  // fixture instead of read out of it. All three, not a subset: an earlier version of this script
  // only checked shouldSkipAsNotAPerson/isRecordDisavowed and silently missed every
  // shouldSkipAsUstStaff-only record (e.g. "JUDY ROBBINS (UST)"), which then wrongly fell through
  // to the no-match bucket instead - the exact class of bug this parity pass was meant to catch.
  const replayable = records.filter((r) => r.evidence?.sourceRaw);
  const skippedRows: CandidateCsvRow[] = [];
  for (const record of replayable) {
    const acmsTrusteeProfessional = record.evidence.sourceRaw;
    if (
      shouldSkipAsNotAPerson(acmsTrusteeProfessional.fullName) ||
      isRecordDisavowed(acmsTrusteeProfessional) ||
      shouldSkipAsUstStaff(acmsTrusteeProfessional.fullName)
    ) {
      const staging = stagingByAcmsId.get(record.acmsProfessionalId);
      skippedRows.push(
        ...candidateCsvRows(
          {
            acmsProfessionalId: record.acmsProfessionalId,
            sourceRaw: acmsTrusteeProfessional,
            candidates: [],
            match: null,
          },
          'skipped',
          false,
          staging,
        ),
      );
    }
  }

  writeCandidateCsv(path.join(DATA_DIR, 'no-match-acms-trustees.csv'), noMatchRows);
  writeCandidateCsv(path.join(DATA_DIR, 'ambiguous-acms-trustees.csv'), ambiguousRows);
  writeCandidateCsv(
    path.join(DATA_DIR, 'ambiguous-duplication-acms-trustees.csv'),
    ambiguousDuplicationRows,
  );
  writeCandidateCsv(path.join(DATA_DIR, 'skipped-acms-trustees.csv'), skippedRows);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
