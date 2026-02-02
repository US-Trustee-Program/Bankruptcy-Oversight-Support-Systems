import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { clearAllCollections, generateHybridSearchTestCases } from './db-utils';

describe('should never clear a database that is not an e2e database', () => {
  test('should not clear the database', async () => {
    const context = await createMockApplicationContext();
    context.config.documentDbConfig.databaseName = 'real-database';
    await expect(clearAllCollections(context)).rejects.toThrow();
  });
});

describe('generateHybridSearchTestCases', () => {
  test('should generate test cases with both bigrams and phonetic tokens', () => {
    const testCases = generateHybridSearchTestCases();

    expect(testCases.length).toBeGreaterThan(0);

    const johnSmithCase = testCases.find((c) => c.debtor.name === 'John Smith');
    expect(johnSmithCase).toBeDefined();
    expect(johnSmithCase.debtor.phoneticTokens).toBeDefined();
    expect(johnSmithCase.debtor.phoneticTokens.length).toBeGreaterThan(0);

    expect(johnSmithCase.debtor.phoneticTokens).toContain('jo');
    expect(johnSmithCase.debtor.phoneticTokens).toContain('oh');
    expect(johnSmithCase.debtor.phoneticTokens).toContain('hn');

    expect(johnSmithCase.debtor.phoneticTokens).toContain('J500');
    expect(johnSmithCase.debtor.phoneticTokens).toContain('JN');
  });

  test('should generate joint debtor tokens when present', () => {
    const testCases = generateHybridSearchTestCases();

    const caseWithJoint = testCases.find((c) => c.jointDebtor?.name === 'Sarah Johnson');
    expect(caseWithJoint).toBeDefined();
    expect(caseWithJoint.jointDebtor.phoneticTokens).toBeDefined();
    expect(caseWithJoint.jointDebtor.phoneticTokens.length).toBeGreaterThan(0);

    expect(caseWithJoint.jointDebtor.phoneticTokens).toContain('sa');
    expect(caseWithJoint.jointDebtor.phoneticTokens).toContain('S600');
  });

  test('John and Jane should have different bigrams but similar phonetics', () => {
    const testCases = generateHybridSearchTestCases();

    const johnCase = testCases.find((c) => c.debtor.name === 'John Smith');
    const janeCase = testCases.find((c) => c.debtor.name === 'Jane Doe');

    const johnBigrams = johnCase.debtor.phoneticTokens.filter(
      (t) => t === t.toLowerCase() && t.length === 2,
    );
    const janeBigrams = janeCase.debtor.phoneticTokens.filter(
      (t) => t === t.toLowerCase() && t.length === 2,
    );

    const sharedBigrams = johnBigrams.filter((b) => janeBigrams.includes(b));
    expect(sharedBigrams.length).toBe(0);

    const johnPhonetics = johnCase.debtor.phoneticTokens.filter((t) => /^[A-Z0-9]+$/.test(t));
    const janePhonetics = janeCase.debtor.phoneticTokens.filter((t) => /^[A-Z0-9]+$/.test(t));

    const sharedPhonetics = johnPhonetics.filter((p) => janePhonetics.includes(p));
    expect(sharedPhonetics.length).toBeGreaterThan(0);
  });
});
