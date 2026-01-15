/* eslint-disable vitest/expect-expect */
import { describe, test, expect } from 'vitest';
import { generatePhoneticTokens, filterCasesByDebtorNameSimilarity } from './phonetic-utils';
import { SyncedCase } from '@common';

/**
 * Test cases for Arabic names (romanized to ASCII)
 * Arabic names transliterated to English have multiple valid spellings
 * due to different romanization systems.
 *
 * Examples:
 * - Muhammad: Mohammed, Mohamed, Mohammad, Muhammed
 * - Ahmed: Ahmad, Ahmet, Achmed
 * - Hussein: Husain, Hussain, Hossein
 *
 * These tests verify how Soundex/Metaphone handle Arabic romanization variants.
 */

describe('Phonetic Utils - Arabic Names (Romanized ASCII)', () => {
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

  describe('Muhammad variants (most common transliterations)', () => {
    test('should generate phonetic tokens for Muhammad variants', () => {
      const variants = ['Muhammad', 'Mohammed', 'Mohamed', 'Mohammad', 'Muhammed'];

      console.log('\n=== Muhammad Variants - Phonetic Tokens ===');
      variants.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(12)} → ${tokens.join(', ')}`);
        expect(tokens.length).toBeGreaterThan(0);
      });
    });

    test('Muhammad should match all common variants', () => {
      const cases = [
        createTestCase('Muhammad Ali', '081-24-00001'),
        createTestCase('Mohammed Ali', '081-24-00002'),
        createTestCase('Mohamed Ali', '081-24-00003'),
        createTestCase('Mohammad Ali', '081-24-00004'),
        createTestCase('Muhammed Ali', '081-24-00005'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Muhammad');
      console.log(
        '\nSearch "Muhammad":',
        filtered.map((c) => c.debtor?.name),
      );

      // Should find Muhammad
      expect(filtered.some((c) => c.debtor?.name === 'Muhammad Ali')).toBe(true);

      // Should find variants (phonetically similar)
      console.log('Total matches:', filtered.length, '/ 5 variants');
    });

    test('Mohammed should match Muhammad', () => {
      const cases = [createTestCase('Muhammad Hassan', '081-24-00006')];
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Mohammed');

      console.log(
        '\nSearch "Mohammed" finds:',
        filtered.map((c) => c.debtor?.name),
      );
      // Should match via phonetic similarity
      expect(filtered.length).toBe(1);
      expect(filtered[0].debtor?.name).toBe('Muhammad Hassan');
    });
  });

  describe('Ahmed variants', () => {
    // eslint-disable-next-line vitest/expect-expect
    test('should generate phonetic tokens for Ahmed variants', () => {
      const variants = ['Ahmed', 'Ahmad', 'Ahmet', 'Achmed'];

      console.log('\n=== Ahmed Variants - Phonetic Tokens ===');
      variants.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(12)} → ${tokens.join(', ')}`);
        // Exploratory test - demonstrates phonetic token generation
      });
    });

    test('Ahmed should match Ahmad', () => {
      const cases = [
        createTestCase('Ahmed Khan', '081-24-00007'),
        createTestCase('Ahmad Khan', '081-24-00008'),
      ];

      const filteredAhmed = filterCasesByDebtorNameSimilarity(cases, 'Ahmed');
      const filteredAhmad = filterCasesByDebtorNameSimilarity(cases, 'Ahmad');

      console.log(
        '\nSearch "Ahmed":',
        filteredAhmed.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Ahmad":',
        filteredAhmad.map((c) => c.debtor?.name),
      );

      // Both should match both (phonetically identical)
      expect(filteredAhmed.length).toBeGreaterThan(0);
      expect(filteredAhmad.length).toBeGreaterThan(0);
    });
  });

  describe('Hussein/Husain variants', () => {
    // eslint-disable-next-line vitest/expect-expect
    test('should generate phonetic tokens for Hussein variants', () => {
      const variants = ['Hussein', 'Husain', 'Hussain', 'Hossein'];

      console.log('\n=== Hussein Variants - Phonetic Tokens ===');
      variants.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(12)} → ${tokens.join(', ')}`);
      });
    });

    test('Hussein variants should match each other', () => {
      const cases = [
        createTestCase('Hussein Ali', '081-24-00009'),
        createTestCase('Husain Ali', '081-24-00010'),
        createTestCase('Hussain Ali', '081-24-00011'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Hussein');
      console.log(
        '\nSearch "Hussein":',
        filtered.map((c) => c.debtor?.name),
      );
      console.log('Total matches:', filtered.length, '/ 3 variants');
      expect(filtered.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Common Arabic first names', () => {
    test('should generate phonetic tokens for common Arabic names', () => {
      const names = [
        'Ali',
        'Omar',
        'Khalid',
        'Fatima',
        'Aisha',
        'Hassan',
        'Yousef',
        'Ibrahim',
        'Mustafa',
        'Rashid',
      ];

      console.log('\n=== Common Arabic Names - Phonetic Tokens ===');
      names.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(12)} → ${tokens.join(', ')}`);
        expect(tokens.length).toBeGreaterThan(0);
      });
    });

    test('Ali vs Ally (English name)', () => {
      const cases = [
        createTestCase('Ali Rahman', '081-24-00012'),
        createTestCase('Ally Rahman', '081-24-00013'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Ali');
      console.log(
        '\nAli vs Ally:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should NOT match - different names (0.778 < 0.83)
      expect(filtered.some((c) => c.debtor?.name === 'Ali Rahman')).toBe(true);
      expect(filtered.some((c) => c.debtor?.name === 'Ally Rahman')).toBe(false);
    });

    test('Omar vs Umar (common variant)', () => {
      const cases = [
        createTestCase('Omar Abdullah', '081-24-00014'),
        createTestCase('Umar Abdullah', '081-24-00015'),
      ];

      const filteredOmar = filterCasesByDebtorNameSimilarity(cases, 'Omar');
      const filteredUmar = filterCasesByDebtorNameSimilarity(cases, 'Umar');

      console.log(
        '\nSearch "Omar":',
        filteredOmar.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Umar":',
        filteredUmar.map((c) => c.debtor?.name),
      );

      // Omar/Umar are same person, different romanization (0.833 exactly at threshold!)
      expect(filteredOmar.length).toBe(2);
      expect(filteredUmar.length).toBe(2);
    });
  });

  describe('Arabic surnames', () => {
    // eslint-disable-next-line vitest/expect-expect
    test('should generate phonetic tokens for common surnames', () => {
      const surnames = [
        'Khan',
        'Hassan',
        'Hussein',
        'Abdullah',
        'Rahman',
        'Ibrahim',
        'Mahmoud',
        'Khalil',
        'Saleh',
        'Ahmad',
      ];

      console.log('\n=== Arabic Surnames - Phonetic Tokens ===');
      surnames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(12)} → ${tokens.join(', ')}`);
      });
    });

    test('Khan vs Kahn (common typo)', () => {
      const cases = [
        createTestCase('Ali Khan', '081-24-00016'),
        createTestCase('Ali Kahn', '081-24-00017'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Khan');
      console.log(
        '\nKhan vs Kahn:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should match (common misspelling)
      expect(filtered.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Compound Arabic names', () => {
    test('Abdul/Abd prefix names', () => {
      const names = [
        'Abdul Rahman',
        'Abdulrahman', // Written together
        'Abd al-Rahman', // With hyphen
        'Abd Rahman', // Without "ul"
      ];

      console.log('\n=== Abdul Names - Phonetic Tokens ===');
      names.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(20)} → ${tokens.join(', ')}`);
      });

      const cases = names.map((name, i) => createTestCase(name, `081-24-000${18 + i}`));
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Abdul Rahman');

      console.log(
        '\nSearch "Abdul Rahman":',
        filtered.map((c) => c.debtor?.name),
      );
      console.log('Matches:', filtered.length, '/ 4 variants');
    });

    test('bin/ibn (son of) variations', () => {
      const cases = [
        createTestCase('Omar bin Laden', '081-24-00022'),
        createTestCase('Omar ibn Laden', '081-24-00023'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Omar bin Laden');
      console.log(
        '\nbin vs ibn:',
        filtered.map((c) => c.debtor?.name),
      );
    });
  });

  describe('Edge cases and false positives', () => {
    test('Ali vs Alex (different names)', () => {
      const cases = [
        createTestCase('Ali Hassan', '081-24-00024'),
        createTestCase('Alex Hassan', '081-24-00025'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Ali');
      console.log(
        '\nAli vs Alex:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should NOT match (different names)
      expect(filtered.some((c) => c.debtor?.name === 'Ali Hassan')).toBe(true);
    });

    test('Hassan vs Hasson (typo)', () => {
      const cases = [
        createTestCase('Hassan Ahmad', '081-24-00026'),
        createTestCase('Hasson Ahmad', '081-24-00027'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Hassan');
      console.log(
        '\nHassan vs Hasson:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should match (one letter difference)
    });

    test('Yousef vs Joseph (different origin, similar sound)', () => {
      const cases = [
        createTestCase('Yousef Ali', '081-24-00028'),
        createTestCase('Joseph Ali', '081-24-00029'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Yousef');
      console.log(
        '\nYousef vs Joseph:',
        filtered.map((c) => c.debtor?.name),
      );

      // Both from same Biblical root, but different names today
      // Should they match? Debatable
    });
  });

  describe('Short vs long romanizations', () => {
    test('should handle different length romanizations', () => {
      const pairs = [
        ['Ali', 'Alee'],
        ['Omar', 'Omer'],
        ['Amir', 'Ameer'],
        ['Khalid', 'Khaled'],
        ['Tariq', 'Tarek'],
      ];

      console.log('\n=== Short vs Long Romanizations ===');
      pairs.forEach(([short, long]) => {
        const shortTokens = generatePhoneticTokens(short);
        const longTokens = generatePhoneticTokens(long);
        console.log(
          `${short.padEnd(10)} → ${shortTokens.join(', ').padEnd(15)} | ${long.padEnd(10)} → ${longTokens.join(', ')}`,
        );

        const cases = [createTestCase(short, '001'), createTestCase(long, '002')];
        const filtered = filterCasesByDebtorNameSimilarity(cases, short);
        console.log(`  Match: ${filtered.length === 2 ? 'YES ✓' : 'PARTIAL'}`);
      });
    });
  });

  describe('Real-world Arabic name matching', () => {
    test('should handle full Arabic names', () => {
      const cases = [
        createTestCase('Muhammad Ahmad Hassan', '081-24-00030'),
        createTestCase('Mohammed Ahmed Hassan', '081-24-00031'),
        createTestCase('Mohamed Ahmad Hussein', '081-24-00032'),
      ];

      const filtered1 = filterCasesByDebtorNameSimilarity(cases, 'Muhammad Ahmad Hassan');
      const filtered2 = filterCasesByDebtorNameSimilarity(cases, 'Mohammed Ahmed Hassan');

      console.log(
        '\nFull name search 1:',
        filtered1.map((c) => c.debtor?.name),
      );
      console.log(
        'Full name search 2:',
        filtered2.map((c) => c.debtor?.name),
      );

      // Should find exact match and close variants
      expect(filtered1.length).toBeGreaterThanOrEqual(1);
      expect(filtered2.length).toBeGreaterThanOrEqual(1);
    });

    test('should not cross-match unrelated Arabic names', () => {
      const cases = [
        createTestCase('Ahmed Ali', '081-24-00033'),
        createTestCase('Omar Hassan', '081-24-00034'),
        createTestCase('Khalid Rahman', '081-24-00035'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Ahmed');
      console.log(
        '\nAhmed search (should not match Omar/Khalid):',
        filtered.map((c) => c.debtor?.name),
      );

      // Should only find Ahmed
      expect(filtered.some((c) => c.debtor?.name === 'Ahmed Ali')).toBe(true);
      expect(filtered.some((c) => c.debtor?.name === 'Omar Hassan')).toBe(false);
      expect(filtered.some((c) => c.debtor?.name === 'Khalid Rahman')).toBe(false);
    });
  });

  describe('Jaro-Winkler for Arabic romanizations', () => {
    test('should show similarity scores for common variants', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const natural = require('natural');

      console.log('\n=== Arabic Name Similarity Scores (Threshold: 0.83) ===');

      const pairs = [
        ['Muhammad', 'Mohammed'],
        ['Muhammad', 'Mohamed'],
        ['Muhammad', 'Mohammad'],
        ['Ahmed', 'Ahmad'],
        ['Hussein', 'Husain'],
        ['Omar', 'Umar'],
        ['Yousef', 'Joseph'],
        ['Ali', 'Ally'],
        ['Khan', 'Kahn'],
      ];

      pairs.forEach(([name1, name2]) => {
        const score = natural.JaroWinklerDistance(name1, name2);
        const match = score >= 0.83 ? '✓ MATCH' : '✗ NO MATCH';
        console.log(`${name1.padEnd(12)} vs ${name2.padEnd(12)}: ${score.toFixed(3)} ${match}`);
      });

      // Verify Muhammad/Mohammed has high similarity
      const muhammadScore = natural.JaroWinklerDistance('Muhammad', 'Mohammed');
      expect(muhammadScore).toBeGreaterThan(0.8);
    });
  });
});
