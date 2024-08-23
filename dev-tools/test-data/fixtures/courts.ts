import { Court } from '../domain/court';
import { OfficeDetails } from '../../../common/src/cams/courts';
import { OFFICES } from '../../../common/src/cams/test-utilities/offices.mock';

export const courts: Array<Court> = [
  {
    county: 'NEW YORK-NY',
    id: '0208',
    group: {
      id: 'NY',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    div: '081',
  },
  {
    county: 'WHITE PLAINS',
    id: '0208',
    group: {
      id: 'NY',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    div: '087',
  },
  {
    county: 'BUFFALO',
    id: '0209',
    group: {
      id: 'BU',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    div: '091',
  },
  {
    county: 'BUFFALO',
    id: '0209',
    group: {
      id: 'BU',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    div: '091',
  },
  {
    county: 'WILMINGTON',
    id: '0311',
    group: {
      id: 'WL',
      region: {
        id: '03',
        name: 'PHILADELPHIA',
      },
    },
    div: '111',
  },
];

function generateCourtsFromCommon(offices: Array<OfficeDetails>): Array<Court> {
  return offices.map((office) => {
    return {
      county: office.courtDivisionName,
      id: office.courtId,
      group: {
        id: office.groupDesignator,
        region: {
          id: office.regionId,
          name: office.regionName,
        },
      },
      div: office.courtDivisionCode,
    };
  });
}

export const courtsAll = generateCourtsFromCommon(OFFICES);
