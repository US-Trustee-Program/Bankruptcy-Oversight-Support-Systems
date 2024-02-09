import * as mssql from 'mssql';
import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { ApplicationContext } from '../../types/basic';
import { OrdersGateway } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';
import { TransferOrder, OrderSync } from '../../../../../../common/src/cams/orders';
import { DxtrCaseDocketEntryDocument, translateModel } from './case-docket.dxtr.gateway';
import { CaseDocketEntry } from '../../../use-cases/case-docket/case-docket.model';

const MODULE_NAME = 'ORDERS-DXTR-GATEWAY';

export interface DxtrOrder extends TransferOrder {
  dxtrCaseId: string;
}

export interface DxtrOrderDocketEntry extends CaseDocketEntry {
  // txId will be encoded as a string, not a number, because it is
  // of type BIGINT in MS-SQL Server.
  txId: string;
  dxtrCaseId: string;
  newCaseId?: string;
  rawRec: string;
}

export interface DxtrOrderDocument extends DxtrCaseDocketEntryDocument {
  // txId will be encoded as a string, not a number, because it is
  // of type BIGINT in MS-SQL Server.
  txId: string;
}

export function dxtrOrdersSorter(a: { orderDate: string }, b: { orderDate: string }) {
  if (a.orderDate === b.orderDate) return 0;
  return a.orderDate < b.orderDate ? -1 : 1;
}

export class DxtrOrdersGateway implements OrdersGateway {
  async getOrderSync(context: ApplicationContext, txId: string): Promise<OrderSync> {
    const transfers = await this.getTransferOrderSync(context, txId);
    const consolidations = await this.getConsolidationOrderSync(context, txId);
    return {
      orders: [...transfers.orders, ...consolidations.orders],
      maxTxId:
        transfers.maxTxId > consolidations.maxTxId ? transfers.maxTxId : consolidations.maxTxId,
    };
  }

  private async getConsolidationOrderSync(
    context: ApplicationContext,
    txId: string,
  ): Promise<OrderSync> {
    try {
      let maxTxId: number = parseInt(txId);

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

      // Get raw order which are a subset of case detail associated with a transfer order
      const rawOrders = await this.getConsolidationOrders(context, txId, chapters, regions);

      // Get the docket entries for transfer orders
      const rawDocketEntries = await this.getConsolidationOrderDocketEntries(
        context,
        txId,
        chapters,
        regions,
      );
      context.logger.info(
        MODULE_NAME,
        `Retrieved ${rawDocketEntries.length} raw orders from DXTR.`,
      );

      // Get documents for transfer docket entries
      const documents = await this.getConsolidationOrderDocuments(context, txId, chapters, regions);
      context.logger.info(MODULE_NAME, `Retrieved ${documents.length} documents from DXTR.`);

      const mappedDocuments = documents.reduce((map, document) => {
        const { txId } = document;
        delete document.txId;
        map.set(txId, document);
        return map;
      }, new Map());
      context.logger.info(
        MODULE_NAME,
        `Reduced ${Array.from(mappedDocuments.values()).length} documents from DXTR.`,
      );

      // Add documents to docket entries
      const docketEntries = rawDocketEntries.map((de) => {
        const txId = parseInt(de.txId);
        if (maxTxId < txId) maxTxId = txId;

        if (mappedDocuments.has(de.txId)) {
          de.documents = translateModel([mappedDocuments.get(de.txId)]);
        }

        if (de.rawRec && de.rawRec.toUpperCase().includes('WARN:')) {
          de.newCaseId = de.rawRec.split('WARN:')[1].trim();
        }
        delete de.rawRec;
        delete de.txId;
        return de;
      });

      const mappedDocketEntries: Map<string, DxtrOrderDocketEntry[]> = docketEntries.reduce(
        (map, docketEntry) => {
          const dxtrCaseId = docketEntry.dxtrCaseId;
          delete docketEntry.dxtrCaseId;
          if (map.has(dxtrCaseId)) {
            map.get(dxtrCaseId).push(docketEntry);
          } else {
            map.set(dxtrCaseId, [docketEntry]);
          }
          return map;
        },
        new Map<string, DxtrOrderDocketEntry[]>(),
      );

      const orders = rawOrders
        .map((rawOrder) => {
          if (mappedDocketEntries.has(rawOrder.dxtrCaseId)) {
            const docketEntries = mappedDocketEntries.get(rawOrder.dxtrCaseId);
            rawOrder.docketEntries = docketEntries;
            docketEntries.forEach((docket) => {
              if (docket.newCaseId) {
                rawOrder.newCaseId = docket.newCaseId;
                delete docket.newCaseId;
              }
            });
          }
          delete rawOrder.dxtrCaseId;
          return rawOrder satisfies TransferOrder;
        })
        .sort(dxtrOrdersSorter);
      context.logger.info(
        MODULE_NAME,
        `Processed ${orders.length} orders and their documents from DXTR. New maxTxId is ${maxTxId}.`,
      );

      // NOTE: maxTxId is stored as a string here because the SQL Server driver returns the
      // autoincrementing PK as a string, not an integer value.
      return {
        orders,
        maxTxId: maxTxId.toString(),
      };
    } catch (originalError) {
      throw new CamsError(MODULE_NAME, { originalError });
    }
  }

