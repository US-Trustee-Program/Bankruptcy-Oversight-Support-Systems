import { describe, test, expect } from 'vitest';
import { buildAppointmentTaskReasonParts } from './trustee-appointment-explanation';

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
