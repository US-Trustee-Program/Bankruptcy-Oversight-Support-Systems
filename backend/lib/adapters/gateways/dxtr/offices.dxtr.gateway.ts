import * as mssql from 'mssql';

import { UstpDivision, UstpGroup, UstpOfficeDetails } from '../../../../../common/src/cams/offices';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { CamsError } from '../../../common-errors/cams-error';
import { buildOfficeCode, getOfficeName } from '../../../use-cases/offices/offices';
import { OfficesGateway } from '../../../use-cases/offices/offices.types';
import { ApplicationContext } from '../../types/basic';
import { QueryResults } from '../../types/database';
import { executeQuery } from '../../utils/database';

const MODULE_NAME = 'OFFICES-GATEWAY';

// Remove invalid divisions at the gateway rather than forcing the
// more important use case code to include logic to remove them.
const INVALID_DIVISION_CODES = [
  '070',
  '314',
  '990',
  '991',
  '992',
  '993',
  '994',
  '995',
  '996',
  '999',
];
const INVALID_DIVISION_CODES_SQL = INVALID_DIVISION_CODES.map((code) => "'" + code + "'").join(',');

type DxtrFlatOfficeDetails = {
  courtDivisionCode: string;
  courtDivisionName: string;
  courtId: string;
  courtName: string;
  groupDesignator: string;
  officeCode: string;
  officeName: string;
  regionId: string;
  regionName: string;
  staff?: CamsUserReference[];
  state?: string;
};

export default class OfficesDxtrGateway implements OfficesGateway {
  getOfficeName(id: string): string {
    return getOfficeName(id);
  }

  async getOffices(context: ApplicationContext): Promise<UstpOfficeDetails[]> {
    const query = `
    SELECT a.[CS_DIV_ACMS] AS courtDivisionCode
      ,a.[GRP_DES] AS groupDesignator
      ,a.[COURT_ID] AS courtId
      ,a.[OFFICE_CODE] AS officeCode
      ,a.[STATE] AS state
      ,c.COURT_NAME AS courtName
      ,b.OFFICE_NAME_DISPLAY AS courtDivisionName
      ,d.REGION_ID AS regionId
      ,r.REGION_NAME AS regionName
    FROM [dbo].[AO_CS_DIV] a
    JOIN [dbo].[AO_OFFICE] b on a.COURT_ID = b.COURT_ID and a.OFFICE_CODE = b.OFFICE_CODE
    JOIN [dbo].[AO_COURT] c on a.COURT_ID = c.COURT_ID
    JOIN [dbo].[AO_GRP_DES] d on a.GRP_DES = d.GRP_DES
    JOIN [dbo].[AO_REGION] r on d.REGION_ID = r.REGION_ID
    WHERE a.[CS_DIV_ACMS] not in (${INVALID_DIVISION_CODES_SQL})
    ORDER BY a.STATE, c.COURT_NAME, b.OFFICE_NAME_DISPLAY`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
    );

    if (queryResult.success) {
      const flatOfficeDetails = (queryResult.results as mssql.IResult<DxtrFlatOfficeDetails>)
        .recordset;
      return toUstpOfficeDetails(flatOfficeDetails);
    } else {
      throw new CamsError(MODULE_NAME, { message: queryResult.message });
    }
  }
}

// TODO: Maybe we need to add configuration options here for the Seattle => SE+AK mapping edge case.
function toUstpOfficeDetails(flatOfficeDetails: DxtrFlatOfficeDetails[]): UstpOfficeDetails[] {
  const ustpOfficeDetailsMap = new Map<string, UstpOfficeDetails>();
  flatOfficeDetails.forEach((flatOffice) => {
    let current: UstpOfficeDetails;
    const ustpOfficeCode = buildOfficeCode(flatOffice.regionId, flatOffice.courtDivisionCode);
    if (ustpOfficeDetailsMap.has(ustpOfficeCode)) {
      current = ustpOfficeDetailsMap.get(ustpOfficeCode);
    } else {
      current = {
        groups: [],
        idpGroupName: ustpOfficeCode.replace(/_/g, ' '),
        officeCode: ustpOfficeCode,
        officeName: getOfficeName(flatOffice.courtDivisionCode),
        regionId: parseInt(flatOffice.regionId).toString(),
        regionName: flatOffice.regionName,
      };
      ustpOfficeDetailsMap.set(ustpOfficeCode, current);
    }

    let group: undefined | UstpGroup = current.groups.find(
      (g) => g.groupDesignator === flatOffice.groupDesignator,
    );
    if (!group) {
      group = {
        divisions: [],
        groupDesignator: flatOffice.groupDesignator,
      };
      current.groups.push(group);
    }

    const division: UstpDivision = {
      court: {
        courtId: flatOffice.courtId,
        courtName: flatOffice.courtName,
        state: flatOffice.state,
      },
      courtOffice: {
        courtOfficeCode: flatOffice.officeCode,
        courtOfficeName: flatOffice.courtDivisionName,
      },
      divisionCode: flatOffice.courtDivisionCode,
    };
    group.divisions.push(division);
  });

  return [...ustpOfficeDetailsMap.values()];
}
