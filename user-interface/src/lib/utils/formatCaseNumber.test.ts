import { getCaseNumber } from './formatCaseNumber';

describe('Formatting case id', () => {
  it('Should get case number from case id', async () => {
    const caseId = '081-11-22222';
    const caseNumber = '11-22222';

    const actual = getCaseNumber(caseId);
    expect(actual).toEqual(caseNumber);
  });

  it('Should handle undefined input', async () => {
    const actual = getCaseNumber(undefined);
    expect(actual).toEqual('');
  });
});
