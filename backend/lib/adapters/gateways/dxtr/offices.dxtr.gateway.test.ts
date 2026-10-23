import { vi } from 'vitest';
import OfficesDxtrGateway from './offices.dxtr.gateway';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { QueryResults } from '../../types/database';
import { COURT_DIVISIONS } from '@common/cams/test-utilities/courts.mock';
import { AbstractMssqlClient } from '../abstract-mssql-client';

describe('offices gateway tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOffice tests', () => {
    test('should return the name of a known office by ID', async () => {
      const gateway = new OfficesDxtrGateway(applicationContext);
      const office = gateway.getOfficeName('011');
      expect(office).toEqual('Boston');
    });

    test('should return a placeholder name for an invalid ID', async () => {
      const gateway = new OfficesDxtrGateway(applicationContext);
      expect(gateway.getOfficeName('AAA')).toEqual('UNKNOWN_AAA');
    });
  });

  describe('getOffices test', () => {
    test('Should get Offices', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: COURT_DIVISIONS,
        },
        message: '',
      };
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue(mockResults);

      const gateway = new OfficesDxtrGateway(applicationContext);
      const offices = await gateway.getOffices(applicationContext);

      const allDivisions = offices.flatMap((office) =>
        office.groups.flatMap((group) => group.divisions),
      );

      COURT_DIVISIONS.forEach((cd) => {
        const match = allDivisions.find(
          (d) => d.divisionCode === cd.courtDivisionCode && d.court.courtId === cd.courtId,
        );
        expect(match).toBeDefined();
      });

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
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue(mockResults);

      const gateway = new OfficesDxtrGateway(applicationContext);

      await expect(gateway.getOffices(applicationContext)).rejects.toThrow(
        'Some expected SQL error.',
      );
    });
  });
});