  private async getTransferOrderSync(
    context: ApplicationContext,
    txId: string,
  ): Promise<OrderSync> {
    try {
      let maxTxId: number = parseInt(txId);

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

      // Get raw order which are a subset of case detail associated with a transfer order
      const rawOrders = await this.getTransferOrders(context, txId, chapters, regions);

      // Get the docket entries for transfer orders
      const rawDocketEntries = await this.getTransferOrderDocketEntries(
        context,
        txId,
        chapters,
        regions,
      );
      context.logger.info(
        MODULE_NAME,
        `Retrieved ${rawDocketEntries.length} raw orders from DXTR.`,
      );

      // Get documents for transfer docket entries
      const documents = await this.getTransferOrderDocuments(context, txId, chapters, regions);
      context.logger.info(MODULE_NAME, `Retrieved ${documents.length} documents from DXTR.`);

      const mappedDocuments = documents.reduce((map, document) => {
        const { txId } = document;
        delete document.txId;
        map.set(txId, document);
        return map;
      }, new Map());
      context.logger.info(
        MODULE_NAME,
        `Reduced ${Array.from(mappedDocuments.values()).length} documents from DXTR.`,
      );

      // Add documents to docket entries
      const docketEntries = rawDocketEntries.map((de) => {
        const txId = parseInt(de.txId);
        if (maxTxId < txId) maxTxId = txId;

        if (mappedDocuments.has(de.txId)) {
          de.documents = translateModel([mappedDocuments.get(de.txId)]);
        }

        if (de.rawRec && de.rawRec.toUpperCase().includes('WARN:')) {
          de.newCaseId = de.rawRec.split('WARN:')[1].trim();
        }
        delete de.rawRec;
        delete de.txId;
        return de;
      });

      const mappedDocketEntries: Map<string, DxtrOrderDocketEntry[]> = docketEntries.reduce(
        (map, docketEntry) => {
          const dxtrCaseId = docketEntry.dxtrCaseId;
          delete docketEntry.dxtrCaseId;
          if (map.has(dxtrCaseId)) {
            map.get(dxtrCaseId).push(docketEntry);
          } else {
            map.set(dxtrCaseId, [docketEntry]);
          }
          return map;
        },
        new Map<string, DxtrOrderDocketEntry[]>(),
      );

      const orders = rawOrders
        .map((rawOrder) => {
          if (mappedDocketEntries.has(rawOrder.dxtrCaseId)) {
            const docketEntries = mappedDocketEntries.get(rawOrder.dxtrCaseId);
            rawOrder.docketEntries = docketEntries;
            docketEntries.forEach((docket) => {
              if (docket.newCaseId) {
                rawOrder.newCaseId = docket.newCaseId;
                delete docket.newCaseId;
              }
            });
          }
          delete rawOrder.dxtrCaseId;
          return rawOrder satisfies TransferOrder;
        })
        .sort(dxtrOrdersSorter);
      context.logger.info(
        MODULE_NAME,
        `Processed ${orders.length} orders and their documents from DXTR. New maxTxId is ${maxTxId}.`,
      );

      // NOTE: maxTxId is stored as a string here because the SQL Server driver returns the
      // autoincrementing PK as a string, not an integer value.
      return {
        orders,
        maxTxId: maxTxId.toString(),
      };
    } catch (originalError) {
      throw new CamsError(MODULE_NAME, { originalError });
    }
  }

