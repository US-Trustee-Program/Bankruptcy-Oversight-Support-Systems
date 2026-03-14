import { vi } from 'vitest';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AcmsGatewayImpl } from './acms.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import {
  AcmsConsolidation,
  AcmsConsolidationMemberCase,
  AcmsPredicate,
} from '../../../use-cases/dataflows/migrate-consolidations';

describe('ACMS gateway tests', () => {
  const chapters = [
    { chapter: '9', inputVariable: '09' },
    { chapter: '11', inputVariable: '11' },
    { chapter: '12', inputVariable: '12' },
    { chapter: '13', inputVariable: '13' },
    { chapter: '15', inputVariable: '15' },
  ];
  test.each(chapters)('should translate chapter $chapter into query', async (params) => {
    const spy = vi
      .spyOn(AbstractMssqlClient.prototype, 'executeQuery')
      .mockResolvedValueOnce({
        success: true,
        results: [{ leadCaseCount: 0 }],
        message: '',
      })
      .mockResolvedValue({
        success: true,
        results: [],
        message: '',
      });

    const predicate: AcmsPredicate = {
      chapter: params.chapter,
      divisionCode: '081',
    };

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await gateway.getLeadCaseIds(context, predicate);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ name: 'chapter', value: params.inputVariable }),
      ]),
    );
  });

  test('should handle chapter 7 query', async () => {
    const spy = vi
      .spyOn(AbstractMssqlClient.prototype, 'executeQuery')
      .mockResolvedValueOnce({
        success: true,
        results: [{ leadCaseCount: 0 }],
        message: '',
      })
      .mockResolvedValue({
        success: true,
        results: [],
        message: '',
      });

    const predicate: AcmsPredicate = {
      chapter: '7',
      divisionCode: '081',
    };

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await gateway.getLeadCaseIds(context, predicate);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.stringContaining("IN ('7A', '7N')"),
      expect.any(Array),
    );
  });

  test('should get substantive consolidation details from ACMS', async () => {
    const leadCaseId = '0000000000';
    const databaseResult: AcmsConsolidationMemberCase[] = [
      {
        caseId: '000-00-11111',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
      {
        caseId: '000-00-22222',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
    ];
    const expectedResult: AcmsConsolidation = {
      leadCaseId: '000-00-00000',
      memberCases: [
        {
          caseId: '000-00-11111',
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
        {
          caseId: '000-00-22222',
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
      ],
    };

    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: databaseResult,
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getConsolidationDetails(context, leadCaseId);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ name: 'leadCaseId', value: leadCaseId })]),
    );
    expect(result).toEqual(expectedResult);
  });

  test('should get administrative consolidation details from ACMS', async () => {
    const leadCaseId = '0000000000';
    const databaseResult: AcmsConsolidationMemberCase[] = [
      {
        caseId: '000-00-11111',
        consolidationDate: '20240201',
        consolidationType: 'A',
      },
      {
        caseId: '000-00-22222',
        consolidationDate: '20240201',
        consolidationType: 'A',
      },
    ];
    const expectedResult: AcmsConsolidation = {
      leadCaseId: '000-00-00000',
      memberCases: [
        {
          caseId: '000-00-11111',
          consolidationDate: '2024-02-01',
          consolidationType: 'administrative',
        },
        {
          caseId: '000-00-22222',
          consolidationDate: '2024-02-01',
          consolidationType: 'administrative',
        },
      ],
    };

    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: databaseResult,
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getConsolidationDetails(context, leadCaseId);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ name: 'leadCaseId', value: leadCaseId })]),
    );
    expect(result).toEqual(expectedResult);
  });

  test('should handle exceptions from executeQuery when calling getLeadCaseIds', async () => {
    const mockError = new Error('test error');
    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getLeadCaseIds(context, {
        chapter: '11',
        divisionCode: '010',
      } as AcmsPredicate);
    }).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        message: mockError.message,
        module: 'ACMS-GATEWAY',
      }),
    );
  });

  test('should handle exceptions from executeQuery when calling getConsolidationDetails', async () => {
    const mockError = new Error('test error');
    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getConsolidationDetails(context, '000-00-1234');
    }).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        message: mockError.message,
        module: 'ACMS-GATEWAY',
      }),
    );
  });

  test('should exclude deleted cases when loading migration table', async () => {
    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: [],
      message: '',
    });
    const ssn = '234-21-5326';

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await gateway.loadMigrationTable(context);
    console.log(ssn);

    expect(spy).toHaveBeenCalledWith(context, expect.stringContaining("DELETE_CODE != 'D'"));
    expect(spy).toHaveBeenCalledWith(
      context,
      expect.stringContaining('INSERT INTO dbo.CAMS_MIGRATION_TEMP'),
    );
  });

  describe('getDeletedCaseIds', () => {
    test('should convert date string to YYYYMMDD integer and pass mssql.Int type', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: [],
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const lastChangeDate = '2026-03-13';

      await gateway.getDeletedCaseIds(context, lastChangeDate);

      // Verify the input parameter is converted correctly
      const calls = spy.mock.calls[0];
      const inputParams = calls[2];
      const lastChangeDateParam = inputParams.find((p) => p.name === 'lastChangeDate');

      expect(lastChangeDateParam).toBeDefined();
      expect(lastChangeDateParam.name).toBe('lastChangeDate');
      expect(lastChangeDateParam.value).toBe(20260313); // YYYYMMDD integer
      expect(lastChangeDateParam.type).toBeDefined();
      // Verify it's an Int type by checking the type's name property
      expect(lastChangeDateParam.type.name).toBe('Int');
    });

    test('should return latest date from first element when results ordered DESC', async () => {
      const databaseResults = [
        { caseId: '081-24-00001', lastChangeDate: 20260315 },
        { caseId: '081-24-00002', lastChangeDate: 20260314 },
        { caseId: '081-24-00003', lastChangeDate: 20260313 },
      ];

      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: databaseResults,
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const lastChangeDate = '2026-03-12';

      const result = await gateway.getDeletedCaseIds(context, lastChangeDate);

      expect(result.caseIds).toEqual(['081-24-00001', '081-24-00002', '081-24-00003']);
      // Latest date is from first element (DESC order), not last
      expect(result.latestDeletedCaseDate).toBe('2026-03-15');
    });

    test('should return input date when no deleted cases found', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: [],
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const lastChangeDate = '2026-03-12';

      const result = await gateway.getDeletedCaseIds(context, lastChangeDate);

      expect(result.caseIds).toEqual([]);
      expect(result.latestDeletedCaseDate).toBe('2026-03-12');
    });

    test('should handle various date formats correctly', async () => {
      const testCases = [
        { input: '2018-01-01', expected: 20180101 },
        { input: '2026-12-31', expected: 20261231 },
        { input: '2020-02-29', expected: 20200229 }, // leap year
      ];

      for (const testCase of testCases) {
        const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
          success: true,
          results: [],
          message: '',
        });

        const context = await createMockApplicationContext();
        const gateway = new AcmsGatewayImpl(context);

        await gateway.getDeletedCaseIds(context, testCase.input);

        expect(spy).toHaveBeenCalledWith(
          context,
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({
              name: 'lastChangeDate',
              value: testCase.expected,
            }),
          ]),
        );

        vi.restoreAllMocks();
      }
    });
  });
});
