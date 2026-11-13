import { describe, test, expect } from 'vitest';
import {
  buildAppointmentTaskReasonParts,
  buildRefreshResolvedMessage,
  buildRefreshStillUncoveredMessage,
  formatCourtAndDivision,
} from './trustee-appointment-explanation';

describe('buildAppointmentTaskReasonParts', () => {
  test("splits the 'no-appointment' sentence around the trustee's name", () => {
    const { before, after } = buildAppointmentTaskReasonParts('no-appointment');

    expect(`${before}Jane Smith${after}`).toBe(
      'Trustee Jane Smith is not appointed in this court, division and chapter.',
    );
  });

  test("splits the 'appointment-inactive' sentence around the trustee's name", () => {
    const { before, after } = buildAppointmentTaskReasonParts('appointment-inactive');

    expect(`${before}Jane Smith${after}`).toBe(
      'The appointment for Trustee Jane Smith in this court, division and chapter is not active.',
    );
  });
});

describe('buildRefreshResolvedMessage', () => {
  test.each([
    [3, "Trustee Jane Smith's appointment verified for 3 cases."],
    [1, "Trustee Jane Smith's appointment verified for 1 case."],
    [0, "Trustee Jane Smith's appointment verified for 0 cases."],
  ])('names the trustee and counts %i verified case(s)', (count, message) => {
    expect(buildRefreshResolvedMessage('Jane Smith', count)).toBe(message);
  });
});

describe('buildRefreshStillUncoveredMessage', () => {
  const tuple = {
    courtId: '0645',
    courtName: 'Eastern District of Missouri',
    divisionCode: '4',
    courtDivisionName: 'St. Louis',
    chapter: '7',
  };

  test('names the chapter, court and division the trustee still lacks', () => {
    expect(buildRefreshStillUncoveredMessage(tuple)).toBe(
      "There's still no active Chapter 7 appointment in Eastern District of Missouri (St. Louis). Ask a Trustee Admin to add or reactivate it, then try again.",
    );
  });
});

describe('formatCourtAndDivision', () => {
  const names = {
    courtId: '0645',
    courtName: 'Eastern District of Missouri',
    divisionCode: '4',
    courtDivisionName: 'St. Louis',
  };

  test.each([
    [{}, 'Eastern District of Missouri (St. Louis)'],
    [{ courtName: undefined }, '0645 (St. Louis)'],
    [{ courtDivisionName: undefined }, 'Eastern District of Missouri (4)'],
    [{ courtName: undefined, courtDivisionName: undefined }, '0645 (4)'],
  ])('with %o gives %s, falling back to ids when names are unknown', (overrides, label) => {
    expect(formatCourtAndDivision({ ...names, ...overrides })).toBe(label);
  });
});