  private async getTransferOrders(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrder>> {
    return this.getOrders(context, txId, 'CTO', chapters, regions);
  }

  private async getConsolidationOrders(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrder>> {
    return this.getOrders(context, txId, 'OCS', chapters, regions);
  }

  private async getOrders(
    context: ApplicationContext,
    txId: string,
    transactionCode: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrder>> {
    const params: DbTableFieldSpec[] = [];

    params.push({
      name: 'txId',
      type: mssql.BigInt,
      value: txId,
    });

    params.push({
      name: 'transactionCode',
      type: mssql.VarChar,
      value: transactionCode,
    });

    const query = `
      SELECT
        '${transactionCode === 'CTO' ? 'transfer' : 'consolidation'}' AS orderType,
        'pending' AS status,
        CS.CS_CASEID AS dxtrCaseId,
        CS.CS_DIV+'-'+CS.CASE_ID AS caseId,
        CS.CS_SHORT_TITLE AS caseTitle,
        CS.CS_CHAPTER AS chapter,
        C.COURT_NAME AS courtName,
        O.OFFICE_NAME AS courtDivisionName,
        G.REGION_ID AS regionId,
        R.REGION_NAME AS regionName,
        FORMAT(TX.TX_DATE, 'yyyy-MM-dd') AS orderDate
      FROM (
        SELECT TX2.CS_CASEID, TX2.COURT_ID, MIN(TX2.TX_DATE) AS TX_DATE
        FROM [dbo].[AO_TX] AS TX2
        WHERE TX2.TX_CODE = @transactionCode
        AND TX2.TX_ID > @txId
        GROUP BY TX2.CS_CASEID, TX2.COURT_ID
      ) AS TX
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
      JOIN [dbo].[AO_REGION] AS R ON G.REGION_ID = R.REGION_ID
      WHERE CS.CS_CHAPTER IN ('${chapters.join("','")}')
      AND G.REGION_ID IN ('${regions.join("','")}')
      `;

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

  private async getTransferOrderDocketEntries(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrderDocketEntry>> {
    return this.getOrderDocketEntries(context, txId, 'CTO', chapters, regions);
  }

  private async getConsolidationOrderDocketEntries(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrderDocketEntry>> {
    return this.getOrderDocketEntries(context, txId, 'OCS', chapters, regions);
  }

  private async getOrderDocketEntries(
    context: ApplicationContext,
    txId: string,
    transactionCode: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrderDocketEntry>> {
    const params: DbTableFieldSpec[] = [];

    params.push({
      name: 'txId',
      type: mssql.BigInt,
      value: txId,
    });

    params.push({
      name: 'transactionCode',
      type: mssql.VarChar,
      value: transactionCode,
    });

    const query = `
      SELECT
        TX.TX_ID AS txId,
        CS.CS_CASEID as dxtrCaseId,
        DE.DE_SEQNO AS sequenceNumber,
        DE.DE_DOCUMENT_NUM AS documentNumber,
        DE.DO_SUMMARY_TEXT AS summaryText,
        DE.DT_TEXT AS fullText,
        FORMAT(DE.DE_DATE_FILED, 'yyyy-MM-dd') AS dateFiled,
        TX.REC AS rawRec
      FROM [dbo].[AO_TX] AS TX
      JOIN [dbo].[AO_DE] AS DE ON TX.CS_CASEID=DE.CS_CASEID AND TX.DE_SEQNO=DE.DE_SEQNO AND TX.COURT_ID=DE.COURT_ID
      JOIN [dbo].[AO_CS] AS CS ON TX.CS_CASEID=CS.CS_CASEID AND TX.COURT_ID=CS.COURT_ID
      JOIN [dbo].[AO_GRP_DES] AS G
        ON CS.GRP_DES = G.GRP_DES
      JOIN [dbo].[AO_REGION] AS R ON G.REGION_ID = R.REGION_ID
      WHERE TX.TX_CODE = @transactionCode
        AND CS.CS_CHAPTER IN ('${chapters.join("','")}')
        AND G.REGION_ID IN ('${regions.join("','")}')
        AND TX.TX_ID > @txId
      ORDER BY TX.TX_ID ASC
      `;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      params,
    );

    if (queryResult.success) {
      return (queryResult.results as mssql.IResult<DxtrOrderDocketEntry>).recordset;
    } else {
      return Promise.reject(new CamsError(MODULE_NAME, { message: queryResult.message }));
    }
  }

  private async getTransferOrderDocuments(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrderDocument>> {
    return this.getOrderDocuments(context, txId, 'CTO', chapters, regions);
  }

  private async getConsolidationOrderDocuments(
    context: ApplicationContext,
    txId: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrderDocument>> {
    return this.getOrderDocuments(context, txId, 'OCS', chapters, regions);
  }

  private async getOrderDocuments(
    context: ApplicationContext,
    txId: string,
    transactionCode: string,
    chapters: string[],
    regions: string[],
  ): Promise<Array<DxtrOrderDocument>> {
    const params: DbTableFieldSpec[] = [];

    params.push({
      name: 'txId',
      type: mssql.BigInt,
      value: txId,
    });

    params.push({
      name: 'transactionCode',
      type: mssql.VarChar,
      value: transactionCode,
    });

    // NOTE: This query is a derivative of the original SQL query in `case-docket.dxtr.gateway.ts`.
    const query = `
      SELECT
        CS2.TX_ID AS txId,
        CS.CS_CASEID AS dxtrCaseId,
        DE.DE_SEQNO AS sequenceNumber,
        DC.PDF_SIZE AS fileSize,
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
        SELECT C.CS_CASEID, C.COURT_ID, T.TX_ID
          FROM [dbo].[AO_TX] AS T
          JOIN [dbo].[AO_DE] AS D ON T.CS_CASEID=D.CS_CASEID AND T.DE_SEQNO=D.DE_SEQNO AND T.COURT_ID = D.COURT_ID
          JOIN [dbo].[AO_CS] AS C ON T.CS_CASEID=C.CS_CASEID AND T.COURT_ID=C.COURT_ID
          JOIN [dbo].[AO_GRP_DES] AS G ON C.GRP_DES=G.GRP_DES
        WHERE T.TX_CODE = @transactionCode
          AND C.CS_CHAPTER IN ('${chapters.join("','")}')
          AND G.REGION_ID IN ('${regions.join("','")}')
          AND T.TX_ID > @txId
      ) AS CS2 ON CS2.CS_CASEID=CS.CS_CASEID AND CS2.COURT_ID=CS.COURT_ID
      WHERE DC.COURT_STATUS != 'unk'
      AND DE.DE_SEQNO=TX.DE_SEQNO
      AND TX.TX_CODE=@transactionCode
    `;

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
