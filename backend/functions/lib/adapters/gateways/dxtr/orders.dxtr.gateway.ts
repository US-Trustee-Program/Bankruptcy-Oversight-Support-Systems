import * as mssql from 'mssql';

import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { ApplicationContext } from '../../types/basic';
import { OrdersGateway } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';
import { Order, OrderSync } from '../../../use-cases/orders/orders.model';
import { DxtrCaseDocketEntryDocument, translateModel } from './case-docket.dxtr.gateway';
import log from '../../services/logger.service';

const MODULE_NAME = 'ORDERS-DXTR-GATEWAY';

export interface DxtrOrder extends Order {
  // txId will be encoded as a string, not a number, because it is
  // of type BIGINT in MS-SQL Server.
  txId: string;
  dxtrCaseId: string;
  rawRec: string;
}

export interface DxtrOrderDocument extends DxtrCaseDocketEntryDocument {
  dxtrCaseId: string;
}

export function dxtrOrdersSorter(a: { orderDate: string }, b: { orderDate: string }) {
  if (a.orderDate === b.orderDate) return 0;
  return a.orderDate < b.orderDate ? -1 : 1;
}

export class DxtrOrdersGateway implements OrdersGateway {
  async getOrderSync(context: ApplicationContext, txId: string): Promise<OrderSync> {
    try {
      const orderSync = {
        orders: [],
        maxTxId: txId,
      };

      // TODO: We need to consider whether we partially load cosmos by chapter. This has ongoing data handling concerns whether we load all or load partially.
      const chapters: string[] = ['15'];
      if (context.featureFlags['chapter-eleven-enabled']) chapters.push('11');
      if (context.featureFlags['chapter-twelve-enabled']) chapters.push('12');

      // TODO: This filter will be applied to Cosmos order documents based on user context in the future. This temporarily limits the regions to region 2 for now. We need to discuss whether we copy orders from all regions into Cosmos on day one.
      const regions: string[] = ['02'];

      const params: DbTableFieldSpec[] = [];
      params.push({
        name: 'txId',
        type: mssql.BigInt,
        value: txId,
      });

      const rawOrders = await this._getOrders(context, txId, chapters, regions);
      log.info(context, MODULE_NAME, `Retrieved ${rawOrders.length} raw orders from DXTR.`);
      const documents = await this._getDocuments(context, txId, chapters, regions);
      log.info(context, MODULE_NAME, `Retrieved ${documents.length} documents from DXTR.`);
      const mappedDocuments = documents.reduce((map, document) => {
        const { dxtrCaseId } = document;
        delete document.dxtrCaseId;
        map.set(dxtrCaseId, document);
        return map;
      }, new Map());
      log.info(
        context,
        MODULE_NAME,
        `Reduced ${Array.from(mappedDocuments.values()).length} documents from DXTR.`,
      );

      orderSync.orders = rawOrders
        .map((rawOrder) => {
          if (orderSync.maxTxId < rawOrder.txId) orderSync.maxTxId = rawOrder.txId;

          if (mappedDocuments.has(rawOrder.dxtrCaseId)) {
            rawOrder.documents = translateModel([mappedDocuments.get(rawOrder.dxtrCaseId)]);
          }
          if (rawOrder.rawRec && rawOrder.rawRec.toUpperCase().includes('WARN:')) {
            rawOrder.newCaseId = rawOrder.rawRec.split('WARN:')[1].trim();
          }
          delete rawOrder.dxtrCaseId;
          delete rawOrder.rawRec;
          delete rawOrder.txId;
          return rawOrder satisfies Order;
        })
        .sort(dxtrOrdersSorter);
      log.info(
        context,
        MODULE_NAME,
        `Processed ${orderSync.orders.length} orders and their documents from DXTR. New maxTxId is ${orderSync.maxTxId}.`,
      );

      return orderSync;
    } catch (originalError) {
      throw new CamsError(MODULE_NAME, { originalError });
    }
  }

