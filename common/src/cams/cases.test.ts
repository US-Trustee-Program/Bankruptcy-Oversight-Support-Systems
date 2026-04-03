import {
  CaseDetail,
  getCaseConsolidationType,
  getCaseIdParts,
  getCaseNumber,
  getLeadCaseLabel,
  getMemberCaseLabel,
  isCaseClosed,
  isCaseOpen,
  isMemberCase,
  isLeadCase,
  isTransferredCase,
} from './cases';
import MockData from './test-utilities/mock-data';
import { ConsolidationType } from './orders';

describe('cases common functions tests', () => {
  test('should return true for re-closed case', () => {
    const closedDate = '2024-01-01';
    const reopenedDate = '2023-12-01';
    const casePartial = {
      closedDate,
      reopenedDate,
    };
    expect(isCaseClosed(casePartial)).toBe(true);
    expect(isCaseOpen(casePartial)).toBe(false);
  });

  test('should return false for reopened case', () => {
    const closedDate = '2024-01-01';
    const reopenedDate = '2024-01-02';
    const casePartial = {
      closedDate,
      reopenedDate,
    };
    expect(isCaseClosed(casePartial)).toBe(false);
    expect(isCaseOpen(casePartial)).toBe(true);
  });

  test('should return false for never closed case', () => {
    expect(isCaseClosed({})).toBe(false);
    expect(isCaseOpen({})).toBe(true);
  });

  describe('getCaseIdParts', () => {
    test('should deconstruct a case id into a division code and case number', () => {
      const caseId = '000-11-22222';
      const expected = { divisionCode: '000', caseNumber: '11-22222' };
      const actual = getCaseIdParts(caseId);
      expect(actual).toEqual(expected);
    });

    test.each(['00-11-22222', '000-1-22222', '000-11-2222', '0001122222'])(
      'should throw an error for an invalid case id: %s',
      (caseId) => {
        expect(() => getCaseIdParts(caseId)).toThrow(`Invalid case ID: ${caseId}`);
      },
    );

    const consolidationCases: [string, Partial<CaseDetail>, boolean, boolean][] = [
      [
        'is lead',
        { consolidation: [{ documentType: 'CONSOLIDATION_FROM' }] } as Partial<CaseDetail>,
        true,
        false,
      ],
      [
        'is member',
        { consolidation: [{ documentType: 'CONSOLIDATION_TO' }] } as Partial<CaseDetail>,
        false,
        true,
      ],
      ['is not consolidated', { consolidation: [] } as Partial<CaseDetail>, false, false],
    ];
    test.each(consolidationCases)(
      'should return correctly for isLeadCase and isMemberCase when case %s',
      (
        _caseName: string,
        caseDetail: Partial<CaseDetail>,
        leadResult: boolean,
        memberResult: boolean,
      ) => {
        const bCase = MockData.getCaseDetail({ override: caseDetail });
        expect(isLeadCase(bCase)).toBe(leadResult);
        expect(isMemberCase(bCase)).toBe(memberResult);
      },
    );

    const transferCases: [string, Partial<CaseDetail>, boolean][] = [
      [
        'is transferred from',
        { transfers: [{ documentType: 'TRANSFER_FROM' }] } as Partial<CaseDetail>,
        true,
      ],
      [
        'is transferred to',
        { transfers: [{ documentType: 'TRANSFER_TO' }] } as Partial<CaseDetail>,
        true,
      ],
      ['is not transferred', { transfers: [] } as Partial<CaseDetail>, false],
      ['has no transfers', {} as Partial<CaseDetail>, false],
    ];
    test.each(transferCases)(
      'should return correctly for isTransferredCase when case %s',
      (_caseName: string, caseDetail: Partial<CaseDetail>, transferredResult: boolean) => {
        const bCase = MockData.getCaseDetail({ override: caseDetail });
        expect(isTransferredCase(bCase)).toBe(transferredResult);
      },
    );

    describe('getCaseConsolidationType', () => {
      const consolidationTypeMap = new Map<ConsolidationType, string>([
        ['administrative', 'Joint Administration'],
        ['substantive', 'Substantive Consolidation'],
      ]);

      test('should return consolidation type for administrative consolidation', () => {
        const consolidation = [
          MockData.getConsolidationReference({
            override: { consolidationType: 'administrative' },
          }),
        ];
        expect(getCaseConsolidationType(consolidation, consolidationTypeMap)).toBe(
          'Joint Administration',
        );
      });

      test('should return consolidation type for substantive consolidation', () => {
        const consolidation = [
          MockData.getConsolidationReference({
            override: { consolidationType: 'substantive' },
          }),
        ];
        expect(getCaseConsolidationType(consolidation, consolidationTypeMap)).toBe(
          'Substantive Consolidation',
        );
      });

      test('should return empty string for empty consolidation array', () => {
        expect(getCaseConsolidationType([], consolidationTypeMap)).toBe('');
      });

      test('should return empty string for unknown consolidation type', () => {
        const consolidation = [
          MockData.getConsolidationReference({
            override: { consolidationType: 'unknown' as ConsolidationType },
          }),
        ];
        expect(getCaseConsolidationType(consolidation, consolidationTypeMap)).toBe('');
      });
    });

    describe('getLeadCaseLabel', () => {
      test('should return lead case label with consolidation type', () => {
        expect(getLeadCaseLabel('Joint Administration')).toBe('Lead case in joint administration');
      });

      test('should return lead case label with substantive consolidation', () => {
        expect(getLeadCaseLabel('Substantive Consolidation')).toBe(
          'Lead case in substantive consolidation',
        );
      });

      test('should return just "Lead case" when consolidation type is empty', () => {
        expect(getLeadCaseLabel('')).toBe('Lead case');
      });
    });

    describe('getMemberCaseLabel', () => {
      test('should return member case label with consolidation type', () => {
        expect(getMemberCaseLabel('Joint Administration')).toBe(
          'Member case in joint administration',
        );
      });

      test('should return member case label with substantive consolidation', () => {
        expect(getMemberCaseLabel('Substantive Consolidation')).toBe(
          'Member case in substantive consolidation',
        );
      });

      test('should return just "Member case" when consolidation type is empty', () => {
        expect(getMemberCaseLabel('')).toBe('Member case');
      });
    });
  });

  describe('getCaseNumber utility function', () => {
    test('should extract case number from standard format "122-26-12332" → "26-12332"', () => {
      const caseId = '122-26-12332';
      const actual = getCaseNumber(caseId);
      expect(actual).toBe('26-12332');
    });

    test('should extract case number from different division code "081-26-12332" → "26-12332"', () => {
      const caseId = '081-26-12332';
      const actual = getCaseNumber(caseId);
      expect(actual).toBe('26-12332');
    });

    test('should handle short format "26-12332" → "26-12332"', () => {
      const caseId = '26-12332';
      const actual = getCaseNumber(caseId);
      expect(actual).toBe('26-12332');
    });

    test('should return empty string when caseId is undefined', () => {
      const actual = getCaseNumber(undefined);
      expect(actual).toBe('');
    });

    test('should return empty string when caseId is null', () => {
      const actual = getCaseNumber(null as unknown as string);
      expect(actual).toBe('');
    });

    test('should work with leading zeros "001-01-00001" → "01-00001"', () => {
      const caseId = '001-01-00001';
      const actual = getCaseNumber(caseId);
      expect(actual).toBe('01-00001');
    });

    test('should throw for malformed case ID with no hyphens', () => {
      expect(() => getCaseNumber('invalid')).toThrow('Invalid case ID: invalid');
    });
  });
});
