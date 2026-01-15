import { describe, test, expect } from 'vitest';
import { getDemoCases, getDemoSearchScenarios } from './demo-cases';

describe('Demo Cases', () => {
  test('should return 50 demo cases', () => {
    const cases = getDemoCases();
    expect(cases).toHaveLength(50);
  });

  test('all demo cases should have phoneticTokens', () => {
    const cases = getDemoCases();

    // Check debtors with names have phoneticTokens
    const debtorsWithNames = cases.filter((bCase) => bCase.debtor?.name);
    expect(debtorsWithNames.length).toBeGreaterThan(0);
    debtorsWithNames.forEach((bCase) => {
      expect(bCase.debtor.phoneticTokens).toBeDefined();
      expect(bCase.debtor.phoneticTokens?.length).toBeGreaterThan(0);
    });

    // Check joint debtors with names have phoneticTokens
    const jointDebtorsWithNames = cases.filter((bCase) => bCase.jointDebtor?.name);
    jointDebtorsWithNames.forEach((bCase) => {
      expect(bCase.jointDebtor!.phoneticTokens).toBeDefined();
      expect(bCase.jointDebtor!.phoneticTokens?.length).toBeGreaterThan(0);
    });
  });

  test('should include nickname test cases', () => {
    const cases = getDemoCases();
    const names = cases.map((c) => c.debtor?.name);

    // Check for nickname pairs
    expect(names).toContain('Michael Johnson');
    expect(names).toContain('Mike Anderson');
    expect(names).toContain('William Smith');
    expect(names).toContain('Bill Thompson');
    expect(names).toContain('Robert Brown');
    expect(names).toContain('Bob Wilson');
  });

  test('should include phonetic test cases', () => {
    const cases = getDemoCases();
    const names = cases.map((c) => c.debtor?.name);

    // Check for phonetic variations
    expect(names).toContain('John Davis');
    expect(names).toContain('Jon Miller');
    expect(names).toContain('Jonathan Garcia');
    expect(names).toContain('Smith Martinez');
    expect(names).toContain('Smyth Rodriguez');
  });

  test('should include false positive test cases', () => {
    const cases = getDemoCases();
    const names = cases.map((c) => c.debtor?.name);

    // Check for false positive test cases
    expect(names).toContain('Jane Doe');
    expect(names).toContain('Jane Wilson');
  });

  test('should include joint debtor cases', () => {
    const cases = getDemoCases();
    const jointDebtorCases = cases.filter((c) => c.jointDebtor?.name);

    expect(jointDebtorCases.length).toBeGreaterThan(0);

    // Check specific joint debtor case
    const harrisCase = cases.find((c) => c.debtor?.name === 'James Harris');
    expect(harrisCase?.jointDebtor?.name).toBe('Michael Harris');
  });

  test('should return demo search scenarios', () => {
    const scenarios = getDemoSearchScenarios();
    expect(scenarios.length).toBeGreaterThan(0);

    // Check scenario structure
    scenarios.forEach((scenario) => {
      expect(scenario).toHaveProperty('query');
      expect(scenario).toHaveProperty('description');
      expect(scenario).toHaveProperty('expectedCaseIds');
      expect(Array.isArray(scenario.expectedCaseIds)).toBe(true);
    });
  });

  test('demo scenarios should cover key features', () => {
    const scenarios = getDemoSearchScenarios();
    const queries = scenarios.map((s) => s.query);

    // Check for key search scenarios
    expect(queries).toContain('Mike');
    expect(queries).toContain('Bill Smith');
    expect(queries).toContain('Bob');
    expect(queries).toContain('Jon');
    expect(queries).toContain('Smith');
    expect(queries).toContain('john sm');
    expect(queries).toContain('mik joh');

    // Check for numeric suffix scenarios
    expect(queries).toContain('Robert Johnson');
    expect(queries).toContain('Robert Johnson Jr');
    expect(queries).toContain('James Williams');
  });

  test('should include numeric suffix test cases', () => {
    const cases = getDemoCases();
    const names = cases.map((c) => c.debtor?.name);

    // Check for suffix variations
    expect(names).toContain('Robert Johnson');
    expect(names).toContain('Robert Johnson Jr');
    expect(names).toContain('Robert Johnson Sr');
    expect(names).toContain('James Williams II');
    expect(names).toContain('James Williams III');
    expect(names).toContain('James Williams IV');
    expect(names).toContain('John Miller 3rd');
    expect(names).toContain('William Brown 2nd');
  });

  test('should include business names with numbers', () => {
    const cases = getDemoCases();
    const names = cases.map((c) => c.debtor?.name);

    // Check for business names
    expect(names).toContain('2nd Street Properties LLC');
    expect(names).toContain('123 Corporation');
    expect(names).toContain('ABC Holdings 2');
    expect(names).toContain('21st Century Ventures Inc');
  });

  test('should include professional suffix test cases', () => {
    const cases = getDemoCases();
    const names = cases.map((c) => c.debtor?.name);

    // Check for professional suffixes
    expect(names).toContain('Thomas Anderson Esq');
    expect(names).toContain('Michael Davis MD');
    expect(names).toContain('William Smith Jr Esq');
    expect(names).toContain('Dr Michael Johnson III');
  });
});
