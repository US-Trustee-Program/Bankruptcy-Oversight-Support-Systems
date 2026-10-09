import { describe, test, expect } from 'vitest';
import {
  isRecordDisavowed,
  recoverCorruptedFirstName,
  recoverLastFirstRoleSwap,
  recoverSoloPracticeName,
  shouldSkipAsNotAPerson,
  shouldSkipAsUstStaff,
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

  test.each([
    ['ALDRIC VEXMORE (DO NOT USE)', 'ALDRIC VEXMORE'],
    ['DECEASED - ALDRIC VEXMORE', 'ALDRIC VEXMORE'],
    ['ALDRIC VEXMORE (NP)', 'ALDRIC VEXMORE'],
    ['ALDRIC VEXMORE LIQ TR', 'ALDRIC VEXMORE'],
  ])('strips a status or role marker: "%s" -> "%s"', (input, expected) => {
    expect(stripAdministrativeMarkers(input)).toBe(expected);
  });

  test('leaves a short marker inside a word untouched', () => {
    expect(stripAdministrativeMarkers('QUINPORE')).toBe('QUINPORE');
  });

  test('strips a spaced chapter marker', () => {
    expect(stripAdministrativeMarkers('Jordan W Roe Chapter 12')).toBe('Jordan W Roe');
  });

  test.each([['Church'], ['Finch']])(
    'leaves a surname containing "ch" with no chapter number untouched: "%s"',
    (surname) => {
      expect(stripAdministrativeMarkers(surname)).toBe(surname);
    },
  );
});

describe('recoverLastFirstRoleSwap', () => {
  test('swaps LAST, FIRST out of lastName when firstName is pure role-phrase noise', () => {
    expect(recoverLastFirstRoleSwap('LIQUIDATING TRUSTEE', 'ROE, JORDAN')).toEqual({
      firstName: 'JORDAN',
      lastName: 'ROE',
    });
  });

  test('leaves the record untouched when firstName is a real name, even with a comma in lastName', () => {
    // A comma alone is not a swap; here it precedes a generational suffix.
    expect(recoverLastFirstRoleSwap('Jordan', 'Roe, Jr.')).toEqual({
      firstName: 'Jordan',
      lastName: 'Roe, Jr.',
    });
  });

  test('leaves the record untouched when lastName has no comma at all', () => {
    expect(recoverLastFirstRoleSwap('LIQUIDATING TRUSTEE', 'Roe')).toEqual({
      firstName: 'LIQUIDATING TRUSTEE',
      lastName: 'Roe',
    });
  });

  test('leaves the record untouched when firstName is empty', () => {
    expect(recoverLastFirstRoleSwap('', 'Roe, Jordan')).toEqual({
      firstName: '',
      lastName: 'Roe, Jordan',
    });
  });
});

describe('recoverCorruptedFirstName', () => {
  // Models a firstName holding an office name with a glued chapter marker, the real name having
  // landed in lastName.
  test.each([
    ['ALDRIC', 'VEXMORE', { firstName: 'ALDRIC', lastName: 'VEXMORE' }],
    ['FICTIONBURGCH13', 'Q. ALDRIC VEXMORE', { firstName: 'Q. ALDRIC', lastName: 'VEXMORE' }],
    ['FICTIONBURGCH13', 'ALDRIC VEXMORE', { firstName: 'ALDRIC', lastName: 'VEXMORE' }],
    ['ALDRIC13 Q', 'VEXMORE', { firstName: 'ALDRIC13', lastName: 'VEXMORE' }],
  ])('recovers firstName "%s" with lastName "%s"', (firstName, lastName, expected) => {
    expect(recoverCorruptedFirstName(firstName, lastName)).toEqual(expected);
  });
});

describe('recoverSoloPracticeName', () => {
  test.each([
    ['', 'TESSARIN Q ORSINO INC', { firstName: 'TESSARIN Q', lastName: 'ORSINO' }],
    ['', 'TESSARIN ORSINO, LLC', { firstName: 'TESSARIN', lastName: 'ORSINO' }],
    ['', 'TESSARIN ORSINO PC.', { firstName: 'TESSARIN', lastName: 'ORSINO' }],
    ['', 'ORSINO INC', { firstName: '', lastName: 'ORSINO INC' }],
    ['', 'TESSARIN Q ORSINO', { firstName: '', lastName: 'TESSARIN Q ORSINO' }],
    ['TESSARIN', 'ORSINO INC', { firstName: 'TESSARIN', lastName: 'ORSINO INC' }],
  ])('recovers firstName "%s" with lastName "%s"', (firstName, lastName, expected) => {
    expect(recoverSoloPracticeName(firstName, lastName)).toEqual(expected);
  });
});

describe('isRecordDisavowed', () => {
  test.each([
    { description: 'a disavowal in the name', fullName: 'ALDRIC VEXMORE DO NOT USE', legacy: {} },
    {
      description: 'a disavowal in the address',
      fullName: 'ALDRIC VEXMORE',
      legacy: { address1: 'DO NOT USE' },
    },
  ])('disavows $description', ({ fullName, legacy }) => {
    expect(isRecordDisavowed({ fullName, legacy } as never)).toBe(true);
  });

  test('does not disavow a record with no disavowal phrase', () => {
    expect(
      isRecordDisavowed({ fullName: 'ALDRIC VEXMORE', legacy: { address1: '1 Elm St' } } as never),
    ).toBe(false);
  });
});

describe('shouldSkipAsUstStaff', () => {
  test.each(['ALDRIC VEXMORE (UST)', 'ALDRIC VEXMORE U.S. TRUSTEE', 'US TRUSTEE'])(
    'skips a U.S. Trustee annotation: "%s"',
    (fullName) => {
      expect(shouldSkipAsUstStaff(fullName)).toBe(true);
    },
  );

  test.each(['ALDRIC VEXMORE', 'ALDRIC USTRAND'])('does not skip "%s"', (fullName) => {
    expect(shouldSkipAsUstStaff(fullName)).toBe(false);
  });
});
