import { describe, test, expect } from 'vitest';
import { resolveKeyDatesSaveError } from './keyDatesSaveError';

describe('resolveKeyDatesSaveError', () => {
  const owned = ['annualReportCompletionYear', 'annualReportCompletionStatus'];

  test('reports an error on a field this form owns', () => {
    const reasonMap = {
      annualReportCompletionStatus: { reasons: ['Annual Report Completion Status is required.'] },
    };

    expect(resolveKeyDatesSaveError(reasonMap, owned)).toBe(
      'Annual Report Completion Status is required.',
    );
  });

  test('prefers an owned field when the document also fails elsewhere', () => {
    const reasonMap = {
      // Ordered so the foreign entry comes first, since reasonMap order follows
      // the validation spec rather than the form.
      tprDue: { reasons: ['Must be a valid date mm/dd.'] },
      annualReportCompletionYear: {
        reasons: ['Annual Report Completion Status Year is required.'],
      },
    };

    expect(resolveKeyDatesSaveError(reasonMap, owned)).toBe(
      'Annual Report Completion Status Year is required.',
    );
  });

  // Without this the Annual Report form swallowed the failure into a generic
  // message with nothing highlighted, and Save stayed blocked with no
  // explanation.
  test('explains a failure on a field this form cannot display', () => {
    const reasonMap = { tirCompletionYear: { reasons: ['TIR Completion Year is required.'] } };

    expect(resolveKeyDatesSaveError(reasonMap, owned)).toBe(
      'This appointment has a problem in another section that must be fixed before saving: TIR Completion Year is required.',
    );
  });

  // The TPR form used to surface a foreign error verbatim, so the user saw a
  // specific-looking message naming a control that is not on screen.
  test('does not present a foreign error as though it were this form’s', () => {
    const reasonMap = { tirCompletionYear: { reasons: ['TIR Completion Year is required.'] } };

    const message = resolveKeyDatesSaveError(reasonMap, owned);

    expect(message).not.toBe('TIR Completion Year is required.');
    expect(message).toContain('another section');
  });

  test('falls back to the generic message when there is no reason map', () => {
    expect(resolveKeyDatesSaveError(undefined, owned)).toBe(
      'Please correct the highlighted fields.',
    );
  });

  test('falls back to the generic message when the reason map carries no reasons', () => {
    expect(resolveKeyDatesSaveError({}, owned)).toBe('Please correct the highlighted fields.');
  });
});
