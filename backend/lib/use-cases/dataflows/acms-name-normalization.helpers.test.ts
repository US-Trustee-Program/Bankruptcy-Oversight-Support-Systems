import { describe, test, expect } from 'vitest';
import {
  recoverLastFirstRoleSwap,
  shouldSkipAsNotAPerson,
  stripAdministrativeMarkers,
} from './acms-name-normalization.helpers';

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

describe('stripAdministrativeMarkers', () => {
  // Real shape (2026-09-25 staging export, names synthesized): a chapter-number marker glued
  // directly onto a surname or fullName token, with no separating space/punctuation for
  // ADMINISTRATIVE_MARKER_PATTERN's \b word-boundary anchor to find - the glued token reads as one
  // continuous alphanumeric run, so the existing chapter\s*\d+/ch\.?\s*\d+ phrases never matched.
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
  // Real shape (2026-09-25 staging export, name synthesized): firstName "LIQUIDATING TRUSTEE",
  // lastName "PELLETIER, DEVIN" - the real name is entirely in lastName, in LAST, FIRST order,
  // because firstName carries only a role phrase with no real name content at all.
  test('swaps LAST, FIRST out of lastName when firstName is pure role-phrase noise', () => {
    expect(recoverLastFirstRoleSwap('LIQUIDATING TRUSTEE', 'PELLETIER, DEVIN')).toEqual({
      firstName: 'DEVIN',
      lastName: 'PELLETIER',
    });
  });

  test('leaves the record untouched when firstName is a real name, even with a comma in lastName', () => {
    // A comma in lastName isn't proof of a LAST, FIRST swap on its own - only firstName being
    // pure role-phrase noise makes it one; a populated real firstName means CMMPR recorded this
    // normally and the comma is something else entirely (e.g. a generational suffix).
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
