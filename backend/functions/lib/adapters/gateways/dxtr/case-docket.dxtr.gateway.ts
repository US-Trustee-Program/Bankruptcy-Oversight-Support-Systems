import * as mssql from 'mssql';

import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { decomposeCaseId } from './dxtr.gateway.helper';
import {
  CaseDocket,
  CaseDocketEntryDocument,
} from '../../../use-cases/case-docket/case-docket.model';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../gateways.types';
import { CamsError } from '../../../common-errors/cams-error';
import { NotFoundError } from '../../../common-errors/not-found-error';

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
      FORMAT(D.DE_DATE_FILED, 'MM-dd-yyyy') as dateFiled,
      ISNULL(D.DO_SUMMARY_TEXT, 'SUMMARY NOT AVAILABLE') as summaryText,
      ISNULL(D.DT_TEXT, 'TEXT NOT AVAILABLE') as fullText
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

    if (queryResult.success) {
      const recordset = (queryResult.results as mssql.IResult<CaseDocket>).recordset;
      if (!recordset.length) throw new NotFoundError(MODULENAME, { data: { caseId } });
      return recordset;
    } else {
      throw new CamsError(MODULENAME, { message: queryResult.message, data: { caseId } });
    }
  }

  async getCaseDocketDocuments(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseDocketEntryDocument[]> {
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
          DE.DE_SEQNO AS sequenceNumber,
          concat(PDF.PDF_WEB_PATH_LT, '/', DC.FILE_NAME) AS fileUri,
          DC.PDF_SIZE as pdfSize
      FROM AO_CS AS C
          JOIN AO_DE AS DE
            ON C.CS_CASEID = DE.CS_CASEID AND C.COURT_ID = DE.COURT_ID
          JOIN AO_DC AS DC ON C.CS_CASEID = DC.CS_CASEID AND C.COURT_ID = DC.COURT_ID AND DE.DE_SEQNO = DC.DE_SEQNO
          JOIN AO_CS_DIV DIV ON C.CS_DIV = DIV.CS_DIV
          JOIN AO_PDF_PATH AS PDF ON DIV.PDF_PATH_ID = PDF.PDF_PATH_ID
      WHERE C.CS_DIV=@courtDiv AND C.CASE_ID=@dxtrCaseId
    `;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    if (queryResult.success) {
      const recordset = (queryResult.results as mssql.IResult<CaseDocketEntryDocument>).recordset;
      if (!recordset.length) throw new NotFoundError(MODULENAME, { data: { caseId } });
      return recordset;
    } else {
      throw new CamsError(MODULENAME, { message: queryResult.message, data: { caseId } });
    }
  }
}
