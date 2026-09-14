/**
 * Backtest (NOT a harness, not committed anywhere as a regression gate): replays every real
 * error-disposition (no-match/ambiguous) record from a staging trustee-professional-ids export
 * through the ACTUAL, unmodified current-`main`-branch matching pipeline
 * (matchTrusteeByName -> resolveCandidatesByCorroboration, exactly as
 * sync-acms-professional-ids.ts's processNameMatch calls them) — not a re-derived scoring
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
 * Usage (from test/integration/), against a disposable local Mongo container (see this script's
 * own startup log for the exact `podman run` command used to create the one referenced by
 * MONGO_CONNECTION_STRING/COSMOS_DATABASE_NAME below — NOT the shared cams-local-infra-mongo
 * container other agents/tooling depend on):
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
      await db.collection('trustees').insertMany(trustees.map((t) => ({ ...t, documentType: 'TRUSTEE' })));
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

type Verdict =
  | { kind: 'would-resolve'; trusteeId: string; via: 'name-exact' | 'name-fuzzy' | 'corroboration' }
  | { kind: 'still-ambiguous'; candidateCount: number }
  | { kind: 'still-no-match' };

async function run() {
  console.log(
    '\nReplaying error-disposition trustee-professional-ids records through the real, unmodified\n' +
      'current-main matchTrusteeByName -> resolveCandidatesByCorroboration pipeline...\n',
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
  const { matchTrusteeByName, resolveByContactCorroboration, resolveDuplicateNameCandidates } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-match.helpers');

  /**
   * Inlines sync-acms-professional-ids.ts's module-private resolveCandidatesByCorroboration
   * (not exported) as the same two-call sequence in the same order, using the exported
   * primitives it composes — not a new, separately-tuned resolution path.
   */
  async function resolveCandidatesByCorroboration(
    acmsTrusteeProfessional: AcmsTrusteeProfessional,
    candidateTrusteeIds: string[],
  ): Promise<string | null> {
    if (candidateTrusteeIds.length === 0) return null;
    const corroboration = await resolveByContactCorroboration(
      context,
      acmsTrusteeProfessional,
      candidateTrusteeIds,
    );
    if (corroboration.kind === 'resolved') return corroboration.trusteeId;
    const duplicateResolution = await resolveDuplicateNameCandidates(
      context,
      acmsTrusteeProfessional,
      candidateTrusteeIds,
    );
    if (duplicateResolution.kind === 'resolved-duplicate') return duplicateResolution.trusteeId;
    return null;
  }

  const counts: Record<Verdict['kind'], number> = {
    'would-resolve': 0,
    'still-ambiguous': 0,
    'still-no-match': 0,
  };
  const newlyResolved: { acmsProfessionalId: string; fullName: string; trusteeId: string; priorDisposition: string }[] =
    [];
  const stillAmbiguous: {
    acmsProfessionalId: string;
    fullName: string;
    candidateCount: number;
    soleCandidateScore?: { nameScore: number; addressScore: number; phoneScore: number | null; emailScore: number | null };
  }[] = [];

  let i = 0;
  for (const record of errored) {
    i++;
    if (i % 250 === 0) console.log(`  ...${i}/${errored.length}`);

    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsTrusteeProfessional = toAcmsTrusteeProfessional(decoded);

    const nameResult = await matchTrusteeByName(context, acmsTrusteeProfessional);

    let verdict: Verdict;
    let soleCandidateScore:
      | { nameScore: number; addressScore: number; phoneScore: number | null; emailScore: number | null }
      | undefined;
    if (nameResult.kind === 'resolved') {
      verdict = {
        kind: 'would-resolve',
        trusteeId: nameResult.trusteeId,
        via: nameResult.nameMatchQuality === 'exact' ? 'name-exact' : 'name-fuzzy',
      };
    } else if (nameResult.kind === 'ambiguous') {
      const candidateTrusteeIds = nameResult.matchCandidates.map((c) => c.trusteeId);
      const corroboration = await resolveCandidatesByCorroboration(
        acmsTrusteeProfessional,
        candidateTrusteeIds,
      );
      verdict = corroboration
        ? { kind: 'would-resolve', trusteeId: corroboration, via: 'corroboration' }
        : { kind: 'still-ambiguous', candidateCount: candidateTrusteeIds.length };

      if (verdict.kind === 'still-ambiguous' && candidateTrusteeIds.length === 1) {
        const solo = await resolveByContactCorroboration(context, acmsTrusteeProfessional, candidateTrusteeIds);
        const score = solo.kind !== 'no-match' ? solo.candidateScores[0] : undefined;
        if (score) {
          soleCandidateScore = {
            nameScore: score.nameScore,
            addressScore: score.addressScore,
            phoneScore: score.phoneScore,
            emailScore: score.emailScore,
          };
        }
      }
    } else {
      verdict = { kind: 'still-no-match' };
    }

    counts[verdict.kind]++;
    if (verdict.kind === 'would-resolve') {
      newlyResolved.push({
        acmsProfessionalId: record.acmsProfessionalId,
        fullName: acmsTrusteeProfessional.fullName,
        trusteeId: verdict.trusteeId,
        priorDisposition: record.error!.disposition,
      });
    } else if (verdict.kind === 'still-ambiguous') {
      stillAmbiguous.push({
        acmsProfessionalId: record.acmsProfessionalId,
        fullName: acmsTrusteeProfessional.fullName,
        candidateCount: verdict.candidateCount,
        soleCandidateScore,
      });
    }
  }

  console.log('\n=== Replay outcome (current main vs. what was actually persisted) ===\n');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(20)} ${v.toString().padStart(6)}  (${((v / errored.length) * 100).toFixed(1)}%)`);
  }

  const byPriorDisposition: Record<string, number> = {};
  for (const r of newlyResolved) {
    byPriorDisposition[r.priorDisposition] = (byPriorDisposition[r.priorDisposition] ?? 0) + 1;
  }
  console.log(
    `\n${newlyResolved.length} records that were persisted as error dispositions would resolve ` +
      `under current main. Broken down by their PERSISTED (stale) disposition:`,
  );
  for (const [d, c] of Object.entries(byPriorDisposition)) {
    console.log(`  ${d.padEnd(15)} ${c}`);
  }

  console.log('\nSample of newly-resolvable records (first 20):');
  for (const r of newlyResolved.slice(0, 20)) {
    console.log(
      `  "${r.fullName}" (${r.acmsProfessionalId}) [was: ${r.priorDisposition}] -> ${r.trusteeId}`,
    );
  }

  const singleCandidateStuck = stillAmbiguous.filter((r) => r.candidateCount === 1);
  const multiCandidateStuck = stillAmbiguous.filter((r) => r.candidateCount > 1);
  const candidateCounts = stillAmbiguous.map((r) => r.candidateCount).sort((a, b) => a - b);
  const percentile = (p: number) =>
    candidateCounts.length > 0 ? candidateCounts[Math.floor(candidateCounts.length * p)] : 0;

  console.log(
    `\n=== Still-ambiguous breakdown (${stillAmbiguous.length} records, genuine remaining matcher gap) ===\n`,
  );
  console.log(
    `  single-candidate (name qualified, corroboration/duplicate-resolution failed): ${singleCandidateStuck.length}`,
  );
  console.log(`  multi-candidate (2+ candidates, never resolved to one):                    ${multiCandidateStuck.length}`);
  if (candidateCounts.length > 0) {
    console.log(
      `  candidate-count percentiles: p50=${percentile(0.5)} p75=${percentile(0.75)} p90=${percentile(0.9)} max=${candidateCounts[candidateCounts.length - 1]}`,
    );
  }
  console.log('\nSample of single-candidate still-ambiguous records (first 15):');
  for (const r of singleCandidateStuck.slice(0, 15)) {
    const s = r.soleCandidateScore;
    const scoreStr = s ? ` [name=${s.nameScore} address=${s.addressScore} phone=${s.phoneScore} email=${s.emailScore}]` : '';
    console.log(`  "${r.fullName}" (${r.acmsProfessionalId})${scoreStr}`);
  }

  // The "obvious match" population per Brian's framing: a strong contact-field signal
  // (address>=80 or phone=100 or email=100 - the same bar CONTACT_CORROBORATION_ADDRESS_THRESHOLD
  // and the exact-phone/email checks already use) present despite nameScore not qualifying at
  // CONTACT_CORROBORATION_NAME_THRESHOLD (85). This is the safest population to consider loosening
  // name tolerance for (e.g. a nickname map) - real-world corroborating evidence (an exact phone
  // match, a matching address) already independently points at the same person.
  const strongContactWeakName = singleCandidateStuck.filter((r) => {
    const s = r.soleCandidateScore;
    if (!s) return false;
    const strongContact = s.addressScore >= 80 || s.phoneScore === 100 || s.emailScore === 100;
    return strongContact && s.nameScore < 85;
  });
  console.log(
    `\n"Obvious match" candidates: single-candidate, strong contact corroboration (address>=80 ` +
      `or phone=100 or email=100) but nameScore < 85 (so corroboration never even got a chance to ` +
      `run): ${strongContactWeakName.length} of ${singleCandidateStuck.length} single-candidate ` +
      `still-ambiguous records.\n`,
  );
  for (const r of strongContactWeakName) {
    const s = r.soleCandidateScore!;
    console.log(
      `  "${r.fullName}" (${r.acmsProfessionalId}) [name=${s.nameScore} address=${s.addressScore} phone=${s.phoneScore} email=${s.emailScore}]`,
    );
  }
  console.log('\nSample of multi-candidate still-ambiguous records (first 15):');
  for (const r of multiCandidateStuck.slice(0, 15)) {
    console.log(`  "${r.fullName}" (${r.acmsProfessionalId}) [${r.candidateCount} candidates]`);
  }

  console.log(
    `\nConclusion: a full purge + re-sync against current main would recover ` +
      `${newlyResolved.length} of ${errored.length} (${((newlyResolved.length / errored.length) * 100).toFixed(1)}%) ` +
      `of this export's error population WITHOUT any matcher code change — current main's ` +
      `matching logic is already materially better than what produced this staging export. This ` +
      `does not mean no further matcher tightening is worthwhile; it means the write-once ` +
      `staleness gap accounts for at least this much of the observed miss rate, separate from any ` +
      `remaining genuine matcher gap in the 'still-ambiguous'/'still-no-match' populations above.`,
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
