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
    vi.restoreAllMocks();
    applicationContext = await createMockApplicationContext();
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

      // Exact-value check for a known division (Boston, District of Massachusetts) — the
      // truthy/membership checks above would pass even if toUstpOfficeDetails scrambled names
      // or mis-grouped divisions, as long as fields were non-empty.
      const bostonDivision = allDivisions.find((d) => d.divisionCode === '011');
      expect(bostonDivision).toEqual({
        divisionCode: '011',
        ustDivisionCode: undefined,
        court: { courtId: '0101', courtName: 'District of Massachusetts', state: 'MD' },
        courtOffice: { courtOfficeCode: '1', courtOfficeName: 'Boston' },
      });
      const bostonOffice = offices.find((office) =>
        office.groups.some((group) => group.divisions.includes(bostonDivision!)),
      );
      expect(bostonOffice?.regionId).toEqual('1');
      expect(bostonOffice?.regionName).toEqual('BOSTON');
    });

    test('groups divisions sharing an office under one office, splitting into separate groups by groupDesignator', async () => {
      // Explicit, hand-built fixture (not relying on COURT_DIVISIONS' incidental shape) so
      // coverage of toUstpOfficeDetails' "office already exists" / "group already exists" merge
      // branches doesn't silently disappear if the shared fixture's row shape ever changes.
      // All three rows share the same office key (regionId + courtDivisionCode).
      const rows = [
        {
          courtDivisionCode: '491',
          groupDesignator: 'CN',
          courtId: '0649',
          officeCode: '1',
          courtDivisionName: 'Chattanooga',
        },
        {
          // Same office key and groupDesignator as above — hits the "group already exists"
          // branch; division should be appended to the same group, not a new one.
          courtDivisionCode: '491',
          groupDesignator: 'CN',
          courtId: '0649',
          officeCode: '4',
          courtDivisionName: 'Winchester',
        },
        {
          // Same office key, different groupDesignator — hits the "office already exists but
          // group does not" branch; a new group should be added to the existing office.
          courtDivisionCode: '491',
          groupDesignator: 'XX',
          courtId: '0649',
          officeCode: '9',
          courtDivisionName: 'OtherGroupDivision',
        },
      ].map((row) => ({
        ...row,
        courtName: 'Eastern District of Tennessee',
        regionId: '08',
        regionName: 'ATLANTA',
        state: 'TN',
      }));
      const mockResults: QueryResults = {
        success: true,
        results: { recordset: rows },
        message: '',
      };
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue(mockResults);

      const gateway = new OfficesDxtrGateway(applicationContext);
      const offices = await gateway.getOffices(applicationContext);

      expect(offices).toHaveLength(1);
      expect(offices[0].groups).toHaveLength(2);

      const cnGroup = offices[0].groups.find((g) => g.groupDesignator === 'CN');
      expect(cnGroup?.divisions).toHaveLength(2);
      expect(cnGroup?.divisions.map((d) => d.courtOffice.courtOfficeName).sort()).toEqual([
        'Chattanooga',
        'Winchester',
      ]);

      const xxGroup = offices[0].groups.find((g) => g.groupDesignator === 'XX');
      expect(xxGroup?.divisions).toHaveLength(1);
      expect(xxGroup?.divisions[0].courtOffice.courtOfficeName).toEqual('OtherGroupDivision');
    });

    test('maps ustDivisionCode separately from courtDivisionCode for Eastern District of TN', async () => {
      // CS_DIV (bare) vs CS_DIV_ACMS diverges only for Winchester/Johnson City in court 0649.
      const easternTnRows = [
        { courtDivisionCode: '491', ustDivisionCode: '491', courtId: '0649', officeCode: '1' },
        { courtDivisionCode: '492', ustDivisionCode: '492', courtId: '0649', officeCode: '2' },
        { courtDivisionCode: '493', ustDivisionCode: '493', courtId: '0649', officeCode: '3' },
        { courtDivisionCode: '492', ustDivisionCode: '495', courtId: '0649', officeCode: '5' },
        { courtDivisionCode: '491', ustDivisionCode: '494', courtId: '0649', officeCode: '4' },
      ].map((row) => ({
        ...row,
        groupDesignator: 'TN',
        courtName: 'Eastern District of Tennessee',
        courtDivisionName: 'test',
        regionId: '4',
        regionName: 'ATLANTA',
        state: 'TN',
      }));
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: easternTnRows,
        },
        message: '',
      };
      vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue(mockResults);

      const gateway = new OfficesDxtrGateway(applicationContext);
      const offices = await gateway.getOffices(applicationContext);
      const allDivisions = offices.flatMap((office) =>
        office.groups.flatMap((group) => group.divisions),
      );

      easternTnRows.forEach((row) => {
        const match = allDivisions.find((d) => d.courtOffice.courtOfficeCode === row.officeCode);
        expect(match?.divisionCode).toEqual(row.courtDivisionCode);
        expect(match?.ustDivisionCode).toEqual(row.ustDivisionCode);
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
