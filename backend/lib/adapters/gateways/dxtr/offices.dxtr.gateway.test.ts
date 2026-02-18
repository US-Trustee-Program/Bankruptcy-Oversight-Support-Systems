import { vi } from 'vitest';
import OfficesDxtrGateway from './offices.dxtr.gateway';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import * as database from '../../utils/database';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../../types/database';
import { COURT_DIVISIONS } from '@common/cams/test-utilities/courts.mock';

describe('offices gateway tests', () => {
  describe('getOffice tests', () => {
    test('should return the name of a known office by ID', () => {
      const gateway = new OfficesDxtrGateway();
      const office = gateway.getOfficeName('011');
      expect(office).toEqual('Boston');
    });

    test('should return a placeholder name for an invalid ID', () => {
      const gateway = new OfficesDxtrGateway();
      expect(gateway.getOfficeName('AAA')).toEqual('UNKNOWN_AAA');
    });
  });

  describe('getOffices test', () => {
    let applicationContext: ApplicationContext;
    let querySpy: vi.SpyInstance<
      Promise<QueryResults>,
      [
        applicationContext: ApplicationContext<unknown>,
        databaseConfig: IDbConfig,
        query: string,
        input?: DbTableFieldSpec[],
      ],
      unknown
    >;

    beforeEach(async () => {
      querySpy = vi.spyOn(database, 'executeQuery');
      applicationContext = await createMockApplicationContext();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.resetModules();
    });

    test('Should get Offices', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: COURT_DIVISIONS,
        },
        message: '',
      };
      querySpy.mockResolvedValue(mockResults);

      const gateway = new OfficesDxtrGateway();
      const offices = await gateway.getOffices(applicationContext);

      // Flatten all divisions from the gateway output
      const allDivisions = offices.flatMap((office) =>
        office.groups.flatMap((group) => group.divisions),
      );

      // Every court division from COURT_DIVISIONS should appear in the output
      COURT_DIVISIONS.forEach((cd) => {
        const match = allDivisions.find(
          (d) => d.divisionCode === cd.courtDivisionCode && d.court.courtId === cd.courtId,
        );
        expect(match).toBeDefined();
      });

      // Every office should have valid structure
      offices.forEach((office) => {
        expect(office.officeCode).toBeTruthy();
        expect(office.officeName).toBeTruthy();
        expect(office.regionId).toBeTruthy();
        expect(office.groups.length).toBeGreaterThan(0);
      });
    });

    test('should throw error when success is false calling getOffices', async () => {
      const mockResults: QueryResults = {
        success: false,
        results: {},
        message: 'Some expected SQL error.',
      };
      querySpy.mockResolvedValue(mockResults);

      const gateway = new OfficesDxtrGateway();

      await expect(gateway.getOffices(applicationContext)).rejects.toThrow(
        'Some expected SQL error.',
      );
    });
  });
});
