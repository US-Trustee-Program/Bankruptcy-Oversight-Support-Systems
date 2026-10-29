import MockData from './mock-data';
import {
  TRUSTEE_MATCH_FINDINGS_SCENARIOS,
  TrusteeMatchScenarioKey,
} from './trustee-match-findings.scenarios';

describe('getTrusteeMatchScenarioFindings', () => {
  const keys = Object.keys(TRUSTEE_MATCH_FINDINGS_SCENARIOS) as TrusteeMatchScenarioKey[];

  test.each(keys)("returns the generated findings for %s's source and pool", (key) => {
    const scenario = TRUSTEE_MATCH_FINDINGS_SCENARIOS[key];
    const poolIds = scenario.trustees.map((trustee) => trustee.trusteeId);

    const findings = MockData.getTrusteeMatchScenarioFindings(key);

    expect(findings.sourceRaw).toMatchObject(scenario.source);
    expect(findings.candidates).toHaveLength(scenario.expectedCandidateCount);
    expect(poolIds).toEqual(
      expect.arrayContaining(findings.candidates.map((candidate) => candidate.camsRaw.trusteeId)),
    );
  });
});
