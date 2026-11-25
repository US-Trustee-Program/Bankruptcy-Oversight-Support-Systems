import { vi } from 'vitest';
import { AtsGatewayImpl } from './ats.gateway';
import { MockAtsGateway } from './ats.mock.gateway';
import {
  createMockApplicationContext,
  generateTestCredential,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CamsError } from '../../../common-errors/cams-error';
import { CleansingClassification } from './cleansing/ats-cleansing-types';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';

describe('ATS Gateway', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  describe('MockAtsGateway', () => {
    let gateway: MockAtsGateway;

    beforeEach(() => {
      gateway = MockAtsGateway.getInstance();
    });

    test('should return trustees in pages', async () => {
      const firstPage = await gateway.getTrusteesPage(context, null, 2);
      expect(firstPage).toHaveLength(2);
      expect(firstPage[0].ID).toBe(1);
      expect(firstPage[1].ID).toBe(2);

      const secondPage = await gateway.getTrusteesPage(context, 2, 2);
      expect(secondPage).toHaveLength(2);
      expect(secondPage[0].ID).toBe(3);
      expect(secondPage[1].ID).toBe(4);

      const lastPage = await gateway.getTrusteesPage(context, 4, 2);
      expect(lastPage).toHaveLength(1);
      expect(lastPage[0].ID).toBe(5);

      const emptyPage = await gateway.getTrusteesPage(context, 5, 2);
      expect(emptyPage).toHaveLength(0);
    });

    test('should return the mock trustees that exist for a list of IDs', async () => {
      const result = await gateway.getTrusteesByIds(context, [2, 99, 5]);
      expect(result.map((record) => record.ID)).toEqual([2, 5]);
      expect(result[0]).toEqual((await gateway.getTrusteesPage(context, 1, 1, true))[0]);
    });

    test('should return only active mock trustees as TOD-only candidates', async () => {
      expect(await gateway.getTodOnlyCandidates(context, [5, 6, 99])).toEqual([
        { id: 5, statusMissing: false },
      ]);
    });

    test('should return trustee appointments', async () => {
      const result = await gateway.getTrusteeAppointments(context, 1);
      expect(result.cleanAppointments.length).toBeGreaterThan(0);

      // MockAtsGateway returns raw ATS records cast as TrusteeAppointmentInput[] for simplicity
      // Note: In mock, these are AtsAppointmentRecords, not fully cleansed CAMS types
      expect(result.cleanAppointments.length).toBe(2); // Trustee 1 has 2 appointments in mock data
      expect(result.stats.total).toBe(2);
      expect(result.stats.clean).toBe(2);
    });

    test('should return each requested trustee appointments by ID, cleansed like the real gateway', async () => {
      const result = await gateway.getTrusteeAppointmentsByIds(context, [1, 6]);

      expect([...result.keys()]).toEqual([1, 6]);
      // The report's Southern New York row translates; the other fixture rows have no serving
      // state, so the real cleansing cannot map their district.
      expect(result.get(1)).toEqual(
        expect.objectContaining({
          cleanAppointments: [
            expect.objectContaining({ courtId: '0208', chapter: '7', appointmentType: 'panel' }),
          ],
          stats: expect.objectContaining({ total: 3, clean: 1, problematic: 2 }),
        }),
      );
      expect(result.get(6)?.stats).toEqual(expect.objectContaining({ total: 1, problematic: 1 }));
    });

    test('should return correct trustee count', async () => {
      // Returns 5 — active trustees only (inactive trustee 6 is excluded)
      const count = await gateway.getTrusteeCount(context);
      expect(count).toBe(5);
    });

    test('should exclude trustees with no active appointments', async () => {
      // Trustee 6 exists in the mock pool but has only inactive appointments
      const page = await gateway.getTrusteesPage(context, null, 10);
      const ids = page.map((t) => t.ID);
      expect(ids).not.toContain(6);
      expect(ids).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    });

    test('should include all trustees when importAll is true', async () => {
      const page = await gateway.getTrusteesPage(context, null, 10, true);
      const ids = page.map((t) => t.ID);
      expect(ids).toContain(6);
      expect(ids).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
    });

    test('should return total count including inactive trustees when importAll is true', async () => {
      const count = await gateway.getTrusteeCount(context, true);
      expect(count).toBe(6);
    });

    test('should successfully test connection', async () => {
      const result = await gateway.testConnection(context);
      expect(result).toBe(true);
    });
  });

  describe('AtsGatewayImpl', () => {
    let gateway: AtsGatewayImpl;
    let mockExecuteQuery: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      vi.restoreAllMocks();

      // Create a mock context with ATS config
      context = await createMockApplicationContext();

      // Mock the atsDbConfig on the config object
      vi.spyOn(context.config, 'get').mockImplementation((prop: string) => {
        if (prop === 'dbMock') return false;
        return undefined;
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (context.config as any).atsDbConfig = {
        server: 'test-server',
        database: 'test-db',
        user: 'test-user',
        password: generateTestCredential(),
        port: 1433,
        requestTimeout: 15000,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
        options: {
          encrypt: true,
          trustServerCertificate: true,
        },
      };

      gateway = new AtsGatewayImpl(context);

      // Mock the executeQuery method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockExecuteQuery = vi.spyOn(gateway as any, 'executeQuery');
    });

    test.each([
      {
        method: 'getTrusteesByIds' as const,
        rows: [[{ ID: 1 }], [{ ID: 501 }], [{ ID: 1001 }]],
        expected: [{ ID: 1 }, { ID: 501 }, { ID: 1001 }],
      },
      {
        method: 'getTodOnlyCandidates' as const,
        rows: [1, 501, 1001].map((id) => [{ TRU_ID: id, HAS_ACTIVE: 1, HAS_EMPTY: 0 }]),
        expected: [1, 501, 1001].map((id) => ({ id, statusMissing: false })),
      },
    ])('$method should combine the results of every batch', async ({ method, rows, expected }) => {
      rows.forEach((recordset) =>
        mockExecuteQuery.mockResolvedValueOnce({ results: { recordset } }),
      );
      const ids = Array.from({ length: 1200 }, (_, i) => i + 1);

      expect(await gateway[method](context, ids)).toEqual(expected);
    });

    describe('getTrusteesByIds', () => {
      test('should select trustees whose ID is in the list, one parameter per ID', async () => {
        const records = [{ ID: 7 }, { ID: 9 }];
        mockExecuteQuery.mockResolvedValue({ results: { recordset: records } });

        const result = await gateway.getTrusteesByIds(context, [7, 9]);

        expect(result).toEqual(records);
        const [, query, input] = mockExecuteQuery.mock.calls[0];
        expect(query).toContain('FROM TRUSTEES T');
        expect(query).toContain('T.ID IN (@id0, @id1)');
        expect(input).toEqual([
          expect.objectContaining({ name: 'id0', value: 7 }),
          expect.objectContaining({ name: 'id1', value: 9 }),
        ]);
      });

      test('should query in batches of 500 IDs', async () => {
        mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });
        const ids = Array.from({ length: 1200 }, (_, i) => i + 1);

        await gateway.getTrusteesByIds(context, ids);

        expect(mockExecuteQuery.mock.calls.map(([, , input]) => input.length)).toEqual([
          500, 500, 200,
        ]);
      });

      test('should not query when the list is empty', async () => {
        expect(await gateway.getTrusteesByIds(context, [])).toEqual([]);
        expect(mockExecuteQuery).not.toHaveBeenCalled();
      });

      test('should wrap query errors as CamsError', async () => {
        mockExecuteQuery.mockRejectedValue(new Error('boom'));

        await expect(gateway.getTrusteesByIds(context, [1])).rejects.toBeInstanceOf(CamsError);
      });
    });

    describe('getTodOnlyCandidates', () => {
      test('should return trustees with an active status, and flag those with only an empty status', async () => {
        mockExecuteQuery.mockResolvedValue({
          results: {
            recordset: [
              { TRU_ID: 3, HAS_ACTIVE: 1, HAS_EMPTY: 1 },
              { TRU_ID: 4, HAS_ACTIVE: 0, HAS_EMPTY: 1 },
              { TRU_ID: 5, HAS_ACTIVE: 0, HAS_EMPTY: 0 },
            ],
          },
        });

        expect(await gateway.getTodOnlyCandidates(context, [3, 4, 5])).toEqual([
          { id: 3, statusMissing: false },
          { id: 4, statusMissing: true },
        ]);
      });

      test('should read the given trustees from CHAPTER_DETAILS, one parameter per ID, treating a null or blank status as empty', async () => {
        mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

        await gateway.getTodOnlyCandidates(context, [3, 4]);

        const [, query, input] = mockExecuteQuery.mock.calls[0];
        expect(query).toContain('FROM CHAPTER_DETAILS CD');
        expect(query).toContain('CD.TRU_ID IN (@id0, @id1)');
        expect(query).toContain('GROUP BY CD.TRU_ID');
        expect(input).toEqual([
          expect.objectContaining({ name: 'id0', value: 3 }),
          expect.objectContaining({ name: 'id1', value: 4 }),
        ]);
        expect(query).toContain(
          "MAX(CASE WHEN (CD.STATUS IS NULL OR LTRIM(RTRIM(CD.STATUS)) = '') THEN 1 ELSE 0 END) AS HAS_EMPTY",
        );
      });

      test('should not query when the list is empty', async () => {
        expect(await gateway.getTodOnlyCandidates(context, [])).toEqual([]);
        expect(mockExecuteQuery).not.toHaveBeenCalled();
      });

      test('should wrap query errors as CamsError', async () => {
        mockExecuteQuery.mockRejectedValue(new Error('boom'));

        await expect(gateway.getTodOnlyCandidates(context, [1])).rejects.toBeInstanceOf(CamsError);
      });
    });

    // The whole active-status condition, literally: the codes active on every chapter, then each
    // code active only on its case-by-case chapter. 13CBC has no such code and adds no clause, so
    // no query ever contains an empty IN (). The page and count queries apply it only to the
    // trustee's own chapters.
    const ACTIVE_CONDITION =
      "CD.STATUS IN ('1','8','12','P','PA','O','C','S','E','V') OR (CD.CHAPTER = '12CBC' AND CD.STATUS IN ('2'))";

    test.each([
      {
        method: 'getTrusteesPage' as const,
        call: (g: AtsGatewayImpl) => g.getTrusteesPage(context, null, 50),
        expected: `WHERE CD.TRU_ID = T.ID AND (${ACTIVE_CONDITION})`,
      },
      {
        method: 'getTrusteeCount' as const,
        call: (g: AtsGatewayImpl) => g.getTrusteeCount(context),
        expected: `WHERE CD.TRU_ID = T.ID AND (${ACTIVE_CONDITION})`,
      },
      {
        method: 'getTodOnlyCandidates' as const,
        call: (g: AtsGatewayImpl) => g.getTodOnlyCandidates(context, [1]),
        expected: `MAX(CASE WHEN ${ACTIVE_CONDITION} THEN 1 ELSE 0 END) AS HAS_ACTIVE`,
      },
    ])(
      '$method should treat a status as active on every chapter, or only on its case-by-case chapter',
      async ({ call, expected }) => {
        mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

        await call(gateway);

        const [, query] = mockExecuteQuery.mock.calls[0];
        // The page and count queries break the line between the trustee match and the condition.
        expect(query.replace(/\s+/g, ' ')).toContain(expected);
        expect(query).not.toMatch(/IN \(\s*\)/);
      },
    );

    test('should build correct query for first page of trustees', async () => {
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      await gateway.getTrusteesPage(context, null, 50);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('FROM TRUSTEES'),
        expect.arrayContaining([expect.objectContaining({ name: 'pageSize', value: 50 })]),
      );

      const query = mockExecuteQuery.mock.calls[0][1];
      // Active-only filter is always present
      expect(query).toContain('WHERE EXISTS');
      expect(query).toContain('CHAPTER_DETAILS');
      // Cursor condition not present on first page
      expect(query).not.toContain('AND T.ID > @lastId');
    });

    test('should build correct query for subsequent pages of trustees', async () => {
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      await gateway.getTrusteesPage(context, 100, 50);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('AND T.ID > @lastId'),
        expect.arrayContaining([
          expect.objectContaining({ name: 'pageSize', value: 50 }),
          expect.objectContaining({ name: 'lastId', value: 100 }),
        ]),
      );

      const query = mockExecuteQuery.mock.calls[0][1];
      expect(query).toContain('WHERE EXISTS');
    });

    test('should handle query errors gracefully', async () => {
      const testError = new Error('Database connection failed');
      mockExecuteQuery.mockRejectedValue(testError);

      // Spy on logger.error
      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      await expect(gateway.getTrusteesPage(context, null, 50)).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    describe('getTrusteeAppointmentsByIds', () => {
      const middleLouisiana = (truId: number, chapter: string, appointed: string) => ({
        TRU_ID: truId,
        DISTRICT: 'Middle',
        STATE: 'Louisiana',
        CHAPTER: chapter,
        STATUS: 'PA',
        DATE_APPOINTED: new Date(appointed),
        EFFECTIVE_DATE: new Date(appointed),
      });

      test('should read the given trustees from CHAPTER_DETAILS in one query, one parameter per ID, newest appointment first', async () => {
        mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

        await gateway.getTrusteeAppointmentsByIds(context, [3, 4]);

        expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
        const [, query, input] = mockExecuteQuery.mock.calls[0];
        expect(query).toContain('FROM CHAPTER_DETAILS');
        expect(query).toContain('TRU_ID IN (@id0, @id1)');
        expect(query).toContain('ORDER BY APPOINTED_DATE DESC');
        expect(query).toContain('ARCHIVE_DATE');
        expect(input).toEqual([
          expect.objectContaining({ name: 'id0', value: 3 }),
          expect.objectContaining({ name: 'id1', value: 4 }),
        ]);
      });

      test('should sort appointments exactly as getTrusteeAppointments does, breaking ties on appointed date by every column read', async () => {
        mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

        await gateway.getTrusteeAppointmentsByIds(context, [3]);
        await gateway.getTrusteeAppointments(context, 3);

        const orderBy = (call: unknown[]) =>
          String(call[1]).replace(/\s+/g, ' ').split('ORDER BY ')[1].trim();
        const [batched, single] = mockExecuteQuery.mock.calls.map(orderBy);
        expect(batched).toBe(single);
        expect(batched).toBe(
          'APPOINTED_DATE DESC, STATUS_EFF_DATE DESC, DISTRICT, SERVING_STATE, CHAPTER, STATUS, ARCHIVE_DATE',
        );
      });

      test('should cleanse each trustee appointments exactly as getTrusteeAppointments does, keeping the order SQL returned', async () => {
        const newer123 = middleLouisiana(123, '7', '2023-01-15');
        const only124 = middleLouisiana(124, '12', '2021-02-01');
        const older123 = middleLouisiana(123, '13', '2020-05-01');
        mockExecuteQuery
          .mockResolvedValueOnce({ results: { recordset: [newer123, only124, older123] } })
          .mockResolvedValueOnce({ results: { recordset: [newer123, older123] } })
          .mockResolvedValueOnce({ results: { recordset: [only124] } });

        const batched = await gateway.getTrusteeAppointmentsByIds(context, [123, 124]);

        expect(batched.get(123)).toEqual(await gateway.getTrusteeAppointments(context, 123));
        expect(batched.get(124)).toEqual(await gateway.getTrusteeAppointments(context, 124));
        expect(batched.get(123)?.cleanAppointments.map((a) => a.appointedDate)).toEqual([
          '2023-01-15',
          '2020-05-01',
        ]);
      });

      test('should apply the TOD overrides, as the load did', async () => {
        const overridesModule = await import('./cleansing/ats-cleansing-overrides');
        vi.spyOn(overridesModule, 'loadTrusteeOverrides').mockResolvedValue({
          data: new Map([
            [
              '123',
              [
                {
                  trusteeId: '123',
                  status: 'PA',
                  district: 'Middle',
                  state: 'Louisiana',
                  chapter: '7',
                  action: 'SKIP',
                },
              ],
            ],
          ]),
        });
        mockExecuteQuery.mockResolvedValue({
          results: { recordset: [middleLouisiana(123, '7', '2023-01-15')] },
        });

        const result = await gateway.getTrusteeAppointmentsByIds(context, [123]);

        expect(result.get(123)?.stats).toEqual(expect.objectContaining({ total: 1, skipped: 1 }));
        expect(result.get(123)?.cleanAppointments).toEqual([]);
      });

      test.each([
        [
          'fail to load',
          { error: new CamsError('ATS-GATEWAY', { message: 'Failed to read override file' }) },
        ],
        ['load nothing', {}],
      ])('should fail rather than compare without overrides when they %s', async (_, loaded) => {
        const overridesModule = await import('./cleansing/ats-cleansing-overrides');
        vi.spyOn(overridesModule, 'loadTrusteeOverrides').mockResolvedValue(loaded);
        mockExecuteQuery.mockResolvedValue({
          results: { recordset: [middleLouisiana(123, '7', '2023-01-15')] },
        });

        await expect(gateway.getTrusteeAppointmentsByIds(context, [123])).rejects.toBeInstanceOf(
          CamsError,
        );
      });

      test('should count skipped and failed rows per trustee', async () => {
        const pipelineModule = await import('./cleansing/ats-cleansing-pipeline');
        vi.spyOn(pipelineModule, 'cleanseAndMapAppointment').mockImplementation(
          (_context, trusteeId) =>
            trusteeId === '1'
              ? {
                  classification: CleansingClassification.SKIP,
                  courtIds: [],
                  mapType: 'OVERRIDE',
                  notes: [],
                  skip: true,
                }
              : {
                  classification: CleansingClassification.PROBLEMATIC,
                  courtIds: [],
                  mapType: 'UNMAPPED',
                  notes: [],
                  skip: false,
                },
        );
        mockExecuteQuery.mockResolvedValue({
          results: { recordset: [{ TRU_ID: 1 }, { TRU_ID: 2 }, { TRU_ID: 2 }] },
        });

        const result = await gateway.getTrusteeAppointmentsByIds(context, [1, 2]);

        expect(result.get(1)?.stats).toEqual(expect.objectContaining({ total: 1, skipped: 1 }));
        expect(result.get(2)?.stats).toEqual(expect.objectContaining({ total: 2, problematic: 2 }));
        expect(result.get(2)?.failedAppointments).toHaveLength(2);
      });

      test('should return an empty result for a requested trustee with no appointments', async () => {
        mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

        const result = await gateway.getTrusteeAppointmentsByIds(context, [9]);

        expect(result.get(9)).toEqual({
          cleanAppointments: [],
          failedAppointments: [],
          stats: {
            total: 0,
            clean: 0,
            autoRecoverable: 0,
            problematic: 0,
            uncleansable: 0,
            skipped: 0,
          },
        });
      });

      test('should query in batches of 500 IDs and combine them', async () => {
        mockExecuteQuery
          .mockResolvedValueOnce({
            results: { recordset: [middleLouisiana(1, '7', '2023-01-15')] },
          })
          .mockResolvedValueOnce({ results: { recordset: [] } })
          .mockResolvedValueOnce({
            results: { recordset: [middleLouisiana(1001, '7', '2023-01-15')] },
          });
        const ids = Array.from({ length: 1200 }, (_, i) => i + 1);

        const result = await gateway.getTrusteeAppointmentsByIds(context, ids);

        expect(mockExecuteQuery.mock.calls.map(([, , input]) => input.length)).toEqual([
          500, 500, 200,
        ]);
        expect(result.size).toBe(1200);
        expect(result.get(1)?.cleanAppointments).toHaveLength(1);
        expect(result.get(1001)?.cleanAppointments).toHaveLength(1);
      });

      test('should fail rather than drop appointments for a trustee that was not requested', async () => {
        mockExecuteQuery.mockResolvedValue({
          results: { recordset: [middleLouisiana(99, '7', '2023-01-15')] },
        });

        await expect(gateway.getTrusteeAppointmentsByIds(context, [1])).rejects.toBeInstanceOf(
          CamsError,
        );
      });

      test('should not query when the list is empty', async () => {
        expect((await gateway.getTrusteeAppointmentsByIds(context, [])).size).toBe(0);
        expect(mockExecuteQuery).not.toHaveBeenCalled();
      });

      test('should wrap query errors as CamsError', async () => {
        mockExecuteQuery.mockRejectedValue(new Error('boom'));

        await expect(gateway.getTrusteeAppointmentsByIds(context, [1])).rejects.toBeInstanceOf(
          CamsError,
        );
      });
    });

    test('should query appointments for a specific trustee and return clean CAMS types', async () => {
      // Gateway queries raw ATS data
      mockExecuteQuery.mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 123,
              DISTRICT: 'Middle',
              STATE: 'Louisiana',
              CHAPTER: '7',
              STATUS: 'PA',
              DATE_APPOINTED: new Date('2023-01-15'),
              EFFECTIVE_DATE: new Date('2023-01-15'),
            },
          ],
        },
      });

      // Gateway returns TrusteeAppointmentsResult with clean CAMS types
      const result = await gateway.getTrusteeAppointments(context, 123);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('FROM CHAPTER_DETAILS'),
        expect.arrayContaining([expect.objectContaining({ name: 'trusteeId', value: 123 })]),
      );

      // Should return clean CAMS appointment types
      expect(result.cleanAppointments).toHaveLength(1);
      expect(result.cleanAppointments[0]).toMatchObject({
        chapter: '7',
        appointmentType: 'panel',
        courtId: '053N', // Middle Louisiana
        status: 'active',
      });
    });

    test('should get total trustee count', async () => {
      mockExecuteQuery.mockResolvedValue({
        results: { recordset: [{ totalCount: 1234 }] },
      });

      const count = await gateway.getTrusteeCount(context);

      const query = mockExecuteQuery.mock.calls[0][1];
      expect(query).toContain('COUNT(*) as totalCount');
      expect(query).toContain('WHERE EXISTS');
      expect(query).toContain('CHAPTER_DETAILS');

      expect(count).toBe(1234);
    });

    test('should omit active filter when importAll is true for getTrusteesPage', async () => {
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      await gateway.getTrusteesPage(context, null, 50, true);

      const query = mockExecuteQuery.mock.calls[0][1];
      expect(query).not.toContain('WHERE EXISTS');
      expect(query).not.toContain('CHAPTER_DETAILS');
      expect(query).toContain('FROM TRUSTEES');
    });

    test('should use WHERE clause for cursor when importAll is true', async () => {
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      await gateway.getTrusteesPage(context, 100, 50, true);

      const query = mockExecuteQuery.mock.calls[0][1];
      expect(query).toContain('WHERE T.ID > @lastId');
      expect(query).not.toContain('AND T.ID > @lastId');
    });

    test('should omit active filter when importAll is true for getTrusteeCount', async () => {
      mockExecuteQuery.mockResolvedValue({
        results: { recordset: [{ totalCount: 9999 }] },
      });

      const count = await gateway.getTrusteeCount(context, true);

      const query = mockExecuteQuery.mock.calls[0][1];
      expect(query).toContain('COUNT(*) as totalCount');
      expect(query).not.toContain('WHERE EXISTS');
      expect(query).not.toContain('CHAPTER_DETAILS');
      expect(count).toBe(9999);
    });

    test('should test database connection', async () => {
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [{ test: 1 }] } });

      const result = await gateway.testConnection(context);

      expect(mockExecuteQuery).toHaveBeenCalledWith(context, 'SELECT 1 as test');

      expect(result).toBe(true);
    });

    test('should return false when connection test fails', async () => {
      mockExecuteQuery.mockRejectedValue(new Error('Connection failed'));

      // Spy on logger.error
      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      const result = await gateway.testConnection(context);

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    test('should handle getTrusteeAppointments query error', async () => {
      mockExecuteQuery.mockRejectedValue(new Error('Query timeout'));

      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      await expect(gateway.getTrusteeAppointments(context, 123)).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'ATS-GATEWAY',
        'Error retrieving appointments',
        expect.objectContaining({
          trusteeId: 123,
        }),
      );
    });

    test('should handle getTrusteeCount query error', async () => {
      mockExecuteQuery.mockRejectedValue(new Error('Database unavailable'));

      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      await expect(gateway.getTrusteeCount(context)).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'ATS-GATEWAY',
        'Error getting trustee count',
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });

    test('should skip appointments with SKIP classification', async () => {
      // Return an appointment that will be classified as SKIP (test data)
      mockExecuteQuery.mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 17120,
              DISTRICT: 'test',
              STATE: 'testt',
              CHAPTER: '7',
              STATUS: 'NP',
              DATE_APPOINTED: new Date('2023-01-15'),
              EFFECTIVE_DATE: new Date('2023-01-15'),
            },
          ],
        },
      });

      const result = await gateway.getTrusteeAppointments(context, 17120);

      // Should return empty cleanAppointments array (skipped)
      expect(result.cleanAppointments).toHaveLength(0);
    });

    test('should filter out UNCLEANSABLE appointments', async () => {
      // Return an appointment with unmappable data
      mockExecuteQuery.mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 999,
              DISTRICT: 'Invalid District',
              STATE: 'Invalid State',
              CHAPTER: '7',
              STATUS: 'PA',
              DATE_APPOINTED: new Date('2023-01-15'),
              EFFECTIVE_DATE: new Date('2023-01-15'),
            },
          ],
        },
      });

      const loggerWarnSpy = vi.spyOn(context.logger, 'warn');

      const result = await gateway.getTrusteeAppointments(context, 999);

      // Should return empty cleanAppointments array (filtered out)
      expect(result.cleanAppointments).toHaveLength(0);
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    test('should handle multi-expansion for multi-state appointments', async () => {
      // Return an appointment that needs multi-expansion
      // Note: Multi-expansion happens when one ATS record maps to multiple court IDs
      // This is handled in the cleansing pipeline based on regional patterns
      mockExecuteQuery.mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 456,
              DISTRICT: 'Middle',
              STATE: 'Louisiana',
              CHAPTER: '12', // Chapter 12 expands to both chapter 12 and 12CBC
              STATUS: 'PA',
              DATE_APPOINTED: new Date('2023-01-15'),
              EFFECTIVE_DATE: new Date('2023-01-15'),
            },
          ],
        },
      });

      const loggerDebugSpy = vi.spyOn(context.logger, 'debug');

      const result = await gateway.getTrusteeAppointments(context, 456);

      // Should create appointments (may be single or expanded based on cleansing logic)
      expect(result.cleanAppointments.length).toBeGreaterThanOrEqual(1);
      expect(result.cleanAppointments.every((apt) => apt.status === 'active')).toBe(true);

      // Verify debug logging occurred during cleansing
      expect(loggerDebugSpy).toHaveBeenCalled();
    });

    test('should include ARCHIVE_DATE in the CHAPTER_DETAILS SELECT query', async () => {
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      await gateway.getTrusteeAppointments(context, 123);

      const query = mockExecuteQuery.mock.calls[0][1] as string;
      expect(query).toContain('ARCHIVE_DATE');
      expect(query).toContain('FROM CHAPTER_DETAILS');
    });

    test('should return inactive status when ARCHIVE_DATE is set for a case-by-case appointment (CAMS-772)', async () => {
      const archiveDate = new Date('2019-06-15');
      mockExecuteQuery.mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 123,
              DISTRICT: 'Middle',
              STATE: 'Louisiana',
              CHAPTER: '7',
              STATUS: 'C', // case-by-case active code
              DATE_APPOINTED: new Date('2010-01-01'),
              EFFECTIVE_DATE: new Date('2010-01-01'),
              ARCHIVE_DATE: archiveDate,
            },
          ],
        },
      });

      const result = await gateway.getTrusteeAppointments(context, 123);

      expect(result.cleanAppointments).toHaveLength(1);
      expect(result.cleanAppointments[0]).toMatchObject({
        appointmentType: 'case-by-case',
        status: 'inactive',
        effectiveDate: '2019-06-15',
      });
    });

    test('should return inactive status when ARCHIVE_DATE is set for an elected appointment (CAMS-772)', async () => {
      mockExecuteQuery.mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 456,
              DISTRICT: 'Middle',
              STATE: 'Louisiana',
              CHAPTER: '7',
              STATUS: 'E', // elected active code
              DATE_APPOINTED: new Date('2010-01-01'),
              EFFECTIVE_DATE: new Date('2010-01-01'),
              ARCHIVE_DATE: new Date('2020-03-01'),
            },
          ],
        },
      });

      const result = await gateway.getTrusteeAppointments(context, 456);

      expect(result.cleanAppointments).toHaveLength(1);
      expect(result.cleanAppointments[0]).toMatchObject({
        appointmentType: 'elected',
        status: 'inactive',
        effectiveDate: '2020-03-01',
      });
    });

    test('should not override status when ARCHIVE_DATE is null for a case-by-case appointment (CAMS-772)', async () => {
      mockExecuteQuery.mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 789,
              DISTRICT: 'Middle',
              STATE: 'Louisiana',
              CHAPTER: '7',
              STATUS: 'C', // case-by-case — no archive date, stays active
              DATE_APPOINTED: new Date('2022-01-01'),
              EFFECTIVE_DATE: new Date('2022-01-01'),
              ARCHIVE_DATE: null,
            },
          ],
        },
      });

      const result = await gateway.getTrusteeAppointments(context, 789);

      expect(result.cleanAppointments).toHaveLength(1);
      expect(result.cleanAppointments[0]).toMatchObject({
        appointmentType: 'case-by-case',
        status: 'active',
      });
    });

    test('should handle overrides loading error gracefully', async () => {
      // Mock loadTrusteeOverrides to fail
      const loadOverridesMock = await import('./cleansing/ats-cleansing-overrides');
      vi.spyOn(loadOverridesMock, 'loadTrusteeOverrides').mockResolvedValueOnce({
        error: new CamsError('ATS-GATEWAY', { message: 'Failed to read override file' }),
      });

      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      // Create a fresh gateway to trigger override loading
      const freshGateway = new AtsGatewayImpl(context);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(freshGateway as any, 'executeQuery').mockResolvedValue({
        results: {
          recordset: [
            {
              TRU_ID: 123,
              DISTRICT: 'Middle',
              STATE: 'Louisiana',
              CHAPTER: '7',
              STATUS: 'PA',
              DATE_APPOINTED: new Date('2023-01-15'),
              EFFECTIVE_DATE: new Date('2023-01-15'),
            },
          ],
        },
      });

      await freshGateway.getTrusteeAppointments(context, 123);

      // Should log error but continue processing
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'ATS-GATEWAY',
        'Failed to load overrides, proceeding without overrides',
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });

    test('should load the overrides cache only once across multiple calls', async () => {
      const overridesModule = await import('./cleansing/ats-cleansing-overrides');
      const loadOverridesSpy = vi
        .spyOn(overridesModule, 'loadTrusteeOverrides')
        .mockResolvedValue({ data: new Map() });

      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      await gateway.getTrusteeAppointments(context, 1);
      await gateway.getTrusteeAppointments(context, 2);

      expect(loadOverridesSpy).toHaveBeenCalledTimes(1);
    });

    test('should proceed without overrides when loadTrusteeOverrides returns neither data nor error', async () => {
      const overridesModule = await import('./cleansing/ats-cleansing-overrides');
      vi.spyOn(overridesModule, 'loadTrusteeOverrides').mockResolvedValueOnce({});

      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      const loggerWarnSpy = vi.spyOn(context.logger, 'warn');

      await gateway.getTrusteeAppointments(context, 1);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'ATS-GATEWAY',
        'loadTrusteeOverrides returned no data and no error — proceeding without overrides',
      );
    });

    test('should increment the skipped stat for a SKIP classification', async () => {
      const pipelineModule = await import('./cleansing/ats-cleansing-pipeline');
      vi.spyOn(pipelineModule, 'cleanseAndMapAppointment').mockReturnValue({
        classification: CleansingClassification.SKIP,
        courtIds: [],
        mapType: 'OVERRIDE',
        notes: ['skipped per override'],
        skip: true,
      });
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [{ TRU_ID: 1 }] } });

      const result = await gateway.getTrusteeAppointments(context, 1);

      expect(result.stats.skipped).toBe(1);
      expect(result.cleanAppointments).toHaveLength(0);
    });

    test('should increment the uncleansable stat (not problematic) for an UNCLEANSABLE classification', async () => {
      const pipelineModule = await import('./cleansing/ats-cleansing-pipeline');
      vi.spyOn(pipelineModule, 'cleanseAndMapAppointment').mockReturnValue({
        classification: CleansingClassification.UNCLEANSABLE,
        courtIds: [],
        mapType: 'UNMAPPED',
        notes: ['missing geography'],
        skip: false,
      });
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [{ TRU_ID: 1 }] } });

      const result = await gateway.getTrusteeAppointments(context, 1);

      expect(result.stats.uncleansable).toBe(1);
      expect(result.stats.problematic).toBe(0);
      expect(result.failedAppointments).toHaveLength(1);
    });

    test('should increment the autoRecoverable stat and keep the appointment for an AUTO_RECOVERABLE classification', async () => {
      const pipelineModule = await import('./cleansing/ats-cleansing-pipeline');
      const appointment: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '053N',
        appointedDate: '2023-01-15',
        status: 'active',
        effectiveDate: '2023-01-15',
      };
      vi.spyOn(pipelineModule, 'cleanseAndMapAppointment').mockReturnValue({
        classification: CleansingClassification.AUTO_RECOVERABLE,
        appointment,
        courtIds: ['053N'],
        mapType: '1:1-inferred',
        notes: ['inferred from single-state district'],
        skip: false,
      });
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [{ TRU_ID: 1 }] } });

      const result = await gateway.getTrusteeAppointments(context, 1);

      expect(result.stats.autoRecoverable).toBe(1);
      expect(result.stats.clean).toBe(0);
      expect(result.cleanAppointments).toEqual([appointment]);
    });

    test('should expand into multiple appointments when cleansing yields several court IDs with no single appointment', async () => {
      const pipelineModule = await import('./cleansing/ats-cleansing-pipeline');
      const transformModule = await import('./cleansing/ats-cleansing-transform');
      vi.spyOn(pipelineModule, 'cleanseAndMapAppointment').mockReturnValue({
        classification: CleansingClassification.CLEAN,
        appointment: undefined,
        courtIds: ['053N', '053S'],
        mapType: '1:2',
        notes: ['multi-district expansion'],
        skip: false,
      });
      const transformSpy = vi
        .spyOn(transformModule, 'transformAppointmentRecord')
        .mockImplementation((_record, courtId) => ({
          chapter: '7',
          appointmentType: 'panel',
          courtId,
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        }));
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [{ TRU_ID: 1 }] } });
      const loggerDebugSpy = vi.spyOn(context.logger, 'debug');

      const result = await gateway.getTrusteeAppointments(context, 1);

      expect(transformSpy).toHaveBeenCalledTimes(2);
      expect(result.cleanAppointments.map((a) => a.courtId)).toEqual(['053N', '053S']);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        'ATS-GATEWAY',
        expect.stringContaining('Multi-expansion'),
        expect.any(Object),
      );
    });

    test('should add nothing when cleansing yields neither a single appointment nor multiple court IDs', async () => {
      const pipelineModule = await import('./cleansing/ats-cleansing-pipeline');
      vi.spyOn(pipelineModule, 'cleanseAndMapAppointment').mockReturnValue({
        classification: CleansingClassification.CLEAN,
        appointment: undefined,
        courtIds: [],
        mapType: 'UNMAPPED',
        notes: [],
        skip: false,
      });
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [{ TRU_ID: 1 }] } });

      const result = await gateway.getTrusteeAppointments(context, 1);

      expect(result.cleanAppointments).toHaveLength(0);
      expect(result.failedAppointments).toHaveLength(0);
    });

    test('should return zero when the trustee count query returns no rows', async () => {
      mockExecuteQuery.mockResolvedValue({ results: { recordset: [] } });

      const count = await gateway.getTrusteeCount(context);

      expect(count).toBe(0);
    });
  });
});
