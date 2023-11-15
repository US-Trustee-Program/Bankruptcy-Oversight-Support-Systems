import * as mssql from 'mssql';

import { CaseDocketInterface } from '../../../use-cases/cases.interface';
import { ApplicationContext } from '../../types/basic';
import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import log from '../../services/logger.service';
import { handleQueryResult } from '../gateway-helper';
import { decomposeCaseId } from './dxtr.gateway.helper';
import { CaseDocket } from '../../../use-cases/case-docket/case-docket.model';

const MODULENAME = 'CASE-DOCKET-DXTR-GATEWAY';

export default class CaseDocketDxtrGateway implements CaseDocketInterface {
  async getCaseDocket(applicationContext: ApplicationContext, caseId: string): Promise<CaseDocket> {
    const { courtDiv, dxtrCaseId } = decomposeCaseId(caseId);

    const input: DbTableFieldSpec[] = [];
    input.push({
      name: 'dxtrCaseId',
      type: mssql.VarChar,
      value: dxtrCaseId,
    });
    input.push({
      name: 'courtDiv',
      type: mssql.VarChar,
      value: courtDiv,
    });

    const query = `
    SELECT
      C.CS_DIV+'-'+C.CASE_ID as caseId,
      D.DE_DOCUMENT_NUM as documentNumber,
      D.DE_DATE_ENTER as dateEntered,
      D.DE_DATE_FILED as dateFiled,
      D.DE_TYPE as type,
      D.DO_SUMMARY_TEXT as summaryText,
      D.DT_TEXT as fullText
    FROM AO_DE AS D
    JOIN AO_CS AS C ON C.CS_CASEID=D.CS_CASEID AND C.COURT_ID=D.COURT_ID
    WHERE C.CS_DIV=@courtDiv AND C.CASE_ID=@dxtrCaseId
    ORDER BY DE_SEQNO
    `;

    const queryResult: QueryResults = await executeQuery(
      applicationContext,
      applicationContext.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<CaseDocket>(
        applicationContext,
        queryResult,
        MODULENAME,
        this.caseDocketQueryCallback,
      ),
    );
  }
  private caseDocketQueryCallback(
    applicationContext: ApplicationContext,
    queryResult: QueryResults,
  ) {
    log.debug(applicationContext, MODULENAME, `Results received from DXTR `, queryResult);

    return (queryResult.results as mssql.IResult<CaseDocket>).recordset;
  }
}
