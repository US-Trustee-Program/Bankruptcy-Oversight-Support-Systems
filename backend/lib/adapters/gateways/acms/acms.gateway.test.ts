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
    test.each([
      ['exclude records with PROF_CODE <= 0', 'PROF_CODE > 0'],
      ['exclude soft-deleted records', "DELETE_CODE != 'D'"],
      ['filter to trustee appointment type only', "APPT_TYPE = 'TR'"],
      ['exclude appointments for deleted cases', "c.DELETE_CODE != 'D'"],
    ])('should %s', async (_desc, expectedQueryFragment) => {
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
        expect.stringContaining(expectedQueryFragment),
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

  describe('getAllTrusteeProfessionalRecords', () => {
    test('should select the widened set of demographic columns and filter by PROF_TYPE = TR', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getAllTrusteeProfessionalRecords(context);

      // These SQL-substring assertions are intentional: the mock returns canned
      // rows regardless of query text, so behavior alone cannot verify that the
      // compound (GROUP_DESIGNATOR, PROF_CODE) key is used (never PROF_CODE alone),
      // that the PROF_TYPE = 'TR' filter is applied, or that the widened column
      // list is actually selected. All are correctness invariants against live
      // ACMS data, so we assert them at the query level.
      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain('GROUP_DESIGNATOR');
      expect(query).toContain("PROF_TYPE = 'TR'");
      expect(query).toContain('PROF_MI');
      expect(query).toContain('PROF_ADDRESS1');
      expect(query).toContain('PROF_ADDRESS2');
      expect(query).toContain('PROF_CITY');
      expect(query).toContain('PROF_ZIP');
      expect(query).toContain('PROF_COMMERCIAL_PHONE_NBR');

      // Uses the extended per-request timeout (large fetch), like the other CMMPR/CMMAP reads.
      // Assert the actual configured value is threaded through, not just any positive number —
      // ACMS_REQUEST_TIMEOUT_MS defaults to 300000ms (5 min) when the env var is unset.
      const timeoutArg = spy.mock.calls[0][3];
      const expectedTimeout = process.env.ACMS_REQUEST_TIMEOUT_MS
        ? Number.parseInt(process.env.ACMS_REQUEST_TIMEOUT_MS, 10)
        : 300000;
      expect(timeoutArg).toBe(expectedTimeout);
    });

    test('should return the full set of trustee professional records with all widened fields', async () => {
      const dbResults = [
        {
          acmsProfessionalId: 'NY-00063',
          firstName: 'Harvey',
          lastName: 'Barr',
          middleInitial: 'Q',
          address1: '123 Main St',
          address2: 'Suite 100',
          city: 'Albany',
          state: 'NY',
          zip: 12207,
          phone: 5185551234,
        },
      ];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getAllTrusteeProfessionalRecords(context);

      expect(result).toEqual([
        {
          acmsProfessionalId: 'NY-00063',
          firstName: 'Harvey',
          lastName: 'Barr',
          middleInitial: 'Q',
          address1: '123 Main St',
          address2: 'Suite 100',
          city: 'Albany',
          state: 'NY',
          zip: '12207',
          phone: '5185551234',
        },
      ]);
    });

    test('should return empty array when no professional records found', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getAllTrusteeProfessionalRecords(context);

      expect(result).toEqual([]);
    });

    test('should throw CamsError when executeQuery fails', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(
        new Error('connection failed'),
      );

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);

      await expect(gateway.getAllTrusteeProfessionalRecords(context)).rejects.toThrow(CamsError);
    });

    describe('numeric-to-string normalization', () => {
      async function fetchOneRecord(rawRow: Record<string, unknown>) {
        vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
          success: true,
          results: { recordset: [rawRow] },
          message: '',
        });

        const context = await createMockApplicationContext();
        const gateway = new AcmsGatewayImpl(context);
        const [result] = await gateway.getAllTrusteeProfessionalRecords(context);
        return result;
      }

      const baseRow = {
        acmsProfessionalId: 'NY-00063',
        firstName: 'Harvey',
        lastName: 'Barr',
        middleInitial: null,
        address1: null,
        address2: null,
        city: null,
        state: 'NY',
      };

      test('normalizes a 9-digit ACMS zip (NUMERIC(9,0)) to the first 5 digits', async () => {
        const result = await fetchOneRecord({ ...baseRow, zip: 122075678, phone: null });
        expect(result.zip).toBe('12207');
      });

      test('preserves leading zeros for a zip with fewer than 5 significant digits', async () => {
        // A NUMERIC column strips leading zeros, so a "00501"-style zip arrives as 501.
        const result = await fetchOneRecord({ ...baseRow, zip: 501, phone: null });
        expect(result.zip).toBe('00501');
      });

      test('normalizes zero zip to null', async () => {
        const result = await fetchOneRecord({ ...baseRow, zip: 0, phone: null });
        expect(result.zip).toBeNull();
      });

      test('normalizes null zip to null', async () => {
        const result = await fetchOneRecord({ ...baseRow, zip: null, phone: null });
        expect(result.zip).toBeNull();
      });

      test('normalizes a full 10-digit ACMS phone number to a string', async () => {
        const result = await fetchOneRecord({ ...baseRow, zip: null, phone: 5185551234 });
        expect(result.phone).toBe('5185551234');
      });

      test('zero-pads a phone number with fewer than 10 significant digits', async () => {
        // A NUMERIC column strips leading zeros, so a "0185551234"-style number
        // (a legacy area code artifact) arrives as 185551234 — 9 digits.
        const result = await fetchOneRecord({ ...baseRow, zip: null, phone: 185551234 });
        expect(result.phone).toBe('0185551234');
      });

      test('normalizes zero phone to null', async () => {
        const result = await fetchOneRecord({ ...baseRow, zip: null, phone: 0 });
        expect(result.phone).toBeNull();
      });

      test('normalizes null phone to null', async () => {
        const result = await fetchOneRecord({ ...baseRow, zip: null, phone: null });
        expect(result.phone).toBeNull();
      });

      test('normalizes empty-string demographic fields to null', async () => {
        const result = await fetchOneRecord({
          ...baseRow,
          middleInitial: '',
          address1: '',
          address2: '',
          city: '',
          zip: null,
          phone: null,
        });
        expect(result.middleInitial).toBeNull();
        expect(result.address1).toBeNull();
        expect(result.address2).toBeNull();
        expect(result.city).toBeNull();
      });
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

  describe('getCmmapAppointmentsForProfessionalIds', () => {
    test('should return an empty array without querying when given an empty batch', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery');

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getCmmapAppointmentsForProfessionalIds(context, []);

      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    test('should issue exactly one query for a batch of professional IDs (one round trip, not per-id)', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const acmsProfessionalIds = ['NY-00123', 'UT-05321', 'CA-00001'];
      await gateway.getCmmapAppointmentsForProfessionalIds(context, acmsProfessionalIds);

      expect(spy).toHaveBeenCalledTimes(1);

      const [, query, input] = spy.mock.calls[0];
      expect(query).toContain('IN (@profId0, @profId1, @profId2)');
      expect(input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'profId0', value: 'NY-00123' }),
          expect.objectContaining({ name: 'profId1', value: 'UT-05321' }),
          expect.objectContaining({ name: 'profId2', value: 'CA-00001' }),
        ]),
      );
    });

    test('should return rows for all requested professional IDs, including closed cases', async () => {
      const dbResults = [
        {
          acmsProfessionalId: 'NY-00123',
          caseId: '081-24-12345',
          courtDivisionCode: '081',
          chapter: '7A',
        },
        {
          // A closed/pre-2018 case — must still be returned, since this method
          // applies no open-case filter.
          acmsProfessionalId: 'UT-05321',
          caseId: '087-10-00042',
          courtDivisionCode: '087',
          chapter: '11',
        },
      ];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getCmmapAppointmentsForProfessionalIds(context, [
        'NY-00123',
        'UT-05321',
      ]);

      expect(result).toEqual(dbResults);
    });

    test('should not apply an open-case filter (no CLOSED_BY_COURT_DATE/CLOSED_BY_UST_DATE clause)', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsForProfessionalIds(context, ['NY-00123']);

      const query = spy.mock.calls[0][1] as string;
      expect(query).not.toContain('CLOSED_BY_COURT_DATE');
      expect(query).not.toContain('CLOSED_BY_UST_DATE');
      expect(query).not.toContain('20180101');
    });

    test('should not join CMMKE', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsForProfessionalIds(context, ['NY-00123']);

      const query = spy.mock.calls[0][1] as string;
      expect(query).not.toContain('CMMKE');
    });

    test.each([
      ['exclude soft-deleted CMMAP records', "m.DELETE_CODE != 'D'"],
      ['filter to trustee appointment type only', "m.APPT_TYPE = 'TR'"],
      ['exclude soft-deleted CMMDB records', "c.DELETE_CODE != 'D'"],
      ['join CMMAP to CMMDB', 'INNER JOIN [dbo].[CMMDB]'],
    ])('should %s', async (_desc, expectedQueryFragment) => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsForProfessionalIds(context, ['NY-00123']);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining(expectedQueryFragment),
        expect.any(Array),
        300000,
      );
    });

    test('should throw CamsError when executeQuery fails', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(
        new Error('connection failed'),
      );

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);

      await expect(
        gateway.getCmmapAppointmentsForProfessionalIds(context, ['NY-00123']),
      ).rejects.toThrow(CamsError);
    });
  });

  describe('getDivisionToCourtMap', () => {
    test('should return a Map of zero-padded CASE_DIV -> COURT_ID from CMMDO', async () => {
      const dbResults = [
        { caseDiv: 81, courtId: 'NY' },
        { caseDiv: 1, courtId: 'ME' },
        { caseDiv: 900, courtId: 'DC' },
      ];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getDivisionToCourtMap(context);

      expect(result).toBeInstanceOf(Map);
      expect(result).toEqual(
        new Map([
          ['081', 'NY'],
          ['001', 'ME'],
          ['900', 'DC'],
        ]),
      );
    });

    test('should return an empty Map, not an error, when CMMDO returns no rows', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getDivisionToCourtMap(context);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test('should round-trip every row into the map with no rows dropped or duplicated', async () => {
      const dbResults = Array.from({ length: 271 }, (_, i) => ({
        caseDiv: i + 1,
        courtId: `C${i}`,
      }));
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getDivisionToCourtMap(context);

      expect(result.size).toBe(dbResults.length);
      for (const row of dbResults) {
        expect(result.get(String(row.caseDiv).padStart(3, '0'))).toBe(row.courtId);
      }
    });

    test('should exclude soft-deleted rows (DELETE_CODE != D)', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getDivisionToCourtMap(context);

      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain("DELETE_CODE != 'D'");
      expect(query).toContain('[dbo].[CMMDO]');
    });

    test('should throw CamsError when executeQuery fails', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(
        new Error('connection failed'),
      );

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);

      await expect(gateway.getDivisionToCourtMap(context)).rejects.toThrow(CamsError);
    });
  });
});
