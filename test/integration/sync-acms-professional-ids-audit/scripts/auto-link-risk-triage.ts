/**
 * Cheap heuristic triage of the AUTO-LINKED population in data/replay-backtest-report.jsonl
 * (produced by pipeline-replay-backtest.ts) - the false-positive-hunting counterpart to that
 * script's staging-vs-current divergence check. That check only catches a link that CHANGED
 * relative to what staging persisted; it says nothing about a link that was thin evidence from
 * the start and current code still reproduces identically. This script narrows the ~5900
 * auto-linked population down to a much smaller suspect list worth a human second
 * opinion, WITHOUT running that expensive review against everything.
 *
 * Reads the winning candidate's own scores from record.candidates (falling back to match.score
 * only when the winner is missing from the pool) and buckets by risk tier, first match wins:
 *   A - doesNameMatch did not pass - this record resolved on non-name evidence alone.
 *   B - no doesNameMatch score at all (the winner is missing from the candidate pool).
 *   C - resolved by resolveByStateOnly: state agreement is the only signal.
 *   D - everything else - not written to the suspect CSV.
 *
 * A phone no-match is not a risk: it is the absence of a strong signal, not evidence against.
 *
 * Among name-rejected records, also writes a SEPARATE, sharper CSV
 * (data/auto-link-top-suspects-geo-only.csv) for the narrowest, highest-priority cut: zero name
 * score AND resolved via city/state geography agreement alone, with BOTH contact-corroboration
 * checks (address, phone) failing outright. This is the shape most likely to be two different
 * people who merely share a city/state - review this file first.
 *
 * Usage (from test/integration/, after running pipeline-replay-backtest.ts):
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/auto-link-risk-triage.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { ScoreByScorer } from '../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline';

const DATA_DIR = path.resolve(__dirname, '../../../../data');
const JSONL_PATH = path.join(DATA_DIR, 'replay-backtest-report.jsonl');

type ReplayRecord = {
  acmsProfessionalId: string;
  sourceRaw: {
    fullName?: string;
    legacy?: { address1?: string; cityStateZipCountry?: string; phone?: string };
  };
  match: { trusteeId: string; score: ScoreByScorer; resolvedBy: string } | null;
  candidates: {
    scores: ScoreByScorer;
    camsRaw: {
      trusteeId: string;
      name?: string;
      address?: { address1?: string; city?: string; state?: string; zipCode?: string };
      phone?: { number?: string };
    };
  }[];
};

type RiskTier = 'A-name-rejected' | 'B-no-name-score' | 'C-state-only' | 'D-strong';

function riskTier(score: ScoreByScorer, resolvedBy: string): RiskTier {
  const nameMatch = score.doesNameMatch;
  if (nameMatch === undefined) return 'B-no-name-score';
  if (!nameMatch.pass) return 'A-name-rejected';
  if (resolvedBy === 'resolveByStateOnly') return 'C-state-only';
  return 'D-strong';
}

/** Resolved via city/state geography agreement alone - BOTH contact-corroboration checks
 * (address, phone) failed outright. See isCorroboratedByGeoOrContact
 * (trustee-match-pipeline-stages.ts) - this is the geoAgrees branch firing independently of
 * contactAgrees, the shape most likely to be two different people sharing only a city/state. */
function isGeoOnlyCorroboration(score: ScoreByScorer): boolean {
  const contactPass =
    score.contactCorroborationAddress?.pass === true || score.doesPhoneMatch?.quality === 'exact';
  const geoPass = score.doesCityMatch?.pass === true || score.doesZipCodeMatch?.pass === true;
  return geoPass && !contactPass;
}

