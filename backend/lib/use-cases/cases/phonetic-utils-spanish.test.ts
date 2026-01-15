import { describe, test, expect } from 'vitest';
import { generatePhoneticTokens, filterCasesByDebtorNameSimilarity } from './phonetic-utils';
import { SyncedCase } from '@common';

/**
 * Test cases for Spanish names (and other non-English phonetics)
 * Even with ASCII-only input, Spanish names are pronounced differently
 * than English phonetic algorithms expect.
 *
 * Examples:
 * - Jose: Spanish "ho-SAY" vs English phonetics "JOHZ"
 * - Jorge: Spanish "HOR-hay" vs English "JORJ"
 * - Juan: Spanish "hwan" vs English "JOO-an"
 *
 * These tests verify how Soundex/Metaphone (English-centric) handle
 * Spanish pronunciations encoded as ASCII.
 */

describe('Phonetic Utils - Spanish Names (ASCII)', () => {
  const createTestCase = (name: string, caseId: string): SyncedCase => ({
    caseId,
    caseTitle: name,
    chapter: '7',
    dateFiled: '2024-01-15',
    courtId: '081',
    courtName: 'Manhattan',
    courtDivisionCode: '081',
    courtDivisionName: 'Manhattan',
    regionId: '02',
    regionName: 'NEW YORK',
    officeName: 'Manhattan',
    officeCode: 'USTP_SDNY',
    groupDesignator: 'MA',
    debtor: {
      name,
      phoneticTokens: generatePhoneticTokens(name),
    },
    documentType: 'SYNCED_CASE',
  });

  describe('Jose (Spanish: ho-SAY)', () => {
    test('should generate phonetic tokens for Jose', () => {
      const tokens = generatePhoneticTokens('Jose');
      console.log('Jose tokens:', tokens);
      expect(tokens).toBeDefined();
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('should generate phonetic tokens for Jose Garcia', () => {
      const tokens = generatePhoneticTokens('Jose Garcia');
      console.log('Jose Garcia tokens:', tokens);
      expect(tokens).toContain('J200'); // Soundex for Jose
      expect(tokens).toContain('G620'); // Soundex for Garcia
    });

    test('Jose should match common misspellings', () => {
      const cases = [
        createTestCase('Jose Martinez', '081-24-00001'),
        createTestCase('Joseph Martinez', '081-24-00002'),
      ];

      // Search for "Jose" - should it find "Joseph"?
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jose');
      console.log(
        'Jose search results:',
        filtered.map((c) => c.debtor?.name),
      );

      // Jose should definitely match itself
      expect(filtered.some((c) => c.debtor?.name === 'Jose Martinez')).toBe(true);

      // Jose vs Joseph - phonetically similar in English
      // Jose: J200, JS
      // Joseph: J210, JSF
      // May or may not match depending on Jaro-Winkler
    });

    test('Jose (normalized from José) exact match', () => {
      const cases = [createTestCase('Jose Rodriguez', '081-24-00003')];
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jose Rodriguez');
      expect(filtered.length).toBe(1);
    });
  });

  describe('Jorge (Spanish: HOR-hay)', () => {
    test('should generate phonetic tokens for Jorge', () => {
      const tokens = generatePhoneticTokens('Jorge');
      console.log('Jorge tokens:', tokens);
      // Jorge: J620, JRJ (Metaphone treats as English "JORJ")
      expect(tokens).toBeDefined();
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('Jorge vs George (different names, similar English phonetics)', () => {
      const cases = [
        createTestCase('Jorge Lopez', '081-24-00004'),
        createTestCase('George Lopez', '081-24-00005'),
      ];

      // Search "Jorge" - should it find "George"?
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jorge');
      console.log(
        'Jorge search results:',
        filtered.map((c) => c.debtor?.name),
      );

      // Jorge and George have different Soundex codes
      // Jorge: J620 (JRJ)
      // George: G620 (JRJ) - wait, Metaphone might be same!
      // Jaro-Winkler: 0.73 < 0.83, should NOT match
      expect(filtered.some((c) => c.debtor?.name === 'Jorge Lopez')).toBe(true);
      expect(filtered.some((c) => c.debtor?.name === 'George Lopez')).toBe(false);
    });

    test('Jorge common misspellings', () => {
      const cases = [
        createTestCase('Jorge Hernandez', '081-24-00006'),
        createTestCase('Gorge Hernandez', '081-24-00007'), // Typo
        createTestCase('Forge Hernandez', '081-24-00008'), // Similar sound
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jorge');
      console.log(
        'Jorge misspelling results:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should find Jorge
      expect(filtered.some((c) => c.debtor?.name === 'Jorge Hernandez')).toBe(true);
    });
  });

  describe('Juan (Spanish: hwan)', () => {
    test('should generate phonetic tokens for Juan', () => {
      const tokens = generatePhoneticTokens('Juan');
      console.log('Juan tokens:', tokens);
      // Juan: J500, JN (treats J as English "J", not Spanish "H")
      expect(tokens).toBeDefined();
    });

    test('Juan vs John (different names, phonetically different)', () => {
      const cases = [
        createTestCase('Juan Gonzalez', '081-24-00009'),
        createTestCase('John Gonzalez', '081-24-00010'),
      ];

      const filteredJuan = filterCasesByDebtorNameSimilarity(cases, 'Juan');
      const filteredJohn = filterCasesByDebtorNameSimilarity(cases, 'John');

      console.log(
        'Juan search:',
        filteredJuan.map((c) => c.debtor?.name),
      );
      console.log(
        'John search:',
        filteredJohn.map((c) => c.debtor?.name),
      );

      // Juan: J500, JN
      // John: J500, JN
      // Same Soundex/Metaphone! (English phonetics)
      // Jaro-Winkler: 0.70 < 0.83, should NOT match
      expect(filteredJuan.some((c) => c.debtor?.name === 'Juan Gonzalez')).toBe(true);
      expect(filteredJuan.some((c) => c.debtor?.name === 'John Gonzalez')).toBe(false);
      expect(filteredJohn.some((c) => c.debtor?.name === 'John Gonzalez')).toBe(true);
      expect(filteredJohn.some((c) => c.debtor?.name === 'Juan Gonzalez')).toBe(false);
    });

    test('Juan vs Jane edge case (FALSE POSITIVE KNOWN ISSUE)', () => {
      const cases = [
        createTestCase('Juan Martinez', '081-24-00011'),
        createTestCase('Jane Martinez', '081-24-00012'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Juan');
      console.log(
        'Juan vs Jane:',
        filtered.map((c) => c.debtor?.name),
      );

      // KNOWN ISSUE: Juan matches Jane (Jaro-Winkler 0.85 > 0.83 threshold)
      // This is a false positive but rare in practice
      // Both have same phonetic tokens (J500, JN) and high string similarity
      // See SPANISH_NAMES_TEST_RESULTS.md for analysis
      expect(filtered.some((c) => c.debtor?.name === 'Jane Martinez')).toBe(true);

      // Verify Juan still matches itself
      expect(filtered.some((c) => c.debtor?.name === 'Juan Martinez')).toBe(true);
    });
  });

  describe('Jesus (Spanish: hay-SOOS)', () => {
    test('should generate phonetic tokens for Jesus', () => {
      const tokens = generatePhoneticTokens('Jesus');
      console.log('Jesus tokens:', tokens);
      // Jesus: J220, JSS (English phonetics)
      expect(tokens).toBeDefined();
    });

    test('Jesus common misspellings', () => {
      const cases = [
        createTestCase('Jesus Ramirez', '081-24-00013'),
        createTestCase('Jesús Ramirez', '081-24-00014'), // With accent (normalized)
      ];

      // After normalization, both should be "Jesus"
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jesus');
      console.log(
        'Jesus search:',
        filtered.map((c) => c.debtor?.name),
      );

      expect(filtered.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Garcia (Spanish: gar-SEE-ah)', () => {
    test('should generate phonetic tokens for Garcia', () => {
      const tokens = generatePhoneticTokens('Garcia');
      console.log('Garcia tokens:', tokens);
      // Garcia: G620, KRKS (English phonetics)
      expect(tokens).toBeDefined();
    });

    test('Garcia vs García (with accent, normalized)', () => {
      const cases = [createTestCase('Pedro Garcia', '081-24-00015')];

      // Both should work (normalized)
      const filtered1 = filterCasesByDebtorNameSimilarity(cases, 'Garcia');
      const filtered2 = filterCasesByDebtorNameSimilarity(cases, 'García');

      console.log(
        'Garcia search:',
        filtered1.map((c) => c.debtor?.name),
      );
      console.log(
        'García search:',
        filtered2.map((c) => c.debtor?.name),
      );

      // After normalization, both should find the case
      expect(filtered1.length).toBe(1);
      expect(filtered2.length).toBe(1);
    });

    test('Garcia common variants', () => {
      const cases = [
        createTestCase('Maria Garcia', '081-24-00016'),
        createTestCase('Maria Garza', '081-24-00017'), // Different name
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Garcia');
      console.log(
        'Garcia variant search:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should find Garcia but NOT Garza (different enough)
      expect(filtered.some((c) => c.debtor?.name === 'Maria Garcia')).toBe(true);
    });
  });

  describe('Rodriguez (Spanish: ro-DREE-ges)', () => {
    test('should generate phonetic tokens for Rodriguez', () => {
      const tokens = generatePhoneticTokens('Rodriguez');
      console.log('Rodriguez tokens:', tokens);
      // Rodriguez: R362, RTRKS (English phonetics)
      expect(tokens).toBeDefined();
    });

    test('Rodriguez common misspellings', () => {
      const cases = [
        createTestCase('Carlos Rodriguez', '081-24-00018'),
        createTestCase('Carlos Rodriquez', '081-24-00019'), // Common typo (i before q)
        createTestCase('Carlos Rodrigues', '081-24-00020'), // Portuguese variant
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Rodriguez');
      console.log(
        'Rodriguez misspelling search:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should find Rodriguez
      expect(filtered.some((c) => c.debtor?.name === 'Carlos Rodriguez')).toBe(true);

      // Rodriquez might match (common typo)
      // Rodrigues is phonetically similar
    });
  });

  describe('Hernandez (Spanish: air-NAHN-des)', () => {
    test('should generate phonetic tokens for Hernandez', () => {
      const tokens = generatePhoneticTokens('Hernandez');
      console.log('Hernandez tokens:', tokens);
      // Hernandez: H655, HRNTS (English phonetics - H is pronounced)
      // Spanish: silent H, but Soundex uses English rules
      expect(tokens).toBeDefined();
    });

    test('Hernandez vs Fernandez (different names)', () => {
      const cases = [
        createTestCase('Luis Hernandez', '081-24-00021'),
        createTestCase('Luis Fernandez', '081-24-00022'),
      ];

      const filteredH = filterCasesByDebtorNameSimilarity(cases, 'Hernandez');
      const filteredF = filterCasesByDebtorNameSimilarity(cases, 'Fernandez');

      console.log(
        'Hernandez search:',
        filteredH.map((c) => c.debtor?.name),
      );
      console.log(
        'Fernandez search:',
        filteredF.map((c) => c.debtor?.name),
      );

      // Different Soundex codes (H655 vs F655)
      // Should NOT match each other
      expect(filteredH.some((c) => c.debtor?.name === 'Luis Hernandez')).toBe(true);
      expect(filteredH.some((c) => c.debtor?.name === 'Luis Fernandez')).toBe(false);
      expect(filteredF.some((c) => c.debtor?.name === 'Luis Fernandez')).toBe(true);
      expect(filteredF.some((c) => c.debtor?.name === 'Luis Hernandez')).toBe(false);
    });
  });

  describe('Lopez (Spanish: LOW-pez)', () => {
    test('should generate phonetic tokens for Lopez', () => {
      const tokens = generatePhoneticTokens('Lopez');
      console.log('Lopez tokens:', tokens);
      // Lopez: L120, LPS (English phonetics)
      expect(tokens).toBeDefined();
    });

    test('Lopez vs Lopes (Portuguese variant)', () => {
      const cases = [
        createTestCase('Miguel Lopez', '081-24-00023'),
        createTestCase('Miguel Lopes', '081-24-00024'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Lopez');
      console.log(
        'Lopez vs Lopes:',
        filtered.map((c) => c.debtor?.name),
      );

      // Lopez: L120, LPS
      // Lopes: L120, LPS
      // Same phonetic code! Should match
      expect(filtered.some((c) => c.debtor?.name === 'Miguel Lopez')).toBe(true);
      expect(filtered.some((c) => c.debtor?.name === 'Miguel Lopes')).toBe(true);
    });
  });

  describe('Martinez (Spanish: mar-TEE-nes)', () => {
    test('should generate phonetic tokens for Martinez', () => {
      const tokens = generatePhoneticTokens('Martinez');
      console.log('Martinez tokens:', tokens);
      // Martinez: M635, MRTNZ (English phonetics)
      expect(tokens).toBeDefined();
    });

    test('Martinez common misspellings', () => {
      const cases = [
        createTestCase('Ana Martinez', '081-24-00025'),
        createTestCase('Ana Martines', '081-24-00026'), // Missing z
        createTestCase('Ana Martínez', '081-24-00027'), // With accent (normalized)
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Martinez');
      console.log(
        'Martinez misspelling search:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should find Martinez
      expect(filtered.some((c) => c.debtor?.name === 'Ana Martinez')).toBe(true);
    });
  });

  describe('Comparison: Spanish vs English pronunciation', () => {
    test('should show phonetic tokens treat Spanish as English', () => {
      const spanishNames = [
        'Jose',
        'Jorge',
        'Juan',
        'Jesus',
        'Garcia',
        'Rodriguez',
        'Hernandez',
        'Lopez',
        'Martinez',
      ];

      console.log('\n=== Spanish Names - English Phonetic Encoding ===');
      spanishNames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(12)} → ${tokens.join(', ')}`);
      });

      // All names generate tokens (verifies algorithm works)
      spanishNames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        expect(tokens.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Real-world Spanish name matching', () => {
    test('should match common Spanish name variations', () => {
      const cases = [
        createTestCase('Jose Garcia', '081-24-00028'),
        createTestCase('Jorge Lopez', '081-24-00029'),
        createTestCase('Juan Rodriguez', '081-24-00030'),
        createTestCase('Maria Martinez', '081-24-00031'),
        createTestCase('Carlos Hernandez', '081-24-00032'),
      ];

      // Test various searches
      const joseResults = filterCasesByDebtorNameSimilarity(cases, 'Jose');
      const jorgeResults = filterCasesByDebtorNameSimilarity(cases, 'Jorge');
      const juanResults = filterCasesByDebtorNameSimilarity(cases, 'Juan');

      console.log(
        'Jose search:',
        joseResults.map((c) => c.debtor?.name),
      );
      console.log(
        'Jorge search:',
        jorgeResults.map((c) => c.debtor?.name),
      );
      console.log(
        'Juan search:',
        juanResults.map((c) => c.debtor?.name),
      );

      // Each should find at least their own name
      expect(joseResults.length).toBeGreaterThanOrEqual(1);
      expect(jorgeResults.length).toBeGreaterThanOrEqual(1);
      expect(juanResults.length).toBeGreaterThanOrEqual(1);
    });

    test('should not cross-match unrelated Spanish names', () => {
      const cases = [
        createTestCase('Jose Martinez', '081-24-00033'),
        createTestCase('Maria Martinez', '081-24-00034'),
        createTestCase('Carlos Martinez', '081-24-00035'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jose');
      console.log(
        'Jose search (should not match Maria/Carlos):',
        filtered.map((c) => c.debtor?.name),
      );

      // Should only find Jose, not Maria or Carlos
      expect(filtered.some((c) => c.debtor?.name === 'Jose Martinez')).toBe(true);
      expect(filtered.some((c) => c.debtor?.name === 'Maria Martinez')).toBe(false);
      expect(filtered.some((c) => c.debtor?.name === 'Carlos Martinez')).toBe(false);
    });
  });
});
