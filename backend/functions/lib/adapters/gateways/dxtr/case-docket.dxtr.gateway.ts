import * as mssql from 'mssql';

import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { decomposeCaseId } from './dxtr.gateway.helper';
import {
  CaseDocket,
  CaseDocketEntryDocument,
} from '../../../use-cases/case-docket/case-docket.model';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';
import { NotFoundError } from '../../../common-errors/not-found-error';

const MODULENAME = 'CASE-DOCKET-DXTR-GATEWAY';

export type DxtrCaseDocketEntryDocument = {
  sequenceNumber: number;
  fileSize: number;
  fileName: string;
  uriStem: string;
  parts?: string[];
};

export function translateModel(files: DxtrCaseDocketEntryDocument[]): CaseDocketEntryDocument[] {
  const doSingleNaming = files.length === 1;

  return files.map<CaseDocketEntryDocument>((file) => {
    const { uriStem, fileName, fileSize } = file;
    const fileUri = uriStem + '/' + fileName;
    try {
      const fileNameParts = fileName.split('.');
      const allLabelParts = fileNameParts[0].split('-');
      if (allLabelParts.length < 4) {
        throw new Error('Unexpected filename format');
      }
      const labelParts = allLabelParts.slice(3);
      const fileExt = fileNameParts[1];
      const fileLabel = doSingleNaming ? labelParts[0] : labelParts.join('-');

      return {
        fileUri,
        fileSize,
        fileLabel,
        fileExt,
      };
    } catch {
      return {
        fileUri,
        fileSize,
        fileLabel: fileName,
      };
    }
  });
}

export function documentSorter(a: DxtrCaseDocketEntryDocument, b: DxtrCaseDocketEntryDocument) {
  try {
    const aEnumerator = parseInt(a.parts[a.parts.length - 2]);
    const bEnumerator = parseInt(b.parts[b.parts.length - 2]);
    if (isNaN(aEnumerator) || isNaN(bEnumerator))
      throw new Error('Filename did not match expectations.');
    return aEnumerator > bEnumerator ? 1 : -1;
  } catch {
    return a.fileName > b.fileName ? 1 : -1;
  }
}

export class DxtrCaseDocketGateway implements CaseDocketGateway {
  async getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket> {
    const documents = await this._getCaseDocketDocuments(context, caseId);
    const dxtrDocumentMap = new Map<number, DxtrCaseDocketEntryDocument[]>();
    documents.forEach((d) => {
      const key = d.sequenceNumber;
      const list = dxtrDocumentMap.has(key) ? dxtrDocumentMap.get(key) : [];
      list.push(d);
      dxtrDocumentMap.set(key, list);
      d.parts = d.fileName.split(/-|\./);
    });

    const docket = await this._getCaseDocket(context, caseId);
    docket.forEach((d) => {
      const key = d.sequenceNumber;
      if (dxtrDocumentMap.has(key)) {
        const docs = dxtrDocumentMap.get(key);
        docs.sort(documentSorter);
        d.documents = translateModel(docs);
      }
    });
    return docket;
  }

  async _getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket> {
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

  async _getCaseDocketDocuments(
    context: ApplicationContext,
    caseId: string,
  ): Promise<DxtrCaseDocketEntryDocument[]> {
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
          PDF.PDF_WEB_PATH_LT AS uriStem,
          REPLACE(DC.FILE_NAME, '.gz', '') AS fileName,
          DC.PDF_SIZE as fileSize
      FROM AO_CS AS C
          JOIN AO_DE AS DE
            ON C.CS_CASEID = DE.CS_CASEID AND C.COURT_ID = DE.COURT_ID
          JOIN AO_DC AS DC ON C.CS_CASEID = DC.CS_CASEID AND C.COURT_ID = DC.COURT_ID AND DE.DE_SEQNO = DC.DE_SEQNO
          JOIN AO_CS_DIV DIV ON C.CS_DIV = DIV.CS_DIV
          JOIN AO_PDF_PATH AS PDF ON DIV.PDF_PATH_ID = PDF.PDF_PATH_ID
      WHERE C.CS_DIV=@courtDiv AND C.CASE_ID=@dxtrCaseId
      AND DC.COURT_STATUS != 'unk'
      AND DC.DELETED_LT = 'N'
    `;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    if (queryResult.success) {
      return (queryResult.results as mssql.IResult<DxtrCaseDocketEntryDocument>).recordset;
    } else {
      throw new CamsError(MODULENAME, { message: queryResult.message, data: { caseId } });
    }
  }
}
