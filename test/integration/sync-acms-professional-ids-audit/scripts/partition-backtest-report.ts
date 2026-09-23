/**
 * One-off partitioning of data/replay-backtest-report.jsonl (produced by
 * pipeline-replay-backtest.ts) into flat per-disposition CSVs for human review:
 * data/no-match-acms-trustees.csv, data/ambiguous-acms-trustees.csv,
 * data/ambiguous-duplication-acms-trustees.csv (a filtered view of the ambiguous rows whose own
 * suspectDuplicateCamsTrustee flag is true), data/skipped-acms-trustees.csv.
 *
 * no-match/skipped rows are one row per ACMS record (no candidates - either there's nothing
 * qualifying, or the record never reached the pipeline). ambiguous rows are a cartesian product -
 * one row per (ACMS record, CAMS candidate) pair, same shape ai-candidate-review.ts's own CSV
 * output uses - since the whole point of a human review pass here is comparing the ACMS source
 * against EVERY competing candidate side by side, not just the winner.
 *
 * skipped records never reach the pipeline (pipeline-replay-backtest.ts skips them before
 * calling runTrusteeMatchPipeline and does not write them to the JSONL), so this script
 * re-derives that population directly from the professional-ids fixture's own
 * evidence.sourceRaw and the same skip functions, rather than reading it out of the JSONL.
 *
 * Usage (from test/integration/):
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/partition-backtest-report.ts
 */
import * as fs from 'fs';
import * as path from 'path';
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

function writeCsv(filePath: string, rows: Record<(typeof CSV_COLUMNS)[number], string>[]): void {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((col) => csvEscape(row[col])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${rows.length} rows to ${filePath}`);
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

/** Cartesian-product columns for ambiguous records: every ACMS source field alongside one
 * competing CAMS candidate's own fields, same scores ai-candidate-review.ts displays
 * (nameScore/addressScore/phoneScore/stateMatch/introductionStage), plus whether this record's
 * own candidate pool looks like a CAMS-side duplicate (see suspectDuplicateCamsTrustee on
 * TrusteeProfessionalId). */
const CANDIDATE_CSV_COLUMNS = [
  ...CSV_COLUMNS,
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

function camsAddressString(candidate: ProjectedTrustee): string {
  const a = candidate.address;
  if (!a) return '';
  return [a.address1, [a.city, a.state, a.zipCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

/** Whichever scorer most recently touched this candidate - purely a display label, matching
 * pipeline-replay-backtest.ts/ai-candidate-review.ts's own convention. */
function introductionStageOf(scores: ScoreByScorer): string {
  const names = Object.keys(scores);
  return names[names.length - 1] ?? 'unknown';
}

function candidateCsvRows(
  rec: { acmsProfessionalId: string } & SerializedState,
  suspectDuplicateCamsTrustee: boolean,
): CandidateCsvRow[] {
  const acmsRow = csvRowFromSourceRaw(rec.acmsProfessionalId, rec.sourceRaw);
  return rec.candidates.map((candidate) => {
    const isWinner = candidate.camsRaw.trusteeId === rec.match?.trusteeId;
    const winnerScores = isWinner ? (rec.match?.score as ScoreByScorer | undefined) : undefined;
    const merged: ScoreByScorer = { ...candidate.scores, ...winnerScores };
    return {
      ...acmsRow,
      suspectDuplicateCamsTrustee: String(suspectDuplicateCamsTrustee),
      camsTrusteeId: candidate.camsRaw.trusteeId,
      camsName: candidate.camsRaw.name ?? '',
      camsAddress: camsAddressString(candidate.camsRaw),
      camsPhone: candidate.camsRaw.phone?.number ?? '',
      introductionStage: introductionStageOf(candidate.scores),
      nameScore: String(merged.doesNameMatch?.value ?? 0),
      addressScore: String(merged.contactCorroborationAddress?.value ?? ''),
      phoneScore: String(merged.contactCorroborationPhone?.value ?? ''),
      stateMatch: String(merged.isStateNotConflicting?.pass ?? true),
    };
  });
}

async function main(): Promise<void> {
  const jsonlPath = path.join(DATA_DIR, 'replay-backtest-report.jsonl');
  if (!fs.existsSync(jsonlPath)) {
    throw new Error(`${jsonlPath} does not exist. Run pipeline-replay-backtest.ts first.`);
  }

  const { deriveDisposition, deriveSuspectDuplicateCamsTrustee } = await import(
    '../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types'
  );
  const { shouldSkipAsNotAPerson, isRecordDisavowed } = await import(
    '../../../../backend/lib/use-cases/dataflows/sync-acms-professional-ids'
  );

  const noMatchRows: Record<(typeof CSV_COLUMNS)[number], string>[] = [];
  const ambiguousRows: CandidateCsvRow[] = [];
  const ambiguousDuplicationRows: CandidateCsvRow[] = [];

  const lines = fs
    .readFileSync(jsonlPath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const rec: { acmsProfessionalId: string } & SerializedState = JSON.parse(line);
    const disposition = deriveDisposition(rec);
    if (disposition === 'no-match') {
      noMatchRows.push(csvRowFromSourceRaw(rec.acmsProfessionalId, rec.sourceRaw));
    } else if (disposition === 'ambiguous') {
      const suspectDuplicate = deriveSuspectDuplicateCamsTrustee(rec);
      ambiguousRows.push(...candidateCsvRows(rec, suspectDuplicate));
      if (suspectDuplicate) {
        ambiguousDuplicationRows.push(...candidateCsvRows(rec, suspectDuplicate));
      }
    }
  }

  const records = loadProfessionalIds();
  const replayable = records.filter((r) => r.evidence?.sourceRaw);
  const skippedRows: Record<(typeof CSV_COLUMNS)[number], string>[] = [];
  for (const record of replayable) {
    const acmsTrusteeProfessional = record.evidence.sourceRaw;
    if (
      shouldSkipAsNotAPerson(acmsTrusteeProfessional.fullName) ||
      isRecordDisavowed(acmsTrusteeProfessional.fullName)
    ) {
      skippedRows.push(csvRowFromSourceRaw(record.acmsProfessionalId, acmsTrusteeProfessional));
    }
  }

  writeCsv(path.join(DATA_DIR, 'no-match-acms-trustees.csv'), noMatchRows);
  writeCandidateCsv(path.join(DATA_DIR, 'ambiguous-acms-trustees.csv'), ambiguousRows);
  writeCandidateCsv(
    path.join(DATA_DIR, 'ambiguous-duplication-acms-trustees.csv'),
    ambiguousDuplicationRows,
  );
  writeCsv(path.join(DATA_DIR, 'skipped-acms-trustees.csv'), skippedRows);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
