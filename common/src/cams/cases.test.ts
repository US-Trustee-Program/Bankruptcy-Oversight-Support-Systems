import {
  CaseDetail,
  DxtrCase,
  getCaseConsolidationType,
  getCaseIdParts,
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

    const consolidationCases = [
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

    const transferCases = [
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

  describe('DxtrCase type', () => {
    test('should validate DxtrCase structure', () => {
      // Create a valid DxtrCase object
      const dxtrCase: DxtrCase = {
        // CaseSummary properties (includes CaseBasics & FlatOfficeDetail)
        dxtrId: '12345',
        caseId: 'ABC-12-34567',
        chapter: '7',
        caseTitle: 'Test Case',
        dateFiled: '2023-01-01',
        officeName: 'Test Office',
        officeCode: 'TO',
        courtId: 'C123',
        courtName: 'Test Court',
        courtDivisionCode: 'TCD',
        courtDivisionName: 'Test Court Division',
        groupDesignator: 'TGD',
        regionId: 'R1',
        regionName: 'Test Region',
        debtor: {
          name: 'Test Debtor',
          address1: '123 Main St',
          cityStateZipCountry: 'Anytown, NY 12345',
        },

        // ClosedDismissedReopened properties
        closedDate: '2023-12-31',
        dismissedDate: undefined,
        reopenedDate: undefined,
      };

      // Use the object in a way that exercises the type
      const isClosed = isCaseClosed(dxtrCase);

      // Make assertions to ensure the test code is executed
      expect(isClosed).toBe(true);
      expect(dxtrCase.caseId).toBe('ABC-12-34567');
      expect(dxtrCase.debtor.name).toBe('Test Debtor');
    });
  });
});
