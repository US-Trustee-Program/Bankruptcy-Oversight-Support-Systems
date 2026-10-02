import { describe, test, expect } from 'vitest';
import {
  recoverLastFirstRoleSwap,
  shouldSkipAsNotAPerson,
  stripAdministrativeMarkers,
} from './acms-name-normalization.helpers';

describe('shouldSkipAsNotAPerson', () => {
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

describe('stripAdministrativeMarkers', () => {
  // Models a chapter marker glued onto a word, leaving no word boundary before the marker.
  test.each([
    ['DOYLECH13', 'DOYLE'],
    ['TACOMACH13', 'TACOMA'],
    ['DOYLECHAPTER13', 'DOYLE'],
  ])('strips a chapter marker glued onto the end of a word: "%s" -> "%s"', (input, expected) => {
    expect(stripAdministrativeMarkers(input)).toBe(expected);
  });

  test('still strips a spaced chapter marker (existing coverage, must not regress)', () => {
    expect(stripAdministrativeMarkers('Jordan W Roe Chapter 12')).toBe('Jordan W Roe');
  });

  test('does not strip a real surname that merely contains "ch" as a substring', () => {
    expect(stripAdministrativeMarkers('Church')).toBe('Church');
  });

  test('does not strip a real surname ending in a number-free "ch"-containing word', () => {
    expect(stripAdministrativeMarkers('Finch')).toBe('Finch');
  });
});

describe('recoverLastFirstRoleSwap', () => {
  test('swaps LAST, FIRST out of lastName when firstName is pure role-phrase noise', () => {
    expect(recoverLastFirstRoleSwap('LIQUIDATING TRUSTEE', 'PELLETIER, DEVIN')).toEqual({
      firstName: 'DEVIN',
      lastName: 'PELLETIER',
    });
  });

  test('leaves the record untouched when firstName is a real name, even with a comma in lastName', () => {
    // A comma alone is not a swap; here it precedes a generational suffix.
    expect(recoverLastFirstRoleSwap('Devin', 'Pelletier, Jr.')).toEqual({
      firstName: 'Devin',
      lastName: 'Pelletier, Jr.',
    });
  });

  test('leaves the record untouched when lastName has no comma at all', () => {
    expect(recoverLastFirstRoleSwap('LIQUIDATING TRUSTEE', 'Pelletier')).toEqual({
      firstName: 'LIQUIDATING TRUSTEE',
      lastName: 'Pelletier',
    });
  });

  test('leaves the record untouched when firstName is empty (recoverSoloPracticeName territory, not this)', () => {
    expect(recoverLastFirstRoleSwap('', 'Pelletier, Devin')).toEqual({
      firstName: '',
      lastName: 'Pelletier, Devin',
    });
  });
});
