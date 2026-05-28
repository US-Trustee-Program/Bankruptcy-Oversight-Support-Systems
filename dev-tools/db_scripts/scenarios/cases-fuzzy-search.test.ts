import { describe, test, expect, vi } from 'vitest';
import type { SeedContext } from '../../runner.js';
import { generate } from './cases-fuzzy-search.js';

describe('cases-fuzzy-search scenario', () => {
  const mockContext: SeedContext = {
    generateCaseId: vi.fn(),
  };

  test('generates 43 cases with diverse debtor names', async () => {
    const ops = await generate(mockContext);

    expect(ops).toHaveLength(1);
    expect(ops[0].db).toBe('cams');
    expect(ops[0].collectionOrTable).toBe('cases');
    expect(ops[0].data).toHaveLength(43);
  });

  test('all cases have documentType SYNCED_CASE', async () => {
    const ops = await generate(mockContext);
    const cases = ops[0].data;

    cases.forEach((caseDoc: Record<string, unknown>) => {
      expect(caseDoc.documentType).toBe('SYNCED_CASE');
      expect(caseDoc.caseId).toBeTruthy();
      expect((caseDoc.debtor as { name: string }).name).toBeTruthy();
    });
  });

  test('includes phonetic variations (John/Jon, Cathy/Kathy, Steven/Stephen)', async () => {
    const ops = await generate(mockContext);
    const debtorNames = ops[0].data.map(
      (c: Record<string, unknown>) => (c.debtor as { name: string }).name,
    );

    expect(debtorNames).toContain('John Anderson');
    expect(debtorNames).toContain('Jon Anderson');
    expect(debtorNames).toContain('Cathy Martinez');
    expect(debtorNames).toContain('Kathy Martinez');
    expect(debtorNames).toContain('Steven Wilson');
    expect(debtorNames).toContain('Stephen Wilson');
  });

  test('includes Jane variations (Jane/Jayne/Jaine)', async () => {
    const ops = await generate(mockContext);
    const debtorNames = ops[0].data.map(
      (c: Record<string, unknown>) => (c.debtor as { name: string }).name,
    );

    expect(debtorNames).toContain('Jane Thompson');
    expect(debtorNames).toContain('Jayne Thompson');
    expect(debtorNames).toContain('Jaine Thompson');
  });

  test('includes Arab name spelling variations', async () => {
    const ops = await generate(mockContext);
    const debtorNames = ops[0].data.map(
      (c: Record<string, unknown>) => (c.debtor as { name: string }).name,
    );

    // Mohammed variations
    expect(debtorNames).toContain('Mohammed Ali');
    expect(debtorNames).toContain('Muhammad Ali');
    expect(debtorNames).toContain('Mohamed Ali');

    // Ahmad/Ahmed
    expect(debtorNames).toContain('Ahmad Hassan');
    expect(debtorNames).toContain('Ahmed Hassan');

    // Fatima/Fatimah
    expect(debtorNames).toContain('Fatima Hussein');
    expect(debtorNames).toContain('Fatimah Hussein');

    // Khalid/Khaled
    expect(debtorNames).toContain('Khalid Ibrahim');
    expect(debtorNames).toContain('Khaled Ibrahim');
  });

  test('includes special characters (apostrophes, accents)', async () => {
    const ops = await generate(mockContext);
    const debtorNames = ops[0].data.map(
      (c: Record<string, unknown>) => (c.debtor as { name: string }).name,
    );

    expect(debtorNames).toContain("Patrick O'Brien");
    expect(debtorNames).toContain('José García');
    expect(debtorNames).toContain('François Müller');
  });

  test('includes hyphenated names', async () => {
    const ops = await generate(mockContext);
    const debtorNames = ops[0].data.map(
      (c: Record<string, unknown>) => (c.debtor as { name: string }).name,
    );

    expect(debtorNames).toContain('Mary Smith-Jones');
    expect(debtorNames).toContain('David Parker-Thompson');
  });

  test('includes joint debtors', async () => {
    const ops = await generate(mockContext);
    const debtorNames = ops[0].data.map(
      (c: Record<string, unknown>) => (c.debtor as { name: string }).name,
    );

    expect(debtorNames).toContain('James Williams and Patricia Rodriguez');
    expect(debtorNames).toContain('Christopher Taylor and Amanda Chen');
  });

  test('includes very long and very short names', async () => {
    const ops = await generate(mockContext);
    const debtorNames = ops[0].data.map(
      (c: Record<string, unknown>) => (c.debtor as { name: string }).name,
    );

    // Very long
    expect(debtorNames).toContain('Montgomery Bartholomew Wellington-Fitzpatrick III');

    // Very short
    expect(debtorNames).toContain('Li Wu');
    expect(debtorNames).toContain('Bo Kim');
    expect(debtorNames).toContain('Jo Lee');
  });

  test('cases span multiple districts', async () => {
    const ops = await generate(mockContext);
    const divisions = new Set(
      ops[0].data.map((c: Record<string, unknown>) => c.courtDivisionCode as string),
    );

    expect(divisions.size).toBeGreaterThan(4);
    expect(divisions).toContain('081'); // Manhattan
    expect(divisions).toContain('091'); // Manhattan
    expect(divisions).toContain('225'); // Los Angeles
    expect(divisions).toContain('923'); // Dallas
    expect(divisions).toContain('940'); // Tampa
    expect(divisions).toContain('001'); // Anchorage
  });

  test('includes multiple chapter types', async () => {
    const ops = await generate(mockContext);
    const chapters = new Set(ops[0].data.map((c: Record<string, unknown>) => c.chapter as string));

    expect(chapters).toContain('7');
    expect(chapters).toContain('11');
    expect(chapters).toContain('13');
  });
});
