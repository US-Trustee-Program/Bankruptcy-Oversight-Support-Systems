import { CourtDivisionDetails } from '../courts';
import { UstpDivision, UstpOfficeDetails } from '../offices';
import { COURT_DIVISIONS } from './courts.mock';

/**
 * A real U.S. Trustee field-office city for each region, from
 * https://www.justice.gov/ust/us-trustee-regions-and-offices (read 2026-11-09). Used only to name
 * the one generated catch-all office per region below; it stands in for "this region's divisions
 * not already covered by a LEGACY_MOCK_OFFICES entry," not a specific real office, so each pick
 * avoids the city a legacy entry for that region already uses (2: Manhattan, Buffalo; 3: Wilmington;
 * 18: Seattle).
 */
const REGION_OFFICE_CITY: Record<string, string> = {
  '1': 'Boston',
  '2': 'Albany',
  '3': 'Philadelphia',
  '4': 'Alexandria',
  '5': 'New Orleans',
  '6': 'Dallas',
  '7': 'Houston',
  '8': 'Memphis',
  '9': 'Cleveland',
  '10': 'Indianapolis',
  '11': 'Chicago',
  '12': 'Des Moines',
  '13': 'Kansas City',
  '14': 'Phoenix',
  '15': 'San Diego',
  '16': 'Los Angeles',
  '17': 'San Francisco',
  '18': 'Spokane',
  '19': 'Denver',
  '20': 'Wichita',
  '21': 'Atlanta',
};

/**
 * Generate UstpOfficeDetails from CourtDivisionDetails, grouped by region and
 * group designator. Produces one office per region with groups for each court.
 */
function buildMockOfficesFromCourtDivisions(
  courtDivisions: CourtDivisionDetails[],
): UstpOfficeDetails[] {
  const regionMap = new Map<
    string,
    {
      regionId: string;
      regionName: string;
      groups: Map<string, { groupDesignator: string; divisions: UstpDivision[] }>;
    }
  >();

  for (const div of courtDivisions) {
    if (!regionMap.has(div.regionId)) {
      regionMap.set(div.regionId, {
        regionId: div.regionId,
        regionName: div.regionName,
        groups: new Map(),
      });
    }
    const region = regionMap.get(div.regionId)!;

    if (!region.groups.has(div.groupDesignator)) {
      region.groups.set(div.groupDesignator, {
        groupDesignator: div.groupDesignator,
        divisions: [],
      });
    }
    region.groups.get(div.groupDesignator)!.divisions.push({
      divisionCode: div.courtDivisionCode,
      court: { courtId: div.courtId, courtName: div.courtName, state: div.state },
      courtOffice: { courtOfficeCode: div.officeCode, courtOfficeName: div.officeName },
    });
  }

  return Array.from(regionMap.values()).map((region) => ({
    officeCode: `USTP_CAMS_Region_${region.regionId}_Office_Generated`,
    idpGroupName: `USTP CAMS Region ${region.regionId} Office Generated`,
    officeName: REGION_OFFICE_CITY[region.regionId] ?? `Region ${region.regionId}`,
    groups: Array.from(region.groups.values()),
    regionId: region.regionId,
    regionName: region.regionName,
  }));
}

/**
 * Legacy manually-defined offices preserved at indices 0-3 for backward
 * compatibility with existing tests that use index-based lookups.
 */
