import * as mssql from 'mssql';

import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { handleQueryResult2 } from '../gateway-helper';
import { decomposeCaseId } from './dxtr.gateway.helper';
import { CaseDocket } from '../../../use-cases/case-docket/case-docket.model';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../gateways.types';

const MODULENAME = 'CASE-DOCKET-DXTR-GATEWAY';

export class DxtrCaseDocketGateway implements CaseDocketGateway {
  async getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket> {
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
      D.DE_SEQNO as sequenceNumber,
      D.DE_DOCUMENT_NUM as documentNumber,
      D.DE_DATE_FILED as dateFiled,
      D.DO_SUMMARY_TEXT as summaryText,
      D.DT_TEXT as fullText
    FROM AO_DE AS D
    JOIN AO_CS AS C ON C.CS_CASEID=D.CS_CASEID AND C.COURT_ID=D.COURT_ID
    WHERE C.CS_DIV=@courtDiv AND C.CASE_ID=@dxtrCaseId
    ORDER BY DE_SEQNO
    `;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    context.logger.debug(MODULENAME, `Results received from DXTR `, queryResult);
    return handleQueryResult2<CaseDocket>(MODULENAME, queryResult);
  }
}