function csvEscape(value: string | number | undefined): string {
  const s = value === undefined ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function writeCsv(
  filePath: string,
  columns: string[],
  rows: Record<string, string | number | undefined>[],
): void {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${rows.length} rows to ${filePath}`);
}

function camsAddressString(address?: {
  address1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}): string {
  if (!address) return '';
  return [
    address.address1,
    [address.city, address.state, address.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

function main(): void {
  if (!fs.existsSync(JSONL_PATH)) {
    throw new Error(`${JSONL_PATH} does not exist. Run pipeline-replay-backtest.ts first.`);
  }

  const lines = fs
    .readFileSync(JSONL_PATH, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  const tierCounts: Record<RiskTier, number> = {
    'A-name-rejected': 0,
    'B-no-name-score': 0,
    'C-state-only': 0,
    'D-strong': 0,
  };

  const suspectRows: Record<string, string | number | undefined>[] = [];
  const geoOnlyRows: Record<string, string | number | undefined>[] = [];

  for (const line of lines) {
    const rec: ReplayRecord = JSON.parse(line);
    if (!rec.match) continue;

    const { resolvedBy } = rec.match;
    const winner = rec.candidates.find((c) => c.camsRaw.trusteeId === rec.match!.trusteeId);
    const score = winner?.scores ?? rec.match.score;
    const tier = riskTier(score, resolvedBy);
    tierCounts[tier]++;
    if (tier === 'D-strong') continue;

    const legacy = rec.sourceRaw.legacy ?? {};
    const camsRaw = winner?.camsRaw;

    suspectRows.push({
      acmsProfessionalId: rec.acmsProfessionalId,
      tier,
      resolvedBy,
      trusteeId: rec.match.trusteeId,
      acmsFullName: rec.sourceRaw.fullName ?? '',
      camsName: camsRaw?.name ?? '',
      nameQuality: score.doesNameMatch?.quality as string | undefined,
      addressScore: score.contactCorroborationAddress?.value as number | undefined,
      phoneMatch: score.doesPhoneMatch ? String(score.doesPhoneMatch.quality ?? 'no-match') : '',
      acmsAddress: legacy.address1 ?? '',
      acmsCityStateZip: legacy.cityStateZipCountry ?? '',
      acmsPhone: legacy.phone ?? '',
      camsAddress: camsAddressString(camsRaw?.address),
      camsPhone: camsRaw?.phone?.number ?? '',
    });

    if (score.doesNameMatch?.pass === false && isGeoOnlyCorroboration(score)) {
      geoOnlyRows.push({
        acmsProfessionalId: rec.acmsProfessionalId,
        trusteeId: rec.match.trusteeId,
        acmsFullName: rec.sourceRaw.fullName ?? '',
        camsName: camsRaw?.name ?? '',
        acmsAddress: legacy.address1 ?? '',
        acmsCityStateZip: legacy.cityStateZipCountry ?? '',
        acmsPhone: legacy.phone ?? '',
        camsAddress1: camsRaw?.address?.address1 ?? '',
        camsCity: camsRaw?.address?.city ?? '',
        camsState: camsRaw?.address?.state ?? '',
        camsZip: camsRaw?.address?.zipCode ?? '',
        camsPhone: camsRaw?.phone?.number ?? '',
        addressScore: score.contactCorroborationAddress?.value as number | undefined,
        phoneMatch: score.doesPhoneMatch ? String(score.doesPhoneMatch.quality ?? 'no-match') : '',
      });
    }
  }

  console.log('Risk tier counts (auto-linked records only):');
  for (const [tier, count] of Object.entries(tierCounts)) {
    console.log(`  ${tier.padEnd(55)} ${count}`);
  }
  console.log(`\nTotal suspects (non-D): ${suspectRows.length}`);
  console.log(`Top-priority geo-only-corroboration suspects: ${geoOnlyRows.length}`);

  writeCsv(
    path.join(DATA_DIR, 'auto-link-risk-suspects.csv'),
    [
      'acmsProfessionalId',
      'tier',
      'resolvedBy',
      'trusteeId',
      'acmsFullName',
      'camsName',
      'nameQuality',
      'addressScore',
      'phoneMatch',
      'acmsAddress',
      'acmsCityStateZip',
      'acmsPhone',
      'camsAddress',
      'camsPhone',
    ],
    suspectRows.sort((a, b) => String(a.tier).localeCompare(String(b.tier))),
  );

  writeCsv(
    path.join(DATA_DIR, 'auto-link-top-suspects-geo-only.csv'),
    [
      'acmsProfessionalId',
      'trusteeId',
      'acmsFullName',
      'camsName',
      'acmsAddress',
      'acmsCityStateZip',
      'acmsPhone',
      'camsAddress1',
      'camsCity',
      'camsState',
      'camsZip',
      'camsPhone',
      'addressScore',
      'phoneMatch',
    ],
    geoOnlyRows,
  );
}

main();
