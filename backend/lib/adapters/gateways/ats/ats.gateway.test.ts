import { vi } from 'vitest';
import { AtsGatewayImpl } from './ats.gateway';
import { MockAtsGateway } from './ats.mock.gateway';
import {
  createMockApplicationContext,
  generateTestCredential,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';

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

    test('should return trustee appointments', async () => {
      const result = await gateway.getTrusteeAppointments(context, 1);
      expect(result.cleanAppointments.length).toBeGreaterThan(0);

      // MockAtsGateway returns raw ATS records cast as TrusteeAppointmentInput[] for simplicity
      // Note: In mock, these are AtsAppointmentRecords, not fully cleansed CAMS types
      expect(result.cleanAppointments.length).toBe(2); // Trustee 1 has 2 appointments in mock data
      expect(result.stats.total).toBe(2);
      expect(result.stats.clean).toBe(2);
    });

    test('should return correct trustee count', async () => {
      const count = await gateway.getTrusteeCount(context);
      expect(count).toBe(5);
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

    afterEach(() => {
      vi.clearAllMocks();
    });

    test('should build correct query for first page of trustees', async () => {
      mockExecuteQuery.mockResolvedValue({ results: [] });

      await gateway.getTrusteesPage(context, null, 50);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('FROM TRUSTEES'),
        expect.arrayContaining([expect.objectContaining({ name: 'pageSize', value: 50 })]),
      );

      // Should not include WHERE clause for first page
      const query = mockExecuteQuery.mock.calls[0][1];
      expect(query).not.toContain('WHERE ID >');
    });

    test('should build correct query for subsequent pages of trustees', async () => {
      mockExecuteQuery.mockResolvedValue({ results: [] });

      await gateway.getTrusteesPage(context, 100, 50);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('WHERE ID > @lastId'),
        expect.arrayContaining([
          expect.objectContaining({ name: 'pageSize', value: 50 }),
          expect.objectContaining({ name: 'lastId', value: 100 }),
        ]),
      );
    });

    test('should handle query errors gracefully', async () => {
      const testError = new Error('Database connection failed');
      mockExecuteQuery.mockRejectedValue(testError);

      // Spy on logger.error
      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      await expect(gateway.getTrusteesPage(context, null, 50)).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    test('should query appointments for a specific trustee and return clean CAMS types', async () => {
      // Gateway queries raw ATS data
      mockExecuteQuery.mockResolvedValue({
        results: [
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
        results: [{ totalCount: 1234 }],
      });

      const count = await gateway.getTrusteeCount(context);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('COUNT(*) as totalCount FROM TRUSTEES'),
      );

      expect(count).toBe(1234);
    });

    test('should test database connection', async () => {
      mockExecuteQuery.mockResolvedValue({ results: [{ test: 1 }] });

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
        results: [
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
      });

      const result = await gateway.getTrusteeAppointments(context, 17120);

      // Should return empty cleanAppointments array (skipped)
      expect(result.cleanAppointments).toHaveLength(0);
    });

    test('should filter out UNCLEANSABLE appointments', async () => {
      // Return an appointment with unmappable data
      mockExecuteQuery.mockResolvedValue({
        results: [
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
        results: [
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
      });

      const loggerDebugSpy = vi.spyOn(context.logger, 'debug');

      const result = await gateway.getTrusteeAppointments(context, 456);

      // Should create appointments (may be single or expanded based on cleansing logic)
      expect(result.cleanAppointments.length).toBeGreaterThanOrEqual(1);
      expect(result.cleanAppointments.every((apt) => apt.status === 'active')).toBe(true);

      // Verify debug logging occurred during cleansing
      expect(loggerDebugSpy).toHaveBeenCalled();
    });

    test('should handle overrides loading error gracefully', async () => {
      // Mock loadTrusteeOverrides to fail
      const loadOverridesMock = await import('./cleansing/ats-cleansing-overrides');
      vi.spyOn(loadOverridesMock, 'loadTrusteeOverrides').mockResolvedValueOnce({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: new Error('Failed to read override file') as any,
      });

      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      // Create a fresh gateway to trigger override loading
      const freshGateway = new AtsGatewayImpl(context);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(freshGateway as any, 'executeQuery').mockResolvedValue({
        results: [
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
  });
});
