import { vi } from 'vitest';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AcmsGatewayImpl } from './acms.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { CamsError } from '../../../common-errors/cams-error';
import { ApplicationContext } from '../../types/basic';
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
        results: { recordset: [{ leadCaseCount: 0 }] },
        message: '',
      })
      .mockResolvedValue({
        success: true,
        results: { recordset: [] },
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
        results: { recordset: [{ leadCaseCount: 0 }] },
        message: '',
      })
      .mockResolvedValue({
        success: true,
        results: { recordset: [] },
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
      results: { recordset: databaseResult },
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
      results: { recordset: databaseResult },
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

  test('should wrap non-Error thrown values in CamsError', async () => {
    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue('plain string error');

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);

    const error = await gateway
      .getLeadCaseIds(context, { chapter: '11', divisionCode: '010' })
      .catch((e) => e);
    expect(error.isCamsError).toBeTruthy();
    expect(error.status).toBe(500);
    expect(error.module).toBe('ACMS-GATEWAY');
  });

  type GwInvoke = (gw: AcmsGatewayImpl, ctx: ApplicationContext) => Promise<unknown>;
  test.each([
    [
      'getLeadCaseIds',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) =>
        gw.getLeadCaseIds(ctx, { chapter: '11', divisionCode: '010' }),
    ],
    [
      'getConsolidationDetails',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) =>
        gw.getConsolidationDetails(ctx, '000-00-1234'),
    ],
    [
      'loadMigrationTable',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) => gw.loadMigrationTable(ctx),
    ],
    [
      'getMigrationCaseIds',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) => gw.getMigrationCaseIds(ctx, 1, 100),
    ],
    [
      'emptyMigrationTable',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) => gw.emptyMigrationTable(ctx),
    ],
    [
      'getMigrationCaseCount',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) => gw.getMigrationCaseCount(ctx),
    ],
    [
      'getDeletedCaseIds',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) => gw.getDeletedCaseIds(ctx, '2026-01-01'),
    ],
  ] as [string, GwInvoke][])(
    'should throw CamsError when executeQuery fails in %s',
    async (_label, invoke) => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(
        new Error('db error'),
      );
      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const error = (await invoke(gateway, context).catch((e: unknown) => e)) as CamsError;
      expect(error.isCamsError).toBeTruthy();
      expect(error.module).toBe('ACMS-GATEWAY');
    },
  );

  test('should exclude deleted cases when loading migration table', async () => {
    const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: { recordset: [] },
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

  describe('getMigrationCaseIds', () => {
    test('should return caseIds from the migration table for the given range', async () => {
      const dbResults = [{ caseId: '081-24-00001' }, { caseId: '081-24-00002' }];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getMigrationCaseIds(context, 1, 2);

      expect(result).toEqual(['081-24-00001', '081-24-00002']);
    });
  });

  describe('emptyMigrationTable', () => {
    test('should execute TRUNCATE TABLE query', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.emptyMigrationTable(context);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('TRUNCATE TABLE dbo.CAMS_MIGRATION_TEMP'),
      );
    });
  });

  describe('getMigrationCaseCount', () => {
    test('should return total count from migration table', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [{ total: 42 }] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getMigrationCaseCount(context);

      expect(result).toBe(42);
    });
  });

  describe('getDeletedCaseIds', () => {
    test('should convert date string to YYYYMMDD integer and pass mssql.Int type', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const lastChangeDate = '2026-03-13';

      await gateway.getDeletedCaseIds(context, lastChangeDate);

      const calls = spy.mock.calls[0];
      const inputParams = calls[2];
      const lastChangeDateParam = inputParams.find((p) => p.name === 'lastChangeDate');

      expect(lastChangeDateParam).toBeDefined();
      expect(lastChangeDateParam.name).toBe('lastChangeDate');
      expect(lastChangeDateParam.value).toBe(20260313);
      expect(lastChangeDateParam.type).toBeDefined();
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
        results: { recordset: databaseResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const lastChangeDate = '2026-03-12';

      const result = await gateway.getDeletedCaseIds(context, lastChangeDate);

      expect(result.caseIds).toEqual(['081-24-00001', '081-24-00002', '081-24-00003']);
      expect(result.latestDeletedCaseDate).toBe('2026-03-15');
    });

    test('should return input date when no deleted cases found', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
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
        { input: '2020-02-29', expected: 20200229 },
      ];

      for (const testCase of testCases) {
        const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
          success: true,
          results: { recordset: [] },
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

  describe('getCmmapAppointments', () => {
    test('should exclude records with PROF_CODE <= 0', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointments(context, 0, 100, null);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('PROF_CODE > 0'),
        expect.any(Array),
        300000,
      );
    });

    test('should exclude soft-deleted records', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointments(context, 0, 100, null);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining("DELETE_CODE != 'D'"),
        expect.any(Array),
        300000,
      );
    });

    test('should include cutoff date condition when provided', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointments(context, 0, 100, '2024-01-01');

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('m.APPT_DATE >= @cutoffDate'),
        expect.arrayContaining([expect.objectContaining({ name: 'cutoffDate', value: 20240101 })]),
        300000,
      );
    });

    test('should filter to trustee appointment type only', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointments(context, 0, 100, null);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining("APPT_TYPE = 'TR'"),
        expect.any(Array),
        300000,
      );
    });

    test('should exclude appointments for deleted cases', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointments(context, 0, 100, null);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining("c.DELETE_CODE != 'D'"),
        expect.any(Array),
        300000,
      );
    });

    test('should join CMMDB and apply case age filter', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointments(context, 0, 100, null);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('INNER JOIN [dbo].[CMMDB]'),
        expect.any(Array),
        300000,
      );
      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('20180101'),
        expect.any(Array),
        300000,
      );
    });

    test('should paginate using id column, not RECORD_SEQ_NBR', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointments(context, 42, 100, null);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('m.id > @lastId'),
        expect.arrayContaining([expect.objectContaining({ name: 'lastId', value: 42 })]),
        300000,
      );
    });

    test('should return formatted appointment records', async () => {
      const dbResults = [
        {
          id: 1,
          caseId: '081-24-12345',
          acmsProfessionalId: 'NY-00123',
          assignDate: 20240115,
          apptDate: 20240115,
          unassignDate: null,
        },
      ];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getCmmapAppointments(context, 0, 100, null);

      expect(result).toEqual(dbResults);
    });
  });

  describe('getTrusteeProfessionalIds', () => {
    test('should return formatted professional IDs for matching trustee', async () => {
      const dbResults = [{ acmsProfessionalId: 'NY-00123' }, { acmsProfessionalId: 'UT-05321' }];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getTrusteeProfessionalIds(context, 'Harvey', 'Barr', 'NY');

      expect(result).toEqual(['NY-00123', 'UT-05321']);
    });

    test('should return empty array when no matching professional IDs found', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getTrusteeProfessionalIds(context, 'Unknown', 'Trustee', 'TX');

      expect(result).toEqual([]);
    });

    test('should throw CamsError when executeQuery fails', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(
        new Error('connection failed'),
      );

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);

      await expect(gateway.getTrusteeProfessionalIds(context, 'John', 'Doe', 'CA')).rejects.toThrow(
        CamsError,
      );
    });
  });

  describe('getCmmapAppointmentsRaw', () => {
    test('should return raw component fields without computed columns', async () => {
      const rawDbResults = [
        {
          id: 42,
          CASE_DIV: 81,
          CASE_YEAR: 24,
          CASE_NUMBER: 12345,
          GROUP_DESIGNATOR: 'NY',
          PROF_CODE: 63,
          APPT_DATE: 20200115,
          DISP_DATE: null,
        },
      ];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: rawDbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getCmmapAppointmentsRaw(context, 0, 10, null);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(42);
      expect(result[0].CASE_DIV).toBe(81);
      expect(result[0].CASE_YEAR).toBe(24);
      expect(result[0].CASE_NUMBER).toBe(12345);
      expect(result[0].GROUP_DESIGNATOR).toBe('NY');
      expect(result[0].PROF_CODE).toBe(63);
      expect(result[0].APPT_DATE).toBe(20200115);
      expect(result[0].DISP_DATE).toBeNull();
    });

    test('should not include CONCAT or CAST in the SQL query', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 0, 10, null);

      const query = spy.mock.calls[0][1] as string;
      expect(query).not.toContain('CONCAT');
      expect(query).not.toContain('CAST');
      expect(query).not.toContain('RIGHT(');
    });

    test('should paginate using m.id cursor', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 99, 10, null);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('m.id > @lastId'),
        expect.arrayContaining([expect.objectContaining({ name: 'lastId', value: 99 })]),
        300000,
      );
    });

    test('should include cutoff date clause when provided', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 0, 10, '2024-01-01');

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('m.APPT_DATE >= @cutoffDate'),
        expect.arrayContaining([expect.objectContaining({ name: 'cutoffDate', value: 20240101 })]),
        300000,
      );
    });
  });
});
