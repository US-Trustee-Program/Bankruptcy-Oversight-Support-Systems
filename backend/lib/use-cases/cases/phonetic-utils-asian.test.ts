/* eslint-disable vitest/expect-expect */
import { describe, test, expect } from 'vitest';
import { generatePhoneticTokens, filterCasesByDebtorNameSimilarity } from './phonetic-utils';
import { SyncedCase } from '@common';

/**
 * Test cases for Asian names (romanized to ASCII)
 * Asian names face unique challenges:
 * - Very short (often 2-3 letters): Li, Wu, Kim, Lee
 * - Limited phonetic variation in romanization
 * - Same romanization can represent different characters
 * - Name order differences (surname first vs given name first)
 *
 * Examples:
 * - Chinese: Li, Wang, Zhang, Chen, Liu, Yang
 * - Korean: Kim, Lee, Park, Choi
 * - Vietnamese: Nguyen, Tran, Le, Pham
 * - Japanese: Tanaka, Suzuki, Takahashi, Watanabe
 *
 * These tests verify how Soundex/Metaphone handle short Asian names.
 */

describe('Phonetic Utils - Asian Names (Romanized ASCII)', () => {
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

  describe('Chinese names (most common surnames)', () => {
    test('should generate phonetic tokens for Chinese surnames', () => {
      const surnames = [
        'Li',
        'Wang',
        'Zhang',
        'Liu',
        'Chen',
        'Yang',
        'Huang',
        'Zhao',
        'Wu',
        'Zhou',
      ];

      console.log('\n=== Chinese Surnames - Phonetic Tokens ===');
      surnames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(10)} → ${tokens.join(', ')}`);
        expect(tokens.length).toBeGreaterThan(0);
      });

      // Note: Very short tokens due to short names
    });

    test('Li (李) - extremely short name challenges', () => {
      const cases = [
        createTestCase('Li Wang', '081-24-00001'),
        createTestCase('Lee Wang', '081-24-00002'), // Korean romanization of same sound
      ];

      const filteredLi = filterCasesByDebtorNameSimilarity(cases, 'Li');
      const filteredLee = filterCasesByDebtorNameSimilarity(cases, 'Lee');

      console.log(
        '\nSearch "Li":',
        filteredLi.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Lee":',
        filteredLee.map((c) => c.debtor?.name),
      );

      // Li vs Lee - should they match?
      // Li: L000, L
      // Lee: L000, L (same!)
    });

    test('Wang (王) vs common variations', () => {
      const cases = [
        createTestCase('Wang Chen', '081-24-00003'),
        createTestCase('Wong Chen', '081-24-00004'), // Cantonese romanization
      ];

      const filteredWang = filterCasesByDebtorNameSimilarity(cases, 'Wang');
      const filteredWong = filterCasesByDebtorNameSimilarity(cases, 'Wong');

      console.log(
        '\nSearch "Wang":',
        filteredWang.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Wong":',
        filteredWong.map((c) => c.debtor?.name),
      );

      // Wang/Wong are same surname, different romanization systems
    });

    test('Zhang (张) vs Chang vs Cheung (multiple romanizations)', () => {
      const cases = [
        createTestCase('Zhang Wei', '081-24-00005'),
        createTestCase('Chang Wei', '081-24-00006'), // Wade-Giles romanization
        createTestCase('Cheung Wei', '081-24-00007'), // Cantonese
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Zhang');
      console.log(
        '\nSearch "Zhang" (should find Chang/Cheung?):',
        filtered.map((c) => c.debtor?.name),
      );
      console.log('Matches:', filtered.length, '/ 3 romanizations');
    });
  });

  describe('Korean names', () => {
    test('should generate phonetic tokens for Korean surnames', () => {
      const surnames = ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim'];

      console.log('\n=== Korean Surnames - Phonetic Tokens ===');
      surnames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(10)} → ${tokens.join(', ')}`);
      });
    });

    test('Kim (김) - most common Korean name', () => {
      const cases = [createTestCase('Kim Lee', '081-24-00008')];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Kim');
      console.log(
        '\nKim search:',
        filtered.map((c) => c.debtor?.name),
      );

      expect(filtered.length).toBe(1);
    });

    test('Lee vs Li (Korean vs Chinese, same romanization)', () => {
      const cases = [
        createTestCase('Lee Park', '081-24-00009'), // Korean
        createTestCase('Li Park', '081-24-00010'), // Chinese
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Lee');
      console.log(
        '\nLee vs Li:',
        filtered.map((c) => c.debtor?.name),
      );

      // Different ethnicities, same phonetic romanization
      // Should they match?
    });

    test('Park vs Pak (romanization variants)', () => {
      const cases = [
        createTestCase('Park Min', '081-24-00011'),
        createTestCase('Pak Min', '081-24-00012'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Park');
      console.log(
        '\nPark vs Pak:',
        filtered.map((c) => c.debtor?.name),
      );

      // Same Korean surname, different romanization
    });
  });

  describe('Vietnamese names', () => {
    test('should generate phonetic tokens for Vietnamese surnames', () => {
      const surnames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Dang', 'Bui', 'Do', 'Ngo'];

      console.log('\n=== Vietnamese Surnames - Phonetic Tokens ===');
      surnames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(10)} → ${tokens.join(', ')}`);
      });
    });

    test('Nguyen (阮) - pronunciation challenges', () => {
      const cases = [
        createTestCase('Nguyen Tran', '081-24-00013'),
        createTestCase('Nguyễn Tran', '081-24-00014'), // With diacritics (normalized)
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Nguyen');
      console.log(
        '\nNguyen search:',
        filtered.map((c) => c.debtor?.name),
      );

      // Nguyen: English speakers often mispronounce
      // Common misspellings: Ngyuen, Nguyan, etc.
      expect(filtered.length).toBeGreaterThanOrEqual(1);
    });

    test('Le vs Lee (Vietnamese vs Korean/Chinese)', () => {
      const cases = [
        createTestCase('Le Tran', '081-24-00015'), // Vietnamese
        createTestCase('Lee Tran', '081-24-00016'), // Could be Korean or Chinese
      ];

      const filteredLe = filterCasesByDebtorNameSimilarity(cases, 'Le');
      const filteredLee = filterCasesByDebtorNameSimilarity(cases, 'Lee');

      console.log(
        '\nSearch "Le":',
        filteredLe.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Lee":',
        filteredLee.map((c) => c.debtor?.name),
      );

      // Same phonetic but different origins
    });
  });

  describe('Japanese names', () => {
    test('should generate phonetic tokens for Japanese surnames', () => {
      const surnames = [
        'Tanaka',
        'Suzuki',
        'Takahashi',
        'Watanabe',
        'Ito',
        'Yamamoto',
        'Nakamura',
        'Kobayashi',
        'Kato',
        'Yoshida',
      ];

      console.log('\n=== Japanese Surnames - Phonetic Tokens ===');
      surnames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(12)} → ${tokens.join(', ')}`);
      });
    });

    test('Suzuki (鈴木)', () => {
      const cases = [createTestCase('Suzuki Tanaka', '081-24-00017')];
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Suzuki');
      console.log(
        '\nSuzuki search:',
        filtered.map((c) => c.debtor?.name),
      );
      expect(filtered.length).toBe(1);
    });

    test('Ito vs Itoh (romanization variants)', () => {
      const cases = [
        createTestCase('Ito Yamamoto', '081-24-00018'),
        createTestCase('Itoh Yamamoto', '081-24-00019'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Ito');
      console.log(
        '\nIto vs Itoh:',
        filtered.map((c) => c.debtor?.name),
      );

      // Same name, different romanization (adding H)
    });
  });

  describe('Edge cases with very short names', () => {
    test('Two-letter names (extreme challenge)', () => {
      const names = ['Li', 'Wu', 'Yu', 'Xu', 'Ma', 'Lu', 'Gu', 'He', 'Le', 'Do'];

      console.log('\n=== Two-Letter Names - Phonetic Tokens ===');
      names.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`${name.padEnd(10)} → ${tokens.join(', ')}`);
      });

      // Very minimal phonetic information
      expect(names.every((name) => generatePhoneticTokens(name).length > 0)).toBe(true);
    });

    test('Li vs Lee vs Le (all common Asian surnames)', () => {
      const cases = [
        createTestCase('Li Chen', '081-24-00020'),
        createTestCase('Lee Chen', '081-24-00021'),
        createTestCase('Le Chen', '081-24-00022'),
      ];

      const filteredLi = filterCasesByDebtorNameSimilarity(cases, 'Li');
      const filteredLee = filterCasesByDebtorNameSimilarity(cases, 'Lee');
      const filteredLe = filterCasesByDebtorNameSimilarity(cases, 'Le');

      console.log(
        '\nSearch "Li":',
        filteredLi.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Lee":',
        filteredLee.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Le":',
        filteredLe.map((c) => c.debtor?.name),
      );

      // All phonetically similar but different surnames
      console.log('Cross-matches:', {
        'Li finds Lee/Le': filteredLi.length === 3,
        'Lee finds Li/Le': filteredLee.length === 3,
        'Le finds Li/Lee': filteredLe.length === 3,
      });
    });

    test('Kim vs Jim (Asian vs English)', () => {
      const cases = [
        createTestCase('Kim Park', '081-24-00023'),
        createTestCase('Jim Park', '081-24-00024'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Kim');
      console.log(
        '\nKim vs Jim:',
        filtered.map((c) => c.debtor?.name),
      );

      // Should NOT match (different names)
    });
  });

  describe('False positive risks with short names', () => {
    test('Li vs common English names', () => {
      const cases = [
        createTestCase('Li Wang', '081-24-00025'),
        createTestCase('Lee Wang', '081-24-00026'),
        createTestCase('Lea Wang', '081-24-00027'),
        createTestCase('Liz Wang', '081-24-00028'), // Different name
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Li');
      console.log(
        '\nLi vs English variants:',
        filtered.map((c) => c.debtor?.name),
      );
      console.log('Matches:', filtered.length, '/ 4 names');

      // Li should match Lee/Lea but NOT Liz
    });

    test('Wu vs similar short names', () => {
      const cases = [
        createTestCase('Wu Chen', '081-24-00029'),
        createTestCase('Woo Chen', '081-24-00030'), // Korean variant
        createTestCase('Who Chen', '081-24-00031'), // Unlikely but possible typo
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Wu');
      console.log(
        '\nWu variants:',
        filtered.map((c) => c.debtor?.name),
      );
    });
  });

  describe('Name order (Asian vs Western)', () => {
    test('should handle surname-first vs given-first', () => {
      const cases = [
        createTestCase('Wang Li', '081-24-00032'), // Chinese traditional (surname first)
        createTestCase('Li Wang', '081-24-00033'), // Western order (given first)
      ];

      // Searching for "Wang" should find both
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Wang');
      console.log(
        '\nSearch "Wang" (in either position):',
        filtered.map((c) => c.debtor?.name),
      );

      // Both should match (Wang is in the name)
      expect(filtered.length).toBe(2);
    });

    test('full name search handles order', () => {
      const cases = [
        createTestCase('Zhang Wei', '081-24-00034'),
        createTestCase('Wei Zhang', '081-24-00035'), // Reversed
      ];

      const filtered1 = filterCasesByDebtorNameSimilarity(cases, 'Zhang Wei');
      const filtered2 = filterCasesByDebtorNameSimilarity(cases, 'Wei Zhang');

      console.log(
        '\nSearch "Zhang Wei":',
        filtered1.map((c) => c.debtor?.name),
      );
      console.log(
        'Search "Wei Zhang":',
        filtered2.map((c) => c.debtor?.name),
      );

      // Each should find its exact match
    });
  });

  describe('Real-world Asian name matching', () => {
    test('should handle common Chinese full names', () => {
      const cases = [
        createTestCase('Li Wei Chen', '081-24-00036'),
        createTestCase('Wang Ming Liu', '081-24-00037'),
        createTestCase('Zhang Xiao Yu', '081-24-00038'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Li Wei');
      console.log(
        '\nFull name search:',
        filtered.map((c) => c.debtor?.name),
      );

      expect(filtered.length).toBeGreaterThanOrEqual(1);
    });

    test('should not cross-match unrelated Asian names', () => {
      const cases = [
        createTestCase('Kim Lee', '081-24-00039'),
        createTestCase('Nguyen Tran', '081-24-00040'),
        createTestCase('Tanaka Suzuki', '081-24-00041'),
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Kim');
      console.log(
        '\nKim search (should not match Nguyen/Tanaka):',
        filtered.map((c) => c.debtor?.name),
      );

      expect(filtered.some((c) => c.debtor?.name === 'Kim Lee')).toBe(true);
      expect(filtered.some((c) => c.debtor?.name === 'Nguyen Tran')).toBe(false);
      expect(filtered.some((c) => c.debtor?.name === 'Tanaka Suzuki')).toBe(false);
    });
  });

  describe('Jaro-Winkler for short Asian names', () => {
    test('should show similarity scores for short names', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const natural = require('natural');

      console.log('\n=== Asian Name Similarity Scores (Threshold: 0.83) ===');

      const pairs = [
        ['Li', 'Lee'],
        ['Li', 'Le'],
        ['Li', 'Liz'],
        ['Wang', 'Wong'],
        ['Zhang', 'Chang'],
        ['Kim', 'Jim'],
        ['Kim', 'Tim'],
        ['Park', 'Pak'],
        ['Nguyen', 'Nguyễn'],
        ['Ito', 'Itoh'],
      ];

      pairs.forEach(([name1, name2]) => {
        const score = natural.JaroWinklerDistance(name1, name2);
        const match = score >= 0.83 ? '✓ MATCH' : '✗ NO MATCH';
        console.log(`${name1.padEnd(12)} vs ${name2.padEnd(12)}: ${score.toFixed(3)} ${match}`);
      });
    });
  });

  describe('Phonetic token sparsity for short names', () => {
    test('should show how short names have minimal phonetic info', () => {
      const shortNames = ['Li', 'Wu', 'Ma', 'Xu'];
      const longNames = ['Watanabe', 'Takahashi', 'Nakamura', 'Kobayashi'];

      console.log('\n=== Phonetic Token Count: Short vs Long Names ===');

      console.log('Short names (2 chars):');
      shortNames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`  ${name.padEnd(10)} → ${tokens.length} tokens: ${tokens.join(', ')}`);
      });

      console.log('\nLong names (8+ chars):');
      longNames.forEach((name) => {
        const tokens = generatePhoneticTokens(name);
        console.log(`  ${name.padEnd(12)} → ${tokens.length} tokens: ${tokens.join(', ')}`);
      });

      // Short names have very few tokens (less phonetic info)
      // This makes them harder to match accurately
    });
  });
});
