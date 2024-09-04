import * as mssql from 'mssql';
import { CamsError } from '../../../common-errors/cams-error';
import { ApplicationContext } from '../../types/basic';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { executeQuery } from '../../utils/database';
import { OfficesGatewayInterface } from '../../../use-cases/offices/offices.gateway.interface';
import { USTP_OFFICE_NAME_MAP } from './dxtr.constants';
import { OfficeDetails } from '../../../../../../common/src/cams/courts';

const MODULE_NAME = 'OFFICES-GATEWAY';

export default class OfficesDxtrGateway implements OfficesGatewayInterface {
  getOfficeName(id: string): string {
    if (USTP_OFFICE_NAME_MAP.has(id)) return USTP_OFFICE_NAME_MAP.get(id);
    throw new CamsError(MODULE_NAME, {
      message: 'Cannot find office by ID',
      data: { id },
    });
  }

  async getOffices(context: ApplicationContext): Promise<OfficeDetails[]> {
    const input: DbTableFieldSpec[] = [];

    const query = `
    SELECT a.[CS_DIV] AS courtDivisionCode
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

  async getOfficesByGroupDesignator(
    context: ApplicationContext,
    groupDesignator: string,
  ): Promise<OfficeDetails[]> {
    const input: DbTableFieldSpec[] = [];

    if (groupDesignator.length !== 2) {
      throw new CamsError(MODULE_NAME, {
        message: 'Invalid group designator supplied',
      });
    }

    input.push({
      name: 'groupDesignator',
      type: mssql.VarChar,
      value: groupDesignator,
    });

    const query = `
    SELECT a.[CS_DIV] AS courtDivisionCode
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
    WHERE
      a.[GRP_DES] = @groupDesignator
    ORDER BY a.OFFICE_CODE`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    if (queryResult.success) {
      const results = queryResult.results as mssql.IResult<OfficeDetails>;
      if (results.recordset.length === 0) {
        throw new CamsError(MODULE_NAME, {
          message: 'Office not found by query designator.',
        });
      }
      return results.recordset;
    } else {
      throw new CamsError(MODULE_NAME, { message: queryResult.message });
    }
  }
}
