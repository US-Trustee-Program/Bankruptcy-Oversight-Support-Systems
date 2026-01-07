import * as mssql from 'mssql';

import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { decomposeCaseId } from './dxtr.gateway.helper';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CaseDocket, CaseDocketEntryDocument } from '@common/cams/cases';

const MODULE_NAME = 'CASE-DOCKET-DXTR-GATEWAY';

export type DxtrCaseDocketEntryDocument = {
  sequenceNumber: number;
  fileSize: number;
  uriStem: string;
  fileName: string;
  deleted: string;
  parts?: string[];
};

export function translateModel(files: DxtrCaseDocketEntryDocument[]): CaseDocketEntryDocument[] {
  const doSingleNaming = files.length === 1;

  return files.reduce<CaseDocketEntryDocument[]>((accumulator, file) => {
    const { uriStem, fileName, fileSize } = file;

    let mappedFileInfo;
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

      mappedFileInfo = {
        fileUri,
        fileSize,
        fileLabel,
        fileExt,
      };
    } catch {
      mappedFileInfo = {
        fileUri,
        fileSize,
        fileLabel: fileName,
      };
    }
    accumulator.push(mappedFileInfo);
    return accumulator;
  }, []);
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
      if (d.deleted === 'Y' || !d.uriStem) return;
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
      FORMAT(D.DE_DATE_FILED, 'yyyy-MM-dd') as dateFiled,
      ISNULL(D.DO_SUMMARY_TEXT, 'SUMMARY NOT AVAILABLE') as summaryText,
      ISNULL(D.DT_TEXT, 'TEXT NOT AVAILABLE') as fullText
    FROM [dbo].[AO_DE] AS D
    JOIN [dbo].[AO_CS] AS C ON C.CS_CASEID=D.CS_CASEID AND C.COURT_ID=D.COURT_ID
    JOIN [dbo].[AO_CS_DIV] AS CD ON C.CS_DIV = CD.CS_DIV
    WHERE CD.CS_DIV_ACMS=@courtDiv
    AND C.CASE_ID=@dxtrCaseId
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
      if (!recordset.length) throw new NotFoundError(MODULE_NAME, { data: { caseId } });
      return recordset;
    } else {
      throw new CamsError(MODULE_NAME, { message: queryResult.message, data: { caseId } });
    }
  }

  /*

    The following SQL query was provided by a DXTR database subject matter expert from USTP. It is
    included here inline as a reference. We do not want to use this query as it causes a Cartesian
    product that we do not want to normalize after the result set is returned. Of interest are the
    case statements for the derived 'file_path' and 'deleted' columns.

    --The Annotated CaseViewer SQL Query:
    -- case 081-22-11509--
    DECLARE @cs_div as char(3) = '081'
    DECLARE @case_id as char(8) = '22-11509'

    SELECT DISTINCT de.de_date_enter, de.de_seqno, dc.dm_seq , de.do_summary_text,

    --- file path section 4 possibilities ---
    --- returns URL OR Message Text ---
    file_path =    CASE

    --- 1. PDF WEB PATH set to 'This file is no longer accessible via this system.' PDF deleted, case closed > 180 days section---
    WHEN ((dc.region_copied = 'Y' AND
    dc.region_deleted = 'Y' AND
    dc.copied_lt = 'N') OR
    (dc.copied_lt = 'Y' AND
    dc.deleted_lt = 'Y'))
    THEN 'This file is no longer accessible via this system.'

    --- 2. PDF WEB PATH is present but NEVER occurs since regional storage obsolete ---
    --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
    WHEN dc.region_copied = 'Y' AND
    dc.region_deleted = 'N' AND
    dc.region_copied_date is not NULL
    THEN pdf.pdf_web_path

    --- 3. PDF WEB PATH is present ---
    WHEN (dc.copied_lt = 'Y' AND
    dc.deleted_lt = 'N' AND
    dc.copied_lt_date is not NULL) AND
    ((dc.region_copied = 'Y' AND
    dc.region_deleted = 'Y'))
    THEN pdf.pdf_web_path_lt

    --- 4. PDF WEB PATH set to 'No document was filed for this entry.' PDF type/subtype was never requested / never existed ---
    ELSE 'No document was filed for this entry.'   END,

    --- file name section ---
    dc.file_name,

    --- file lt delete STATUS section 4 possibilities---
    --- PDF DELETED=Y OR PDF PRESENT=N SECTION ---
    deleted =  CASE

    --- 1. Use Y (pdf deleted)---
    --- copied_lt is N or deleted_lt is Y ---
    --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
    WHEN ((dc.region_copied = 'Y' AND
    dc.region_deleted = 'Y' AND
    dc.copied_lt = 'N') OR
    (dc.copied_lt = 'Y' AND
    dc.deleted_lt = 'Y'))
    THEN 'Y'

    --- 2. Use N (pdf present) PDF is present section but NEVER occurs since regional storage obsolete ---
    --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
    WHEN dc.region_copied = 'Y' AND
    dc.region_deleted = 'N' AND
    dc.region_copied_date is not NULL
    THEN dc.region_deleted

    --- 3. Use N value from ao_dc column delete_lt (pdf present)--
    --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
    WHEN (dc.copied_lt = 'Y' AND
    dc.deleted_lt = 'N' AND
    dc.copied_lt_date is not NULL) AND
    ((dc.region_copied = 'Y' AND
    dc.region_deleted = 'Y'))
    THEN dc.deleted_lt

    --- 4. Use Y (pdf not present)---
    ELSE 'Y'  END,

    --- division, case, date_enter, docket section ---
    div.cs_div_acms + '-' + cs.case_id caseid,  CONVERT(VARCHAR(10), de_date_enter, 120) de_date_enter,
    CONVERT(VARCHAR(10), de_date_filed, 120) de_date_filed,  de.de_document_num de_document_number,
    dc.dm_seq dm_seq,  SUBSTRING(dt_text,1,1900) dt_text
    FROM ao_cs cs WITH (NOLOCK)

    --- join section ---
    INNER JOIN ao_de de WITH (NOLOCK)       ON
    (de.court_id = cs.court_id AND de.cs_caseid = cs.cs_caseid)
    INNER JOIN ao_cs_div div WITH (NOLOCK)       ON
    (cs.cs_div = div.cs_div AND cs.grp_des = div.grp_des)
    LEFT OUTER JOIN ao_dc dc WITH (NOLOCK)       ON
    (de.court_id = dc.court_id AND de.cs_caseid = dc.cs_caseid AND de.de_seqno = dc.de_seqno)
    LEFT OUTER JOIN ao_pdf_path pdf WITH (NOLOCK)       ON
    (dc.pdf_path_id = pdf.pdf_path_id)

    --- where clause div case selection ---
    WHERE div.cs_div_acms = @cs_div
    AND cs.case_id = @case_id

    --- order section ---
    ORDER BY de.de_date_enter asc, de.de_seqno asc, dc.dm_seq ASC, de.do_summary_text, file_path;
  */

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

    // NOTE: A derivative of the this SQL query is in `orders.dxtr.gateway.ts`.
    const query = `
      SELECT
        DE.DE_SEQNO AS sequenceNumber,
        DC.PDF_SIZE as fileSize,
        uriStem = CASE
            --- 1. PDF WEB PATH set to 'This file is no longer accessible via this system.' PDF deleted, case closed > 180 days section---
            WHEN ((DC.region_copied = 'Y' AND
            DC.region_deleted = 'Y' AND
            DC.copied_lt = 'N') OR
            (DC.copied_lt = 'Y' AND
            DC.deleted_lt = 'Y'))
            THEN NULL
            --- 2. PDF WEB PATH is present but NEVER occurs since regional storage obsolete ---
            --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
            WHEN DC.region_copied = 'Y' AND
            DC.region_deleted = 'N' AND
            DC.region_copied_date is not NULL
            THEN pdf.pdf_web_path
            --- 3. PDF WEB PATH is present ---
            WHEN (DC.copied_lt = 'Y' AND
            DC.deleted_lt = 'N' AND
            DC.copied_lt_date is not NULL) AND
            ((DC.region_copied = 'Y' AND
            DC.region_deleted = 'Y'))
            THEN PDF.pdf_web_path_lt
            --- 4. PDF WEB PATH set to 'No document was filed for this entry.' PDF type/subtype was never requested / never existed ---
            END,
        REPLACE(DC.FILE_NAME, '.gz', '') AS fileName,
        deleted =  CASE
              --- 1. Use Y (pdf deleted)---
              --- copied_lt is N or deleted_lt is Y ---
              --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
              WHEN ((DC.region_copied = 'Y' AND
              DC.region_deleted = 'Y' AND
              DC.copied_lt = 'N') OR
              (DC.copied_lt = 'Y' AND
              DC.deleted_lt = 'Y'))
              THEN 'Y'
              --- 2. Use N (pdf present) PDF is present section but NEVER occurs since regional storage obsolete ---
              --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
              WHEN DC.region_copied = 'Y' AND
              DC.region_deleted = 'N' AND
              DC.region_copied_date is not NULL
              THEN DC.region_deleted
              --- 3. Use N value from ao_dc column delete_lt (pdf present)--
              --- note: when copied_lt is set to 'Y', region_copied set to 'Y' and region_deleted set to 'Y' ---
              WHEN (DC.copied_lt = 'Y' AND
              DC.deleted_lt = 'N' AND
              DC.copied_lt_date is not NULL) AND
              ((DC.region_copied = 'Y' AND
              DC.region_deleted = 'Y'))
              THEN DC.deleted_lt
              --- 4. Use Y (pdf not present)---
              ELSE 'Y'  END
      FROM [dbo].[AO_CS] AS C
        JOIN [dbo].[AO_DE] AS DE
          ON C.CS_CASEID = DE.CS_CASEID AND C.COURT_ID = DE.COURT_ID
        JOIN [dbo].[AO_DC] AS DC ON C.CS_CASEID = DC.CS_CASEID AND C.COURT_ID = DC.COURT_ID AND DE.DE_SEQNO = DC.DE_SEQNO
        JOIN [dbo].[AO_CS_DIV] DIV ON C.CS_DIV = DIV.CS_DIV
        JOIN [dbo].[AO_PDF_PATH] AS PDF ON DIV.PDF_PATH_ID = PDF.PDF_PATH_ID
      WHERE DIV.CS_DIV_ACMS=@courtDiv
      AND C.CASE_ID=@dxtrCaseId
      AND DC.COURT_STATUS != 'unk'
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
      throw new CamsError(MODULE_NAME, { message: queryResult.message, data: { caseId } });
    }
  }
}
