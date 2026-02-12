import { vi } from 'vitest';
import { AtsGatewayImpl } from './ats.gateway';
import { MockAtsGateway } from './ats.mock.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
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
      const appointments = await gateway.getTrusteeAppointments(context, 1);
      expect(appointments.length).toBeGreaterThan(0);
      expect(appointments[0].ID).toBe(1);

      // Check for special case-by-case appointment for trustee 1
      const cbcAppointment = appointments.find((a) => a.CHAPTER === '12CBC');
      expect(cbcAppointment).toBeDefined();
      expect(cbcAppointment?.STATUS).toBe('C');
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
        password: (Math.random() + 1).toString(36).substring(2),
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

    test('should query appointments for a specific trustee', async () => {
      mockExecuteQuery.mockResolvedValue({
        results: [
          {
            ID: 123,
            DISTRICT: '02',
            DIVISION: '081',
            CHAPTER: '7',
            STATUS: 'PA',
          },
        ],
      });

      const appointments = await gateway.getTrusteeAppointments(context, 123);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('FROM CHAPTER_DETAILS'),
        expect.arrayContaining([expect.objectContaining({ name: 'trusteeId', value: 123 })]),
      );

      expect(appointments).toHaveLength(1);
      expect(appointments[0].ID).toBe(123);
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
  });
});
