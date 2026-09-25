import { describe, test, expect } from 'vitest';
import { shouldSkipAsNotAPerson } from './acms-name-normalization.helpers';

describe('shouldSkipAsNotAPerson', () => {
  // These mirror the placeholder shapes formerly excluded by acms.gateway.ts's own
  // PROF_LAST_NAME NOT LIKE clauses - moved here so the gateway is left as a plain data-access
  // layer, per James' PR #3045 review reply that gateway-level business filtering "should have
  // never been implemented in the gateway to begin with."
  test.each([
    ['NO TRUSTEE'],
    ['NO TRUSTEE ASSIGNED'],
    ['CASE STRICKEN: NO TRUSTEE'],
    ['NO TRRUSTEE'],
    ['REOPENED CASE'],
    ['RE-OPENED (JACKSON)'],
    ['TRUSTEE_UNASSIGNED'],
    ['NO TR APT'],
    ['PRO SE'],
  ])('skips ACMS placeholder shape "%s"', (fullName) => {
    expect(shouldSkipAsNotAPerson(fullName)).toBe(true);
  });

  test('does not skip a real surname "Fake" standing alone', () => {
    expect(shouldSkipAsNotAPerson('Fake')).toBe(false);
  });

  test('skips the synthetic "I M FAKE" test record', () => {
    expect(shouldSkipAsNotAPerson('I M FAKE')).toBe(true);
  });

  test('does not skip a real name', () => {
    expect(shouldSkipAsNotAPerson('Jordan Doe')).toBe(false);
  });
});
