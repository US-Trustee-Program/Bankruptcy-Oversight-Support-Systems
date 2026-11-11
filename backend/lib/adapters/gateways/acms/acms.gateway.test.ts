import { vi } from 'vitest';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AcmsGatewayImpl, CMMAP_ROW_INCLUSION_FILTERS, parseAcmsTimeoutMs } from './acms.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { CamsError } from '../../../common-errors/cams-error';
import { ApplicationContext } from '../../types/basic';
import {
  AcmsConsolidation,
  AcmsConsolidationMemberCase,
  AcmsPredicate,
} from '../../../use-cases/dataflows/migrate-consolidations';

describe('parseAcmsTimeoutMs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test.each([undefined, ''])('defaults to 5 minutes when the value is %j', (raw) => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseAcmsTimeoutMs(raw)).toBe(300000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('uses a positive whole number of milliseconds as given', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseAcmsTimeoutMs('60000')).toBe(60000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test.each(['abc', '0', '-5'])('defaults to 5 minutes, with a warning, for %j', (raw) => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseAcmsTimeoutMs(raw)).toBe(300000);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Invalid ACMS_REQUEST_TIMEOUT_MS="${raw}"`),
    );
  });
});

// Why these tests assert on SQL text: executeQuery is mocked and returns canned rows whatever the
// query says, so a filter, join, cursor or ordering can only be checked by reading the query.
// Each SQL-text assertion names the data rule it protects; one that protects nothing should go.
// They will break on a neutral SQL refactor (renaming an alias, reordering clauses) -- update the
// expected fragment then, but keep the rule.
describe('ACMS gateway tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  test('should exclude a row that is self-referential to the lead case', async () => {
    const leadCaseId = '0000000000';
    const databaseResult: AcmsConsolidationMemberCase[] = [
      {
        caseId: '000-00-00000',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
      {
        caseId: '000-00-11111',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
    ];

    vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: { recordset: databaseResult },
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getConsolidationDetails(context, leadCaseId);

    expect(result.memberCases).toEqual([
      {
        caseId: '000-00-11111',
        consolidationDate: '2024-02-01',
        consolidationType: 'substantive',
      },
    ]);
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
    [
      'getTrusteeProfessionalIds',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) =>
        gw.getTrusteeProfessionalIds(ctx, 'John', 'Doe', 'CA'),
    ],
    [
      'getAllTrusteeProfessionalRecords',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) => gw.getAllTrusteeProfessionalRecords(ctx),
    ],
    [
      'getTrusteeProfessionalRecordsPage',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) =>
        gw.getTrusteeProfessionalRecordsPage(ctx, 'NY', 0, 500),
    ],
    [
      'getActiveAppointmentsForProfessional',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) =>
        gw.getActiveAppointmentsForProfessional(ctx, 'NY', 63),
    ],
    [
      'getCmmapAppointmentsRaw',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) =>
        gw.getCmmapAppointmentsRaw(ctx, 0, 10, null, '02', '2026-07-01'),
    ],
    [
      'getLatestCmmapChangeDateForRegion',
      (gw: AcmsGatewayImpl, ctx: ApplicationContext) =>
        gw.getLatestCmmapChangeDateForRegion(ctx, '02'),
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

    // A malformed LAST_CHANGE_DATE sorts first (DESC) every run; used as the bookmark it would
    // stop new deletions from ever being found. It is skipped for the bookmark, and logged, but
    // its case is still returned for archiving.
    test('skips a malformed newest date for the bookmark, logging it, and still returns its case', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: {
          recordset: [
            { caseId: '081-24-00001', lastChangeDate: 20261399 },
            { caseId: '081-24-00002', lastChangeDate: 20260314 },
          ],
        },
        message: '',
      });
      const context = await createMockApplicationContext();
      const warnSpy = vi.spyOn(context.logger, 'warn');
      const gateway = new AcmsGatewayImpl(context);

      const result = await gateway.getDeletedCaseIds(context, '2026-03-12');

      expect(result.caseIds).toEqual(['081-24-00001', '081-24-00002']);
      expect(result.latestDeletedCaseDate).toBe('2026-03-14');
      expect(warnSpy).toHaveBeenCalledWith('ACMS-GATEWAY', expect.stringContaining('081-24-00001'));
    });

    test('keeps the given bookmark when no returned date is valid', async () => {
      // Both sort above the bookmark, as the query's LAST_CHANGE_DATE > @lastChangeDate requires.
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: {
          recordset: [
            { caseId: '081-24-00001', lastChangeDate: 20261399 },
            { caseId: '081-24-00002', lastChangeDate: 20260230 },
          ],
        },
        message: '',
      });
      const context = await createMockApplicationContext();
      const warnSpy = vi.spyOn(context.logger, 'warn');
      const gateway = new AcmsGatewayImpl(context);

      const result = await gateway.getDeletedCaseIds(context, '2026-03-12');

      expect(result.caseIds).toEqual(['081-24-00001', '081-24-00002']);
      expect(result.latestDeletedCaseDate).toBe('2026-03-12');
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });

    test.each([
      { input: '2018-01-01', expected: 20180101 },
      { input: '2026-12-31', expected: 20261231 },
      { input: '2020-02-29', expected: 20200229 },
    ])('should convert $input to $expected', async ({ input, expected }) => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);

      await gateway.getDeletedCaseIds(context, input);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            name: 'lastChangeDate',
            value: expected,
          }),
        ]),
      );
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
  });

  describe('getAllTrusteeProfessionalRecords', () => {
    test('should return the full set of trustee professional records filtered by PROF_TYPE = TR', async () => {
      const dbResults = [
        { acmsProfessionalId: 'NY-00063', firstName: 'Harvey', lastName: 'Barr', state: 'NY' },
        { acmsProfessionalId: 'UT-05321', firstName: 'Jane', lastName: 'Smith', state: 'UT' },
      ];
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getAllTrusteeProfessionalRecords(context);

      expect(result).toEqual(dbResults);

      // These SQL-substring assertions are intentional: the mock returns canned
      // rows regardless of query text, so behavior alone cannot verify that the
      // compound (GROUP_DESIGNATOR, PROF_CODE) key is used (never PROF_CODE alone)
      // or that the PROF_TYPE = 'TR' filter is applied. Both are correctness
      // invariants against live ACMS data, so we assert them at the query level.
      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain('GROUP_DESIGNATOR');
      expect(query).toContain("PROF_TYPE = 'TR'");

      // Uses the extended per-request timeout (large fetch), like the other CMMPR/CMMAP reads.
      // Assert the actual configured value is threaded through, not just any positive number —
      // ACMS_REQUEST_TIMEOUT_MS defaults to 300000ms (5 min) when the env var is unset.
      const timeoutArg = spy.mock.calls[0][3];
      const expectedTimeout = parseAcmsTimeoutMs(process.env.ACMS_REQUEST_TIMEOUT_MS);
      expect(timeoutArg).toBe(expectedTimeout);
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

    // Case ids and professional ids are formatted in TypeScript (formatCaseId,
    // formatAcmsProfessionalId) from the raw component columns. Formatting them in SQL as well
    // would give two definitions of the same id that could drift apart.
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

    // Keyset paging on m.id: the region driver resumes a date from the last id it saw, so the
    // cursor clause and its lastId parameter must both be present or a resumed page repeats or
    // skips rows.
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

    // A professional is identified by the compound key (GROUP_DESIGNATOR, PROF_CODE); PROF_CODE
    // alone is reused across groups, so joining on it alone attaches the wrong trustee's name.
    test('should join CMMPR for trustee name/contact fields', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 0, 10, null);

      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain('INNER JOIN [dbo].[CMMPR] p');
      expect(query).toContain('m.GROUP_DESIGNATOR = p.GROUP_DESIGNATOR');
      expect(query).toContain('m.PROF_CODE = p.UST_PROF_CODE');
    });

    // The region and change-date filters each pair a clause with a bound parameter: without the
    // clause, a region's sync would read every region's rows, or every change date's. (Every caller
    // passes both today; the omit tests below cover the optional signature until it is tightened.)
    test('should include region filter clause when regionId is provided', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 0, 10, null, '02');

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('m.REGION_CODE = @regionId'),
        expect.arrayContaining([expect.objectContaining({ name: 'regionId', value: '02' })]),
        300000,
      );
    });

    test('should omit region filter clause when regionId is not provided', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 0, 10, null);

      const query = spy.mock.calls[0][1] as string;
      expect(query).not.toContain('@regionId');
    });

    test('should include change date filter clause when changeDate is provided', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 0, 10, null, undefined, '2026-07-01');

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('m.CDB_UPDATE_DATE = @changeDate'),
        expect.arrayContaining([expect.objectContaining({ name: 'changeDate', value: 20260701 })]),
        300000,
      );
    });

    test('should omit change date filter clause when changeDate is not provided', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getCmmapAppointmentsRaw(context, 0, 10, null);

      const query = spy.mock.calls[0][1] as string;
      expect(query).not.toContain('@changeDate');
    });
  });

  describe('getLatestCmmapChangeDateForRegion', () => {
    test('should return the formatted date from the first (DESC-ordered) row', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [{ CDB_UPDATE_DATE: 20260701 }] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getLatestCmmapChangeDateForRegion(context, '02');

      expect(result).toBe('2026-07-01');
    });

    test.each([
      { cdbUpdateDate: 20261301, description: 'month out of range' },
      { cdbUpdateDate: 202, description: 'not 8 digits' },
    ])(
      'should throw instead of returning a garbage date when CDB_UPDATE_DATE is $description',
      async ({ cdbUpdateDate }) => {
        vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
          success: true,
          results: { recordset: [{ CDB_UPDATE_DATE: cdbUpdateDate }] },
          message: '',
        });

        const context = await createMockApplicationContext();
        const gateway = new AcmsGatewayImpl(context);

        await expect(
          gateway.getLatestCmmapChangeDateForRegion(context, '02'),
        ).rejects.toMatchObject({
          isCamsError: true,
          originalError: expect.stringContaining(String(cdbUpdateDate)),
        });
      },
    );

    test('should return undefined when the region has no matching rows', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getLatestCmmapChangeDateForRegion(context, '02');

      expect(result).toBeUndefined();
    });

    // The driver reads TOP 1 as the region's newest change date. Ascending order would return the
    // oldest date instead, and the region would never catch up.
    test('should filter by region and order by CDB_UPDATE_DATE descending', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getLatestCmmapChangeDateForRegion(context, '02');

      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain('m.REGION_CODE = @regionId');
      expect(query).toContain('ORDER BY m.CDB_UPDATE_DATE DESC');
      expect(spy).toHaveBeenCalledWith(
        context,
        expect.any(String),
        expect.arrayContaining([expect.objectContaining({ name: 'regionId', value: '02' })]),
      );
    });

    test('should share the CMMAP row-inclusion filters with getCmmapAppointmentsRaw', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getLatestCmmapChangeDateForRegion(context, '02');
      const latestQuery = spy.mock.calls[0][1] as string;

      await gateway.getCmmapAppointmentsRaw(context, 0, 10, null);
      const rawQuery = spy.mock.calls[1][1] as string;

      expect(latestQuery).toContain(CMMAP_ROW_INCLUSION_FILTERS);
      expect(rawQuery).toContain(CMMAP_ROW_INCLUSION_FILTERS);
    });

    // These are the rows the sync treats as appointments: not deleted (appointment, case or
    // professional), a real professional code (not 0 or a 98000+ sentinel), a trustee
    // appointment, and a case still open or closed after 2018. The test above proves both queries
    // use this one fragment.
    test('should select live trustee appointments with real professional codes on cases open or closed after 2018', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getLatestCmmapChangeDateForRegion(context, '02');

      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain("m.DELETE_CODE != 'D'");
      expect(query).toContain('m.PROF_CODE > 0');
      expect(query).toContain('m.PROF_CODE < 98000');
      expect(query).toContain("m.APPT_TYPE = 'TR'");
      expect(query).toContain("c.DELETE_CODE != 'D'");
      expect(query).toContain("p.DELETE_CODE != 'D'");
      expect(query).toContain(
        'c.CLOSED_BY_COURT_DATE > 20180101 OR c.CLOSED_BY_UST_DATE > 20180101',
      );
      expect(query).toContain('c.CLOSED_BY_COURT_DATE = 0 AND c.CLOSED_BY_UST_DATE = 0');
    });
  });

  describe('getTrusteeProfessionalRecordsPage', () => {
    test('should return demographic fields for the given group, filtered by PROF_TYPE = TR', async () => {
      const dbResults = [
        {
          acmsProfessionalId: 'NY-00063',
          firstName: 'Harvey',
          lastName: 'Barr',
          middleInitial: 'Q',
          address1: '500 Fingerprint Ln',
          address2: '',
          city: 'Albany',
          state: 'NY',
          zip: 122070000,
          phone: '5185550100',
          fax: '',
        },
      ];
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getTrusteeProfessionalRecordsPage(context, 'NY', 0, 500);

      expect(result).toEqual(dbResults);

      // Only trustees (PROF_TYPE 'TR'), only the requested group, resumed after the last
      // UST_PROF_CODE seen -- the professional-id sync bookmarks each group by that code.
      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain("PROF_TYPE = 'TR'");
      expect(query).toContain('GROUP_DESIGNATOR = @groupDesignator');
      expect(query).toContain('UST_PROF_CODE > @lastUstProfCode');

      const timeoutArg = spy.mock.calls[0][3];
      const expectedTimeout = parseAcmsTimeoutMs(process.env.ACMS_REQUEST_TIMEOUT_MS);
      expect(timeoutArg).toBe(expectedTimeout);
    });

    test.each([
      ['should exclude soft-deleted professional records', "DELETE_CODE != 'D'"],
      [
        'should exclude ACMS reserved sentinel/dummy trustee codes (>= 98000)',
        'ACMS.UST_PROF_CODE < 98000',
      ],
    ])('%s', async (_description, expectedClause) => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getTrusteeProfessionalRecordsPage(context, 'NY', 0, 500);

      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain(expectedClause);
    });

    // No PROF_LAST_NAME placeholder-name filtering (DECEASED, NO TRUSTEE, FAKE, PRO SE, etc.)
    // happens in this gateway - shouldSkipAsNotAPerson (sync-acms-professional-ids.ts) is the
    // single source of truth for which records name no real trustee, so this query only excludes
    // concerns a data-access layer actually owns (soft-delete, sentinel codes).
    test('should not filter on PROF_LAST_NAME at all - placeholder detection lives in the TS layer', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getTrusteeProfessionalRecordsPage(context, 'NY', 0, 500);

      const query = spy.mock.calls[0][1] as string;
      expect(query).not.toContain('PROF_LAST_NAME NOT LIKE');
    });

    test.each([
      ['PROF_COMMERCIAL_PHONE_NBR', 'phone'],
      ['PROF_FAX_NBR', 'fax'],
    ])(
      'should cast %s to VARCHAR, since the column is numeric but %s is typed as a string',
      async (column, alias) => {
        const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
          success: true,
          results: { recordset: [] },
          message: '',
        });

        const context = await createMockApplicationContext();
        const gateway = new AcmsGatewayImpl(context);
        await gateway.getTrusteeProfessionalRecordsPage(context, 'NY', 0, 500);

        const query = spy.mock.calls[0][1] as string;
        expect(query).toMatch(
          new RegExp(`CAST\\(ACMS\\.${column} AS VARCHAR\\(\\d+\\)\\) AS ${alias}`),
        );
      },
    );

    test('should select PROF_ZIP as its raw numeric value, not cast to VARCHAR', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getTrusteeProfessionalRecordsPage(context, 'NY', 0, 500);

      const query = spy.mock.calls[0][1] as string;
      // Zero-padding/dash-insertion happens downstream in formatAcmsZip (TypeScript), not SQL —
      // a CAST here would silently drop PROF_ZIP's leading zeros before that formatting ever runs.
      expect(query).not.toMatch(/CAST\(ACMS\.PROF_ZIP/);
      expect(query).toContain('ACMS.PROF_ZIP AS zip');
    });

    test.each([
      ['PROF_FIRST_NAME', 'firstName'],
      ['PROF_LAST_NAME', 'lastName'],
      ['PROF_MI', 'middleInitial'],
      ['PROF_ADDRESS1', 'address1'],
      ['PROF_ADDRESS2', 'address2'],
      ['PROF_CITY', 'city'],
      ['PROF_STATE', 'state'],
    ])(
      'should RTRIM %s, since the column is fixed-width CHAR padded with trailing spaces',
      async (column, alias) => {
        const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
          success: true,
          results: { recordset: [] },
          message: '',
        });

        const context = await createMockApplicationContext();
        const gateway = new AcmsGatewayImpl(context);
        await gateway.getTrusteeProfessionalRecordsPage(context, 'NY', 0, 500);

        const query = spy.mock.calls[0][1] as string;
        expect(query).toMatch(new RegExp(`RTRIM\\(ACMS\\.${column}\\) AS ${alias}`));
      },
    );

    test('should paginate using UST_PROF_CODE keyset cursor scoped to the given group', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getTrusteeProfessionalRecordsPage(context, 'UT', 42, 500);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.stringContaining('ORDER BY ACMS.UST_PROF_CODE'),
        expect.arrayContaining([
          expect.objectContaining({ name: 'groupDesignator', value: 'UT' }),
          expect.objectContaining({ name: 'lastUstProfCode', value: 42 }),
          expect.objectContaining({ name: 'pageSize', value: 500 }),
        ]),
        expect.any(Number),
      );
    });

    test('should return empty array when no records found', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getTrusteeProfessionalRecordsPage(context, 'NY', 0, 500);

      expect(result).toEqual([]);
    });
  });

  describe('getActiveAppointmentsForProfessional', () => {
    test('should return empty array when the professional has no active appointments', async () => {
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getActiveAppointmentsForProfessional(context, 'NY', 63);

      expect(result).toEqual([]);
    });

    test('should map division and chapter fields from query results', async () => {
      const dbResults = [
        { division: '081', chapter: '7' },
        { division: '083', chapter: '13' },
      ];
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: dbResults },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getActiveAppointmentsForProfessional(context, 'NY', 63);

      expect(result).toEqual(dbResults);
    });

    // Active appointments for one professional, identified by the compound key (group, code).
    // CMMDB joins on the full case key (division, year, number): any one part alone matches
    // other cases. Disposed and deleted rows are not active appointments.
    test.each([
      ['scope to the given group', 'GROUP_DESIGNATOR = @groupDesignator'],
      ['scope to the given professional', 'PROF_CODE = @ustProfCode'],
      ['exclude soft-deleted appointments', "m.DELETE_CODE != 'D'"],
      ['exclude appointments for deleted cases', "c.DELETE_CODE != 'D'"],
      ['exclude disposed appointments', 'DISP_DATE'],
      ['join CMMAP to CMMDB on the case compound key', 'INNER JOIN [dbo].[CMMDB]'],
      ['join on CASE_DIV', 'm.CASE_DIV = c.CASE_DIV'],
      ['join on CASE_YEAR', 'm.CASE_YEAR = c.CASE_YEAR'],
      ['join on CASE_NUMBER', 'm.CASE_NUMBER = c.CASE_NUMBER'],
      ['deduplicate distinct division/chapter pairs', 'SELECT DISTINCT'],
    ])('should %s', async (_desc, expectedQueryFragment) => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getActiveAppointmentsForProfessional(context, 'NY', 63);

      const query = spy.mock.calls[0][1] as string;
      expect(query).toContain(expectedQueryFragment);
    });

    test('should bind the given group designator and UST_PROF_CODE', async () => {
      const spy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: { recordset: [] },
        message: '',
      });

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      await gateway.getActiveAppointmentsForProfessional(context, 'UT', 5321);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ name: 'groupDesignator', value: 'UT' }),
          expect.objectContaining({ name: 'ustProfCode', value: 5321 }),
        ]),
      );
    });
  });
});
