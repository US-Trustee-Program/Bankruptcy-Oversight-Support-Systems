/**
 * Independent, pipeline-BYPASSING investigation for the CAMS-876 no-match population: for every
 * ACMS record that runTrusteeMatchPipeline resolved to ZERO candidates at all (not "candidates
 * found and correctly rejected" - genuinely zero, meaning every discovery tier
 * (surnameExactDiscoveryStage, matchTrusteeByName's three internal passes,
 * tokenIntersectionDiscoveryStage, anchoredLevenshteinDiscoveryStage) came up empty), this script
 * calls trusteesRepo.searchTrusteesByNameScored directly against the SAME seeded trustees
 * collection, with none of the pipeline's own discovery/filtering logic in the way.
 *
 * Purpose: searchTrusteesByNameScored's phonetic-token aggregation is already the broadest search
 * primitive in the codebase (see trustees.mongo.repository.ts) but matchTrusteeByName immediately
 * narrows its result down to an exact post-normalization name match (see
 * trustee-match.helpers.ts's matchTrusteeByName, fallbackMatches filter) - so a phonetically
 * similar but not textually identical name (a genuine nickname, typo, or reordering the discovery
 * tiers don't otherwise catch) never gets surfaced as a candidate anywhere in the real pipeline.
 * This script surfaces that raw, unfiltered candidate pool for human review, to distinguish "no
 * real match exists in CAMS at all" from "discovery never looked broadly enough."
 *
 * Reads data/replay-backtest-report.jsonl (must already exist - run pipeline-replay-backtest.ts
 * first) to find the zero-candidate population, and reuses the same trustees/professional-ids
 * fixtures pipeline-replay-backtest.ts seeds from, so results are directly comparable.
 *
 * Usage (from test/integration/), against a disposable local Mongo container already seeded by a
 * pipeline-replay-backtest.ts run (or freshly seeded here if empty):
 *   MONGO_CONNECTION_STRING="mongodb://localhost:27118/cams-876-replay?retrywrites=false" \
 *   COSMOS_DATABASE_NAME="cams-876-replay" \
 *   npx tsx --tsconfig ../../backend/tsconfig.json \
 *     sync-acms-professional-ids-audit/scripts/no-match-discovery-gap-investigation.ts
 *
 * Writes data/no-match-discovery-gap-report.jsonl (repo root, gitignored - real trustee PII, never
 * committed): one JSON line per zero-candidate ACMS record that has at least one
 * searchTrusteesByNameScored hit, for human review.
 */
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';

const DATA_DIR = path.resolve(__dirname, '../../../../data');

type ReplayRecord = {
  acmsProfessionalId: string;
  acmsRaw: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  match: unknown;
  skip: boolean;
  candidates: unknown[];
};

function loadZeroCandidateRecords(): ReplayRecord[] {
  const jsonlPath = path.join(DATA_DIR, 'replay-backtest-report.jsonl');
  const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
  const records: ReplayRecord[] = lines.map((line) => JSON.parse(line));
  return records.filter((r) => r.match === null && !r.skip && r.candidates.length === 0);
}

async function buildRealApplicationContext() {
  const ContextCreator = (
    await import('../../../../backend/function-apps/azure/application-context-creator')
  ).default;
  return ContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
  });
}

async function run() {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error(
      'MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set, pointed at the SAME ' +
        'disposable local Mongo container pipeline-replay-backtest.ts already seeded.',
    );
  }

  const zeroCandidateRecords = loadZeroCandidateRecords();
  console.log(`${zeroCandidateRecords.length} zero-candidate no-match records to investigate.\n`);

  const context = await buildRealApplicationContext();
  const factory = (await import('../../../../backend/lib/factory')).default;
  const trusteesRepo = factory.getTrusteesRepository(context);

  const outputPath = path.join(DATA_DIR, 'no-match-discovery-gap-report.jsonl');
  const outStream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });

  let withHits = 0;
  let withoutHits = 0;
  let errored = 0;

  for (const record of zeroCandidateRecords) {
    const fullName = record.acmsRaw.fullName ?? '';
    if (!fullName.trim()) {
      withoutHits++;
      continue;
    }
    try {
      const scoredCandidates = await trusteesRepo.searchTrusteesByNameScored(fullName);
      if (scoredCandidates.length > 0) {
        withHits++;
        outStream.write(
          JSON.stringify({
            acmsProfessionalId: record.acmsProfessionalId,
            acmsFullName: fullName,
            acmsFirstName: record.acmsRaw.firstName,
            acmsLastName: record.acmsRaw.lastName,
            phoneticHits: scoredCandidates.map((c) => ({
              trusteeId: c.trusteeId,
              name: c.name,
            })),
          }) + '\n',
        );
      } else {
        withoutHits++;
      }
    } catch (error) {
      errored++;
      console.error(`Error searching for "${fullName}" (${record.acmsProfessionalId}):`, error);
    }
  }

  await new Promise<void>((resolve, reject) => {
    outStream.end((error?: Error | null) => (error ? reject(error) : resolve()));
  });

  console.log('\n=== searchTrusteesByNameScored coverage over the zero-candidate population ===\n');
  console.log(`  with at least 1 phonetic hit    ${withHits}`);
  console.log(`  with zero phonetic hits         ${withoutHits}`);
  console.log(`  errored                         ${errored}`);
  console.log(`\nWrote ${outputPath} for human review.`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
