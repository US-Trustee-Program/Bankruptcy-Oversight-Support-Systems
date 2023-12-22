import * as mssql from 'mssql';

import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { ApplicationContext } from '../../types/basic';
import { OrdersGateway } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';
import { Order } from '../../../use-cases/orders/orders.model';

const MODULENAME = 'ORDERS-DXTR-GATEWAY';

interface DxtrOrder extends Order {
  rawRec: string;
}

export class DxtrOrdersGateway implements OrdersGateway {
  async getOrders(context: ApplicationContext): Promise<Array<Order>> {
    const rawOrders = await this._getOrders(context);
    // TODO: Need to add the document links for the docket entry to the DTO if they exist.
    return rawOrders
      .map((rawOrder) => {
        if (rawOrder.rawRec.toUpperCase().includes('WARN:')) {
          rawOrder.newCaseId = rawOrder.rawRec.split('WARN:')[1].trim();
        }
        delete rawOrder.rawRec;
        return rawOrder satisfies Order;
      })
      .sort((a, b) => {
        if (a.orderDate === b.orderDate) return 0;
        return a.orderDate < b.orderDate ? -1 : 1;
      });
  }

  async _getOrders(context: ApplicationContext): Promise<Array<DxtrOrder>> {
    const input: DbTableFieldSpec[] = [];
    const query = `
      SELECT TOP 20
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
      FROM AO_TX AS TX
      JOIN AO_DE AS DE ON TX.CS_CASEID=DE.CS_CASEID AND TX.DE_SEQNO=DE.DE_SEQNO
      JOIN AO_CS AS CS ON TX.CS_CASEID=CS.CS_CASEID
      JOIN AO_GRP_DES AS G
        ON CS.GRP_DES = G.GRP_DES
      JOIN AO_COURT AS C
        ON CS.COURT_ID = C.COURT_ID
      JOIN AO_CS_DIV AS CSD
        ON CS.CS_DIV = CSD.CS_DIV
      JOIN AO_OFFICE AS O
        ON CS.COURT_ID = O.COURT_ID
        AND CSD.OFFICE_CODE = O.OFFICE_CODE
      WHERE TX.TX_CODE = 'CTO'
      ORDER BY TX.TX_DATE DESC
      `;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    if (queryResult.success) {
      return (queryResult.results as mssql.IResult<DxtrOrder>).recordset;
    } else {
      throw new CamsError(MODULENAME, { message: queryResult.message });
    }
  }
}
