import { OfficeDetails } from '../../../common/src/cams/courts';
import { OFFICES } from '../../../common/src/cams/test-utilities/offices.mock';
import { Court } from '../domain/court';

export const courts: Array<Court> = [
  {
    county: 'NEW YORK-NY',
    div: '081',
    group: {
      id: 'NY',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    id: '0208',
  },
  {
    county: 'WHITE PLAINS',
    div: '087',
    group: {
      id: 'NY',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    id: '0208',
  },
  {
    county: 'BUFFALO',
    div: '091',
    group: {
      id: 'BU',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    id: '0209',
  },
  {
    county: 'BUFFALO',
    div: '091',
    group: {
      id: 'BU',
      region: {
        id: '02',
        name: 'NEW YORK',
      },
    },
    id: '0209',
  },
  {
    county: 'WILMINGTON',
    div: '111',
    group: {
      id: 'WL',
      region: {
        id: '03',
        name: 'PHILADELPHIA',
      },
    },
    id: '0311',
  },
];

function generateCourtsFromCommon(offices: Array<OfficeDetails>): Array<Court> {
  return offices.map((office) => {
    return {
      county: office.courtDivisionName,
      div: office.courtDivisionCode,
      group: {
        id: office.groupDesignator,
        region: {
          id: office.regionId,
          name: office.regionName,
        },
      },
      id: office.courtId,
    };
  });
}

export const courtsAll = generateCourtsFromCommon(OFFICES);
