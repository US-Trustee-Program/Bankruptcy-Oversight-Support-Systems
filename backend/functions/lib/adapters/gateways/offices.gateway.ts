import * as mssql from 'mssql';
import { CamsError } from '../../common-errors/cams-error';
import { ApplicationContext } from '../types/basic';
import { DbTableFieldSpec, QueryResults } from '../types/database';
import { executeQuery } from '../utils/database';
import { OfficeDetails } from '../../use-cases/offices/offices.model';
import { OfficesGatewayInterface } from '../../use-cases/offices/offices.gateway.interface';
import { USTP_OFFICE_NAME_MAP } from './dxtr/dxtr.constants';

const MODULE_NAME = 'OFFICES-GATEWAY';

export default class OfficesDxtrGateway implements OfficesGatewayInterface {
  getOffice(id: string): string {
    if (USTP_OFFICE_NAME_MAP.has(id)) return USTP_OFFICE_NAME_MAP.get(id);
    throw new CamsError(MODULE_NAME, {
      message: 'Cannot find office by ID',
      data: { id },
    });
  }

  async getOffices(context: ApplicationContext): Promise<OfficeDetails[]> {
    const input: DbTableFieldSpec[] = [];

    const query = `
    SELECT TOP (1000) a.[CS_DIV] AS divisionCode
      ,a.[GRP_DES] AS groupDesignator
      ,a.[COURT_ID] AS courtId
      ,a.[OFFICE_CODE] AS officeCode
      ,a.[STATE] AS state
      ,c.COURT_NAME AS courtName
      ,b.OFFICE_NAME AS courtDivisionName
      ,d.REGION_ID as region
    FROM [dbo].[AO_CS_DIV] a
    JOIN [dbo].[AO_OFFICE] b on a.COURT_ID = b.COURT_ID and a.OFFICE_CODE = b.OFFICE_CODE
    JOIN [dbo].[AO_COURT] c on a.COURT_ID = c.COURT_ID
    JOIN [dbo].[AO_GRP_DES] d on a.GRP_DES = d.GRP_DES
    WHERE 1 = 1
      AND a.GRP_DES in ('AL', 'BR', 'BU', 'LI', 'NH', 'NY', 'RO', 'UT')
    ORDER BY a.GRP_DES, a.OFFICE_CODE`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    if (queryResult.success) {
      return (queryResult.results as mssql.IResult<OfficeDetails>).recordset;
    } else {
      throw new CamsError(MODULE_NAME, { message: queryResult.message });
    }
  }
}
