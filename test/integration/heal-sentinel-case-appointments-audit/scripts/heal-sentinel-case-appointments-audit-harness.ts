/**
 * Exploratory audit: how effective is HealSentinelCaseAppointmentsUseCase.healSentinelAppointment
 * against a real sample of unmatched sentinel case-trustee-appointments from staging?
 *
 * Investigation only — makes NO changes to any collection or to the as-built healing logic.
 * Replays the exact same resolution rule production uses
 * (backend/lib/use-cases/dataflows/heal-sentinel-case-appointments.ts:
 * healSentinelAppointment/findByAcmsProfessionalId) against two fixture exports:
 *
 *   1. case-trustee-appointments.json — a sample of sentinel appointments (trusteeId ===
 *      SENTINEL_TRUSTEE_ID, reason: 'trustee-not-found'), each carrying the acmsProfessionalId
 *      that couldn't be resolved at migration time.
 *   2. trustee-professional-ids.json — the current trustee-professional-ids collection, which
 *      sync-acms-professional-ids keeps populating/improving after that migration ran. A sentinel
 *      heals once this collection has exactly one non-error record for its acmsProfessionalId.
 *
 * findByAcmsProfessionalId's real query is `acmsProfessionalId == X AND error is absent` (see
 * notErrored() in trustee-professional-ids.mongo.repository.ts) — this harness reimplements that
 * exact filter in memory rather than a new, separately-tuned comparison.
 *
 * This is a one-shot script - NOT a Vitest test. No database is used; both fixture files are read
 * directly and compared in memory.
 *
 * Usage (from test/integration/):
 *   npm run heal-sentinel-case-appointments-audit
 *
 * Required fixtures (place in fixtures/ — gitignored, real trustee PII, never committed):
 *   <export>.json   Raw export of the case-trustee-appointments collection, sampled to sentinel
 *                   rows (trusteeId === SENTINEL_TRUSTEE_ID). Pass the filename via
 *                   APPOINTMENTS_FIXTURE, or the script defaults to the newest
 *                   *case-trustee-appointments*.json file found in fixtures/.
 *   <export>.json   Raw export of the trustee-professional-ids collection. Pass the filename via
 *                   PROFESSIONAL_IDS_FIXTURE, or the script defaults to the newest
 *                   *trustee-professional-ids*.json file found in fixtures/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CaseAppointment } from '../../../../common/src/cams/trustee-appointments';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

const SENTINEL_TRUSTEE_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

type MongoExtendedId = { $oid?: string } | string | undefined;

type SentinelAppointmentFixture = CaseAppointment & {
  _id: MongoExtendedId;
  reason?: string;
  acmsProfessionalId?: string;
};

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
    .sort(); // filenames are date-prefixed (YYYY-MM-DD-...), so lexical sort is chronological
  if (matches.length === 0) {
    throw new Error(`No fixture matching "*${namePattern}*.json" found in ${FIXTURES_DIR}`);
  }
  return path.join(FIXTURES_DIR, matches[matches.length - 1]);
}

function loadSentinelAppointments(): SentinelAppointmentFixture[] {
  const file = resolveFixtureFile('APPOINTMENTS_FIXTURE', 'case-trustee-appointments');
  const raw: SentinelAppointmentFixture[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  console.log(`Case-trustee-appointments fixture: ${path.basename(file)}`);
  return raw;
}

function loadProfessionalIds(): TrusteeProfessionalId[] {
  const file = resolveFixtureFile('PROFESSIONAL_IDS_FIXTURE', 'trustee-professional-ids');
  const raw: (TrusteeProfessionalId & { _id?: MongoExtendedId })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  console.log(`Trustee-professional-ids fixture: ${path.basename(file)}\n`);
  return raw.map(stripMongoId) as TrusteeProfessionalId[];
}

// ---------------------------------------------------------------------------
// Replayed resolution logic
// ---------------------------------------------------------------------------

// Mirrors findByAcmsProfessionalId's real query: acmsProfessionalId match AND error is absent
// (notErrored() in trustee-professional-ids.mongo.repository.ts). A sentinel only heals when
// exactly one such record exists — zero means no mapping yet, more than one is an ambiguous
// mapping the use case intentionally refuses to guess between.
function findLinkedMatches(
  acmsProfessionalId: string,
  professionalIds: TrusteeProfessionalId[],
): TrusteeProfessionalId[] {
  return professionalIds.filter((p) => p.acmsProfessionalId === acmsProfessionalId && !p.error);
}

type Outcome = 'healed' | 'no-mapping' | 'ambiguous-mapping' | 'missing-acms-id';

type ReplayResult = {
  caseId: string;
  acmsProfessionalId?: string;
  outcome: Outcome;
  matchCount: number;
  resolvedTrusteeId?: string;
};

function replaySentinel(
  sentinel: SentinelAppointmentFixture,
  professionalIds: TrusteeProfessionalId[],
): ReplayResult {
  if (!sentinel.acmsProfessionalId) {
    return { caseId: sentinel.caseId, outcome: 'missing-acms-id', matchCount: 0 };
  }

  const matches = findLinkedMatches(sentinel.acmsProfessionalId, professionalIds);

  if (matches.length === 0) {
    return {
      caseId: sentinel.caseId,
      acmsProfessionalId: sentinel.acmsProfessionalId,
      outcome: 'no-mapping',
      matchCount: 0,
    };
  }
  if (matches.length > 1) {
    return {
      caseId: sentinel.caseId,
      acmsProfessionalId: sentinel.acmsProfessionalId,
      outcome: 'ambiguous-mapping',
      matchCount: matches.length,
    };
  }

  return {
    caseId: sentinel.caseId,
    acmsProfessionalId: sentinel.acmsProfessionalId,
    outcome: 'healed',
    matchCount: 1,
    resolvedTrusteeId: matches[0].camsTrusteeId,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function run() {
  console.log(
    '\nReplaying HealSentinelCaseAppointmentsUseCase resolution against a staging sample...\n',
  );

  const sentinels = loadSentinelAppointments();
  const professionalIds = loadProfessionalIds();

  const nonSentinel = sentinels.filter((s) => s.trusteeId !== SENTINEL_TRUSTEE_ID);
  if (nonSentinel.length > 0) {
    console.log(
      `Warning: ${nonSentinel.length} of ${sentinels.length} fixture rows do not carry the ` +
        `sentinel trusteeId (${SENTINEL_TRUSTEE_ID}) — included anyway, but they are not sentinels.\n`,
    );
  }

  console.log(
    `Loaded ${sentinels.length} sampled appointments, ${professionalIds.length} ` +
      `trustee-professional-ids records (${professionalIds.filter((p) => !p.error).length} linked, ` +
      `${professionalIds.filter((p) => p.error).length} errored).\n`,
  );

  const results = sentinels.map((s) => replaySentinel(s, professionalIds));

  const counts: Record<Outcome, number> = {
    healed: 0,
    'no-mapping': 0,
    'ambiguous-mapping': 0,
    'missing-acms-id': 0,
  };
  for (const r of results) counts[r.outcome]++;

  console.log('=== Outcome summary ===\n');
  for (const [outcome, count] of Object.entries(counts)) {
    const pct = ((count / results.length) * 100).toFixed(1);
    console.log(`  ${outcome.padEnd(20)} ${count.toString().padStart(6)}  (${pct}%)`);
  }

  const healRate = ((counts.healed / results.length) * 100).toFixed(1);
  console.log(`\nHeal rate on this sample: ${healRate}% (${counts.healed}/${results.length})`);

  // Distinct acmsProfessionalId view: how many *distinct* unresolved professional IDs remain,
  // versus how many appointment rows they represent — a handful of professional IDs can account
  // for a disproportionate share of unhealed rows.
  const unhealed = results.filter((r) => r.outcome === 'no-mapping' || r.outcome === 'ambiguous-mapping');
  const byAcmsId = new Map<string, number>();
  for (const r of unhealed) {
    if (!r.acmsProfessionalId) continue;
    byAcmsId.set(r.acmsProfessionalId, (byAcmsId.get(r.acmsProfessionalId) ?? 0) + 1);
  }
  const topUnresolved = [...byAcmsId.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  console.log(
    `\n${unhealed.length} unhealed rows map to ${byAcmsId.size} distinct acmsProfessionalId values.`,
  );
  console.log('\nTop unresolved acmsProfessionalId values by row count:');
  for (const [acmsId, count] of topUnresolved) {
    const outcome = unhealed.find((r) => r.acmsProfessionalId === acmsId)!.outcome;
    console.log(`  ${acmsId.padEnd(12)} ${count.toString().padStart(6)} rows  [${outcome}]`);
  }

  const ambiguous = results.filter((r) => r.outcome === 'ambiguous-mapping');
  if (ambiguous.length > 0) {
    console.log(`\nAmbiguous-mapping detail (professional-ids collection has >1 linked match):`);
    for (const r of ambiguous.slice(0, 20)) {
      console.log(`  case ${r.caseId} -> ${r.acmsProfessionalId} (${r.matchCount} matches)`);
    }
    if (ambiguous.length > 20) console.log(`  ... and ${ambiguous.length - 20} more`);
  }

  const missingAcmsId = results.filter((r) => r.outcome === 'missing-acms-id');
  if (missingAcmsId.length > 0) {
    console.log(
      `\n${missingAcmsId.length} sampled rows have no acmsProfessionalId at all — ` +
        `healSentinelAppointment leaves these in place unconditionally, by design.`,
    );
  }

  console.log(`\nReplayed ${results.length} sampled sentinel appointments.\n`);
}

run();