const LEGACY_MOCK_OFFICES: UstpOfficeDetails[] = [
  {
    officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
    idpGroupName: 'USTP CAMS Region 18 Office Seattle',
    officeName: 'Seattle',
    groups: [
      {
        groupDesignator: 'SE',
        divisions: [
          {
            divisionCode: '812',
            court: { courtId: '0981', courtName: 'Western District of Washington', state: 'WA' },
            courtOffice: { courtOfficeCode: '2', courtOfficeName: 'Seattle' },
          },
          {
            divisionCode: '813',
            court: { courtId: '0981', courtName: 'Western District of Washington', state: 'WA' },
            courtOffice: { courtOfficeCode: '3', courtOfficeName: 'Tacoma' },
          },
        ],
      },
      {
        groupDesignator: 'AK',
        divisions: [
          {
            divisionCode: '710',
            court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
            courtOffice: { courtOfficeCode: '1', courtOfficeName: 'Juneau' },
          },
          {
            divisionCode: '720',
            court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
            courtOffice: { courtOfficeCode: '2', courtOfficeName: 'Nome' },
          },
          {
            divisionCode: '730',
            court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
            courtOffice: { courtOfficeCode: '3', courtOfficeName: 'Anchorage' },
          },
          {
            divisionCode: '740',
            court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
            courtOffice: { courtOfficeCode: '4', courtOfficeName: 'Fairbanks' },
          },
          {
            divisionCode: '750',
            court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
            courtOffice: { courtOfficeCode: '5', courtOfficeName: 'Ketchikan' },
          },
        ],
      },
    ],
    regionId: '18',
    regionName: 'SEATTLE',
  },
  {
    officeCode: 'USTP_CAMS_Region_3_Office_Wilmington',
    idpGroupName: 'USTP CAMS Region 3 Office Wilmington',
    officeName: 'Wilmington',
    groups: [
      {
        groupDesignator: 'WL',
        divisions: [
          {
            divisionCode: '111',
            court: { courtId: '0311', courtName: 'District of Delaware', state: 'DE' },
            courtOffice: { courtOfficeCode: '1', courtOfficeName: 'Delaware' },
          },
        ],
      },
    ],
    regionId: '3',
    regionName: 'PHILADELPHIA',
  },
  {
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    idpGroupName: 'USTP CAMS Region 2 Office Manhattan',
    officeName: 'Manhattan',
    groups: [
      {
        groupDesignator: 'NY',
        divisions: [
          {
            divisionCode: '081',
            court: { courtId: '0208', courtName: 'Southern District of New York', state: 'NY' },
            courtOffice: { courtOfficeCode: '1', courtOfficeName: 'Manhattan' },
          },
          {
            divisionCode: '087',
            court: { courtId: '0208', courtName: 'Southern District of New York', state: 'NY' },
            courtOffice: { courtOfficeCode: '7', courtOfficeName: 'White Plains' },
          },
        ],
      },
    ],
    regionId: '2',
    regionName: 'NEW YORK',
  },
  {
    officeCode: 'USTP_CAMS_Region_2_Office_Buffalo',
    idpGroupName: 'USTP CAMS Region 2 Office Buffalo',
    officeName: 'Buffalo',
    groups: [
      {
        groupDesignator: 'BU',
        divisions: [
          {
            divisionCode: '091',
            court: { courtId: '0209', courtName: 'Western District of New York', state: 'NY' },
            courtOffice: { courtOfficeCode: '1', courtOfficeName: 'Buffalo' },
          },
        ],
      },
    ],
    regionId: '2',
    regionName: 'NEW YORK',
  },
];

// Collect division codes already present in legacy offices to avoid duplicates.
const excludedDivisionCodes = new Set<string>();
LEGACY_MOCK_OFFICES.forEach((office) => {
  office.groups.forEach((group) => {
    group.divisions.forEach((div) => {
      excludedDivisionCodes.add(div.divisionCode);
    });
  });
});

// Filter COURT_DIVISIONS to exclude legacy codes and internal duplicates.
const uniqueCourtDivisions = COURT_DIVISIONS.filter((cd) => {
  if (excludedDivisionCodes.has(cd.courtDivisionCode)) return false;
  excludedDivisionCodes.add(cd.courtDivisionCode);
  return true;
});

// Combine legacy offices (indices 0-3) with generated offices covering remaining courts.
export const MOCKED_USTP_OFFICES_ARRAY: UstpOfficeDetails[] = [
  ...LEGACY_MOCK_OFFICES,
  ...buildMockOfficesFromCourtDivisions(uniqueCourtDivisions),
];

export const MOCKED_USTP_OFFICE_DATA_MAP = new Map<string, UstpOfficeDetails>(
  MOCKED_USTP_OFFICES_ARRAY.map((office) => [office.officeCode, office]),
);
