/**
 * Cheap heuristic triage of the AUTO-LINKED population in data/replay-backtest-report.jsonl
 * (produced by pipeline-replay-backtest.ts) - the false-positive-hunting counterpart to that
 * script's staging-vs-current divergence check. That check only catches a link that CHANGED
 * relative to what staging persisted; it says nothing about a link that was thin evidence from
 * the start and current code still reproduces identically. This script narrows the ~5900
 * auto-linked population down to a much smaller suspect list worth a human or AI-assisted second
 * opinion, WITHOUT running that expensive review against everything.
 *
 * Reads each auto-linked record's own winning match.score (the actual corroboration evidence that
 * resolved it, not a re-run of scoring logic) and buckets by risk tier, cheapest/strongest signal
 * first:
 *   A - doesNameMatch scored 0 (the discrete name-field comparison found no match at all - this
 *       record resolved on non-name evidence alone).
 *   B - doesNameMatch missing entirely (resolved via matchTrusteeByName's exact/fuzzy tier
 *       instead, which never runs the discrete-field scorer - a different code path worth
 *       separate scrutiny). This path also never populates state.candidates (see
 *       trustee-match-pipeline-orchestrator.ts's resolveRisky no-ACMS-data carve-out), so this
 *       tier's camsName column is always blank in the suspect CSV - look the winning trusteeId up
 *       in the trustees fixture directly if the name is needed (manually verified clean for the
 *       2026-09-22 staging export: every record here is an exact or near-exact full-name string
 *       match).
 *   C - resolved via one of the fuzzy/last-resort RESOLVE stages (resolveBySoleFuzzyNameMatchAndState/
 *       resolveByLastNameOnlyConsensus/resolveByFuzzyLastNameMatch) - nickname/typo-tolerant
 *       matching, not an exact hit.
 *   D - doesNameMatch scored exactly 85 - the pass/fail threshold boundary, weakest passing score.
 *   E - no contactCorroborationPhone signal at all - resolved on address alone.
 *   F - everything else (strong name + phone + address evidence) - not written to the suspect CSV.
 *
 * Within tier A specifically, also writes a SEPARATE, sharper CSV
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
  match: { trusteeId: string; score: ScoreByScorer } | null;
  candidates: {
    camsRaw: {
      trusteeId: string;
      name?: string;
      address?: { address1?: string; city?: string; state?: string; zipCode?: string };
      phone?: { number?: string };
    };
  }[];
};

const RISKY_RESOLVERS = [
  'resolveBySoleFuzzyNameMatchAndState',
  'resolveByLastNameOnlyConsensus',
  'resolveByFuzzyLastNameMatch',
] as const;

type RiskTier =
  | 'A-zero-name-score'
  | 'B-no-discrete-name-score'
  | `C-risky-resolver:${(typeof RISKY_RESOLVERS)[number]}`
  | 'D-name-score-85-threshold'
  | 'E-no-phone-corroboration'
  | 'F-strong';

function riskTier(score: ScoreByScorer): RiskTier {
  const nameScore = score.doesNameMatch?.value;
  const riskyResolver = RISKY_RESOLVERS.find((r) => r in score);

  if (nameScore === 0) return 'A-zero-name-score';
  if (nameScore === undefined) return 'B-no-discrete-name-score';
  if (riskyResolver) return `C-risky-resolver:${riskyResolver}`;
  if (nameScore === 85) return 'D-name-score-85-threshold';
  if (!score.contactCorroborationPhone) return 'E-no-phone-corroboration';
  return 'F-strong';
}

/** Resolved via city/state geography agreement alone - BOTH contact-corroboration checks
 * (address, phone) failed outright. See isCorroboratedByGeoOrContact
 * (trustee-match-pipeline-stages.ts) - this is the geoAgrees branch firing independently of
 * contactAgrees, the shape most likely to be two different people sharing only a city/state. */
function isGeoOnlyCorroboration(score: ScoreByScorer): boolean {
  const contactPass =
    score.contactCorroborationAddress?.pass === true || score.contactCorroborationPhone?.pass === true;
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

function writeCsv(filePath: string, columns: string[], rows: Record<string, string | number | undefined>[]): void {
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
  return [address.address1, [address.city, address.state, address.zipCode].filter(Boolean).join(' ')]
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
    'A-zero-name-score': 0,
    'B-no-discrete-name-score': 0,
    'C-risky-resolver:resolveBySoleFuzzyNameMatchAndState': 0,
    'C-risky-resolver:resolveByLastNameOnlyConsensus': 0,
    'C-risky-resolver:resolveByFuzzyLastNameMatch': 0,
    'D-name-score-85-threshold': 0,
    'E-no-phone-corroboration': 0,
    'F-strong': 0,
  };

  const suspectRows: Record<string, string | number | undefined>[] = [];
  const geoOnlyRows: Record<string, string | number | undefined>[] = [];

  for (const line of lines) {
    const rec: ReplayRecord = JSON.parse(line);
    if (!rec.match) continue;

    const { score } = rec.match;
    const tier = riskTier(score);
    tierCounts[tier]++;
    if (tier === 'F-strong') continue;

    const winner = rec.candidates.find((c) => c.camsRaw.trusteeId === rec.match!.trusteeId);
    const legacy = rec.sourceRaw.legacy ?? {};
    const camsRaw = winner?.camsRaw;

    suspectRows.push({
      acmsProfessionalId: rec.acmsProfessionalId,
      tier,
      trusteeId: rec.match.trusteeId,
      acmsFullName: rec.sourceRaw.fullName ?? '',
      camsName: camsRaw?.name ?? '',
      nameScore: score.doesNameMatch?.value,
      addressScore: score.contactCorroborationAddress?.value,
      phoneScore: score.contactCorroborationPhone?.value,
      acmsAddress: legacy.address1 ?? '',
      acmsCityStateZip: legacy.cityStateZipCountry ?? '',
      acmsPhone: legacy.phone ?? '',
      camsAddress: camsAddressString(camsRaw?.address),
      camsPhone: camsRaw?.phone?.number ?? '',
    });

    if (tier === 'A-zero-name-score' && isGeoOnlyCorroboration(score)) {
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
        addressScore: score.contactCorroborationAddress?.value,
        phoneScore: score.contactCorroborationPhone?.value,
      });
    }
  }

  console.log('Risk tier counts (auto-linked records only):');
  for (const [tier, count] of Object.entries(tierCounts)) {
    console.log(`  ${tier.padEnd(55)} ${count}`);
  }
  console.log(`\nTotal suspects (non-F): ${suspectRows.length}`);
  console.log(`Top-priority geo-only-corroboration suspects: ${geoOnlyRows.length}`);

  writeCsv(
    path.join(DATA_DIR, 'auto-link-risk-suspects.csv'),
    [
      'acmsProfessionalId',
      'tier',
      'trusteeId',
      'acmsFullName',
      'camsName',
      'nameScore',
      'addressScore',
      'phoneScore',
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
      'phoneScore',
    ],
    geoOnlyRows,
  );
}

main();
