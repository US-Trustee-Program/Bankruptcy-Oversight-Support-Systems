import { describe, test, expect } from 'vitest';
import { getPhonesToDisplay, normalizeContactPhones } from './contact';

describe('normalizeContactPhones', () => {
  test('returns an empty array when contact is undefined', () => {
    expect(normalizeContactPhones(undefined)).toEqual([]);
  });

  test('returns an empty array when contact has neither phones nor phone', () => {
    expect(normalizeContactPhones({ email: 'jane@example.com' })).toEqual([]);
  });

  test('returns the phones array when present', () => {
    const phones = [
      { number: '555-111-2222', type: 'direct' as const },
      { number: '555-333-4444', type: 'personalMobile' as const },
    ];
    expect(normalizeContactPhones({ phones })).toEqual(phones);
  });

  test('synthesizes a direct-type phone from a legacy single phone field', () => {
    expect(normalizeContactPhones({ phone: { number: '555-111-2222', extension: '42' } })).toEqual([
      { number: '555-111-2222', extension: '42', type: 'direct' },
    ]);
  });

  test('ignores a legacy phone field with no number', () => {
    expect(normalizeContactPhones({ phone: { extension: '42' } })).toEqual([]);
  });

  test('prefers the phones array over a legacy phone field when both are present', () => {
    const phones = [{ number: '555-111-2222', type: 'direct' as const }];
    expect(normalizeContactPhones({ phones, phone: { number: '555-999-9999' } })).toEqual(phones);
  });

  test('falls back to the legacy phone field when phones is an empty array', () => {
    expect(normalizeContactPhones({ phones: [], phone: { number: '555-999-9999' } })).toEqual([
      { number: '555-999-9999', type: 'direct' },
    ]);
  });
});

describe('getPhonesToDisplay', () => {
  const phones = [
    { number: '555-333-3333', type: 'home' as const },
    { number: '555-111-1111', type: 'direct' as const },
    { number: '555-222-2222', type: 'personalMobile' as const },
  ];

  test('returns only the first direct-type phone when typedPhonesEnabled is false', () => {
    expect(getPhonesToDisplay(false, phones)).toEqual([{ number: '555-111-1111', type: 'direct' }]);
  });

  test('returns an empty array when typedPhonesEnabled is false and there is no direct phone', () => {
    const noDirect = [{ number: '555-222-2222', type: 'personalMobile' as const }];
    expect(getPhonesToDisplay(false, noDirect)).toEqual([]);
  });

  test('returns all phones sorted by type when typedPhonesEnabled is true', () => {
    expect(getPhonesToDisplay(true, phones)).toEqual([
      { number: '555-111-1111', type: 'direct' },
      { number: '555-333-3333', type: 'home' },
      { number: '555-222-2222', type: 'personalMobile' },
    ]);
  });

  test('returns an empty array when given no phones', () => {
    expect(getPhonesToDisplay(true, [])).toEqual([]);
    expect(getPhonesToDisplay(false, [])).toEqual([]);
  });
});
