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

  test('should load migration table with DELETE_CODE filter', async () => {
    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: [],
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await gateway.loadMigrationTable(context);

    expect(spy).toHaveBeenCalledWith(context, expect.stringContaining("DELETE_CODE != 'D'"));
    expect(spy).toHaveBeenCalledWith(
      context,
      expect.stringContaining('INSERT INTO dbo.CAMS_MIGRATION_TEMP'),
    );
  });

  test('should handle exceptions when loading migration table', async () => {
    const mockError = new Error('database error');
    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.loadMigrationTable(context);
    }).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        message: mockError.message,
        module: 'ACMS-GATEWAY',
      }),
    );
  });

  test('should get migration case IDs for specified range', async () => {
    const mockCaseIds = [
      { caseId: '081-23-12345' },
      { caseId: '081-23-12346' },
      { caseId: '081-23-12347' },
    ];

    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: mockCaseIds,
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getMigrationCaseIds(context, 1, 100);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.stringContaining('SELECT caseId FROM dbo.CAMS_MIGRATION_TEMP'),
    );
    expect(spy).toHaveBeenCalledWith(
      context,
      expect.stringContaining('WHERE id BETWEEN 1 AND 100'),
    );
    expect(result).toEqual(['081-23-12345', '081-23-12346', '081-23-12347']);
  });

  test('should handle exceptions when getting migration case IDs', async () => {
    const mockError = new Error('database error');
    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getMigrationCaseIds(context, 1, 100);
    }).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        message: mockError.message,
        module: 'ACMS-GATEWAY',
      }),
    );
  });

  test('should empty migration table', async () => {
    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: [],
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await gateway.emptyMigrationTable(context);

    expect(spy).toHaveBeenCalledWith(context, 'TRUNCATE TABLE dbo.CAMS_MIGRATION_TEMP');
  });

  test('should handle exceptions when emptying migration table', async () => {
    const mockError = new Error('database error');
    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.emptyMigrationTable(context);
    }).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        message: mockError.message,
        module: 'ACMS-GATEWAY',
      }),
    );
  });

  test('should get migration case count', async () => {
    const mockCount = [{ total: 1234 }];

    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: mockCount,
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getMigrationCaseCount(context);

    expect(spy).toHaveBeenCalledWith(
      context,
      'SELECT COUNT(*) AS total FROM dbo.CAMS_MIGRATION_TEMP',
    );
    expect(result).toBe(1234);
  });

  test('should handle exceptions when getting migration case count', async () => {
    const mockError = new Error('database error');
    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getMigrationCaseCount(context);
    }).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        message: mockError.message,
        module: 'ACMS-GATEWAY',
      }),
    );
  });
});