  async _getOrders(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrder>> {
    const params: DbTableFieldSpec[] = [];
    params.push({
      name: 'txId',
      type: mssql.BigInt,
      value: txId,
    });

    const query = `
      SELECT
        TX.TX_ID AS txId,
        CS.CS_CASEID AS dxtrCaseId,
        CS.CS_DIV+'-'+CS.CASE_ID as caseId,
        CS.CS_SHORT_TITLE as caseTitle,
        CS.CS_CHAPTER as chapter,
        C.COURT_NAME as courtName,
        O.OFFICE_NAME as courtDivisionName,
        G.REGION_ID as regionId,
        'transfer' AS orderType,
        FORMAT(TX.TX_DATE, 'yyyy-MM-dd') AS orderDate,
        DE.DE_SEQNO AS sequenceNumber,
        DE.DE_DOCUMENT_NUM AS documentNumber,
        DE.DO_SUMMARY_TEXT AS summaryText,
        DE.DT_TEXT AS fullText,
        FORMAT(DE.DE_DATE_FILED, 'yyyy-MM-dd') AS dateFiled,
        'pending' as status,
        TX.REC AS rawRec
      FROM [dbo].[AO_TX] AS TX
      JOIN [dbo].[AO_DE] AS DE ON TX.CS_CASEID=DE.CS_CASEID AND TX.DE_SEQNO=DE.DE_SEQNO AND TX.COURT_ID=DE.COURT_ID
      JOIN [dbo].[AO_CS] AS CS ON TX.CS_CASEID=CS.CS_CASEID AND TX.COURT_ID=CS.COURT_ID
      JOIN [dbo].[AO_GRP_DES] AS G
        ON CS.GRP_DES = G.GRP_DES
      JOIN [dbo].[AO_COURT] AS C
        ON CS.COURT_ID = C.COURT_ID
      JOIN [dbo].[AO_CS_DIV] AS CSD
        ON CS.CS_DIV = CSD.CS_DIV
      JOIN [dbo].[AO_OFFICE] AS O
        ON CS.COURT_ID = O.COURT_ID
        AND CSD.OFFICE_CODE = O.OFFICE_CODE
      WHERE TX.TX_CODE = 'CTO'
        AND CS.CS_CHAPTER IN ('${chapters.join("','")}')
        AND G.REGION_ID IN ('${regions.join("','")}')
        AND TX.TX_ID > @txId
      ORDER BY TX.TX_ID ASC
      `;

    console.log(query);

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      params,
    );

    if (queryResult.success) {
      return (queryResult.results as mssql.IResult<DxtrOrder>).recordset;
    } else {
      return Promise.reject(new CamsError(MODULE_NAME, { message: queryResult.message }));
    }
  }

  async _getDocuments(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrderDocument>> {
    const params: DbTableFieldSpec[] = [];
    params.push({
      name: 'txId',
      type: mssql.BigInt,
      value: txId,
    });

    // NOTE: This query is a derivative of the original SQL query in `case-docket.dxtr.gateway.ts`.
    const query = `
      SELECT
        CS.CS_CASEID AS dxtrCaseId,
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
      FROM [dbo].[AO_CS] AS CS
      JOIN [dbo].[AO_TX] AS TX ON TX.CS_CASEID=CS.CS_CASEID
      JOIN [dbo].[AO_DE] AS DE
        ON CS.CS_CASEID = DE.CS_CASEID AND CS.COURT_ID = DE.COURT_ID
      JOIN [dbo].[AO_DC] AS DC ON CS.CS_CASEID = DC.CS_CASEID AND CS.COURT_ID = DC.COURT_ID AND DE.DE_SEQNO = DC.DE_SEQNO
      JOIN [dbo].[AO_CS_DIV] DIV ON CS.CS_DIV = DIV.CS_DIV
      JOIN [dbo].[AO_PDF_PATH] AS PDF ON DIV.PDF_PATH_ID = PDF.PDF_PATH_ID
      JOIN (
        SELECT C.CS_CASEID, C.COURT_ID
          FROM [dbo].[AO_TX] AS T
          JOIN [dbo].[AO_DE] AS D ON T.CS_CASEID=D.CS_CASEID AND T.DE_SEQNO=D.DE_SEQNO AND T.COURT_ID = D.COURT_ID
          JOIN [dbo].[AO_CS] AS C ON T.CS_CASEID=C.CS_CASEID AND T.COURT_ID=C.COURT_ID
          JOIN [dbo].[AO_GRP_DES] AS G ON C.GRP_DES=G.GRP_DES
        WHERE T.TX_CODE = 'CTO'
          AND C.CS_CHAPTER IN ('${chapters.join("','")}')
          AND G.REGION_ID IN ('${regions.join("','")}')
          AND T.TX_ID > @txId
      ) AS CS2 ON CS2.CS_CASEID=CS.CS_CASEID AND CS2.COURT_ID=CS.COURT_ID
      WHERE DC.COURT_STATUS != 'unk'
      AND DE.DE_SEQNO=TX.DE_SEQNO
      AND TX.TX_CODE='CTO'
    `;

    console.log(query);

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      params,
    );

    if (queryResult.success) {
      return (queryResult.results as mssql.IResult<DxtrOrderDocument>).recordset;
    } else {
      return Promise.reject(new CamsError(MODULE_NAME, { message: queryResult.message }));
    }
  }
}
