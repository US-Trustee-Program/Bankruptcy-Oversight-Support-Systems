import { buildCaseStatusCondition } from './case-status-conditions';

describe('buildCaseStatusCondition', () => {
  test('returns null when caseStatus is undefined', () => {
    expect(buildCaseStatusCondition(undefined)).toBeNull();
  });

  test("returns null when caseStatus is 'ALL'", () => {
    expect(buildCaseStatusCondition('ALL')).toBeNull();
  });

  test('builds the OPEN condition without a field prefix', () => {
    const result = buildCaseStatusCondition('OPEN');

    expect(result).toEqual({
      conjunction: 'OR',
      values: [
        { condition: 'EXISTS', leftOperand: { name: 'closedDate' }, rightOperand: false },
        {
          conjunction: 'AND',
          values: [
            { condition: 'EXISTS', leftOperand: { name: 'closedDate' }, rightOperand: true },
            { condition: 'EXISTS', leftOperand: { name: 'reopenedDate' }, rightOperand: true },
            {
              condition: 'GREATER_THAN_OR_EQUAL',
              leftOperand: { name: 'reopenedDate' },
              rightOperand: { name: 'closedDate' },
            },
          ],
        },
      ],
    });
  });

  test('builds the OPEN condition with a field prefix', () => {
    const result = buildCaseStatusCondition('OPEN', '_case');

    expect(result).toEqual({
      conjunction: 'OR',
      values: [
        { condition: 'EXISTS', leftOperand: { name: '_case.closedDate' }, rightOperand: false },
        {
          conjunction: 'AND',
          values: [
            { condition: 'EXISTS', leftOperand: { name: '_case.closedDate' }, rightOperand: true },
            {
              condition: 'EXISTS',
              leftOperand: { name: '_case.reopenedDate' },
              rightOperand: true,
            },
            {
              condition: 'GREATER_THAN_OR_EQUAL',
              leftOperand: { name: '_case.reopenedDate' },
              rightOperand: { name: '_case.closedDate' },
            },
          ],
        },
      ],
    });
  });

  test('builds the CLOSED condition without a field prefix', () => {
    const result = buildCaseStatusCondition('CLOSED');

    expect(result).toEqual({
      conjunction: 'AND',
      values: [
        { condition: 'EXISTS', leftOperand: { name: 'closedDate' }, rightOperand: true },
        {
          conjunction: 'OR',
          values: [
            { condition: 'EXISTS', leftOperand: { name: 'reopenedDate' }, rightOperand: false },
            {
              condition: 'GREATER_THAN_OR_EQUAL',
              leftOperand: { name: 'closedDate' },
              rightOperand: { name: 'reopenedDate' },
            },
          ],
        },
      ],
    });
  });

  test('builds the CLOSED condition with a field prefix', () => {
    const result = buildCaseStatusCondition('CLOSED', '_case');

    expect(result).toEqual({
      conjunction: 'AND',
      values: [
        { condition: 'EXISTS', leftOperand: { name: '_case.closedDate' }, rightOperand: true },
        {
          conjunction: 'OR',
          values: [
            {
              condition: 'EXISTS',
              leftOperand: { name: '_case.reopenedDate' },
              rightOperand: false,
            },
            {
              condition: 'GREATER_THAN_OR_EQUAL',
              leftOperand: { name: '_case.closedDate' },
              rightOperand: { name: '_case.reopenedDate' },
            },
          ],
        },
      ],
    });
  });
});
