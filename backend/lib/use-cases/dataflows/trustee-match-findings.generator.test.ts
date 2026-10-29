/**
 * Generates common/src/cams/test-utilities/trustee-match-findings.generated.json: the real
 * trustee-match pipeline's serialized state for each fixture scenario in
 * trustee-match-findings.scenarios.ts. Seeds and UI tests read identity-task findings from that
 * file instead of hand-writing scores.
 *
 * Regenerate after changing a scenario or a scorer: `npm test -- -u trustee-match-findings.generator`
 * in backend/. Until then, a change that alters the pipeline's output fails the snapshot test.
 *
 * Only the recall set is simulated: the trustees repository is served from the scenario's pool,
 * filtered with the same predicates as trustees.mongo.repository.ts. Every score is the real
 * scorer's output. Two assumptions: a stored trustee's phoneticTokens are generateSearchTokens(name),
 * as createTrustee writes them; and each scenario's pool is searched on its own, although seeds
 * insert every scenario's trustees into one collection (scenario surnames are kept distinct).
 * A change to those Mongo queries needs the same change here, then a regeneration.
 */
import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import {
  TRUSTEE_MATCH_FINDINGS_SCENARIOS,
  TrusteeMatchFindingsScenario,
} from '@common/cams/test-utilities/trustee-match-findings.scenarios';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  combinePhoneticTokens,
  generateSearchTokens,
  generateStructuredQueryTokens,
  StructuredQueryTokens,
} from '../../adapters/utils/phonetic-helper';
import { escapeRegex, normalizeName, parseCityStateZip } from './trustee-match.helpers';
import { runTrusteeMatchPipeline } from './trustee-match-pipeline-orchestrator';
import { serializeState, TrusteeSerializedState } from './trustee-match-pipeline';

const GENERATED_FILE =
  '../../../../common/src/cams/test-utilities/trustee-match-findings.generated.json';

/** buildParseWordsExpression in mongo-aggregate-renderer.ts. */
function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .replaceAll("'", '')
    .split(' ')
    .flatMap((word) => word.split('-'))
    .filter((word) => word.length > 0);
}

function intersectionSize(a: string[], b: string[]): number {
  const other = new Set(b);
  return new Set(a.filter((value) => other.has(value))).size;
}

function hasSimilarLength(docWord: string, searchWord: string): boolean {
  const tolerance = searchWord.length <= 4 === docWord.length <= 4 ? 1 : 0;
  return Math.abs(docWord.length - searchWord.length) <= tolerance;
}

/**
 * Whether toMongoScore (mongo-aggregate-renderer.ts) gives the document a matchScore above 0. Every
 * weight is positive, so that is: an exact, nickname or character-prefix word match, or a metaphone
 * match qualified by one of those or by a similar-length word. The score's value and the sort only
 * order the results, and callers reduce them to trustee ids, so neither reaches the findings.
 */
function hasPositiveMatchScore(query: StructuredQueryTokens, trustee: Trustee): boolean {
  const words = nameWords(trustee.name);
  const metaphoneTokens = generateSearchTokens(trustee.name).filter((token) =>
    /^[A-Z0-9]+$/.test(token),
  );
  const exact = intersectionSize(query.searchWords, words) > 0;
  const nickname = intersectionSize(query.nicknameWords, words) > 0;
  const phonetic =
    intersectionSize([...query.searchMetaphones, ...query.nicknameMetaphones], metaphoneTokens) > 0;
  const charPrefix = words.some((word) =>
    query.searchWords.some((search) => word.startsWith(search) && word.length > search.length),
  );
  const similarLength = words.some((word) =>
    query.searchWords.some((search) => hasSimilarLength(word, search)),
  );

  return exact || nickname || charPrefix || (phonetic && similarLength);
}

/** Serves the four trustee lookups the recall stages make from an in-memory pool, with the same
 * predicates as TrusteesMongoRepository. */
function serveTrusteesFrom(pool: Trustee[]) {
  vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockImplementation(
    async (name: string) => {
      const pattern = new RegExp(`^${escapeRegex(normalizeName(name))}$`, 'i');
      return pool.filter((trustee) => pattern.test(trustee.name));
    },
  );
  vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockImplementation(
    async (trusteeIds: string[]) =>
      pool.filter((trustee) => trusteeIds.includes(trustee.trusteeId)),
  );
  vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
    async (name: string) => {
      const pattern = new RegExp(escapeRegex(normalizeName(name)), 'i');
      return pool.filter((trustee) => pattern.test(trustee.name));
    },
  );
  vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockImplementation(
    async (name: string) => {
      const query = generateStructuredQueryTokens(name);
      if (query.searchWords.length === 0 && query.searchMetaphones.length === 0) return [];

      const queryTokens = combinePhoneticTokens(query);
      return pool.filter(
        (trustee) =>
          (queryTokens.length === 0 ||
            intersectionSize(queryTokens, generateSearchTokens(trustee.name)) > 0) &&
          hasPositiveMatchScore(query, trustee),
      );
    },
  );
}

/** The source as the DXTR sync hands it to the pipeline (parseAndAttachCityStateZip in
 * sync-trustee-case-appointments.ts). */
function asSynced(source: DxtrTrusteeParty): DxtrTrusteeParty {
  const cityStateZipCountry = source.legacy?.cityStateZipCountry;
  if (!source.legacy || !cityStateZipCountry) return structuredClone(source);
  return {
    ...structuredClone(source),
    legacy: { ...source.legacy, parsedCityStateZip: parseCityStateZip(cityStateZipCountry) },
  };
}

const scenarios = Object.entries(TRUSTEE_MATCH_FINDINGS_SCENARIOS);

describe('trustee-match findings generator', () => {
  let context: ApplicationContext;

  async function generateFindings(
    scenario: TrusteeMatchFindingsScenario,
  ): Promise<TrusteeSerializedState> {
    serveTrusteesFrom(scenario.trustees);
    return serializeState(await runTrusteeMatchPipeline(context, asSynced(scenario.source)));
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test.each(scenarios)('%s leaves the pipeline unresolved', async (_key, scenario) => {
    const findings = await generateFindings(scenario);

    expect(findings.error).toBeNull();
    expect(findings.skip).toBe(false);
    expect(findings.match).toBeNull();
    expect(findings.candidates).toHaveLength(scenario.expectedCandidateCount);
  });

  test('the generated findings file matches the pipeline output', async () => {
    const generated: Record<string, TrusteeSerializedState> = {};
    for (const [key, scenario] of scenarios) {
      generated[key] = await generateFindings(scenario);
    }

    await expect(JSON.stringify(generated, null, 2) + '\n').toMatchFileSnapshot(GENERATED_FILE);
  });
});
