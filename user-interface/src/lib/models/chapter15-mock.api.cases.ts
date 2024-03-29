import { ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { ResponseData, SimpleResponseData } from '../type-declarations/api';
import {
  Chapter15CaseDetailsResponseData,
  Chapter15CaseSummaryResponseData,
} from '../type-declarations/chapter-15';
import Api from './api';
import { ObjectKeyVal } from '@/lib/type-declarations/basic';
import { MockData } from '@common/cams/test-utilities/mock-data';

export default class Chapter15MockApi extends Api {
  static caseList = [
    {
      caseId: '101-23-44463',
      caseTitle: 'Flo Esterly and Neas Van Sampson',
      dateFiled: '2023-05-04',
    },
    {
      caseId: '101-23-44462',
      caseTitle: 'Bridget Maldonado',
      dateFiled: '2023-04-14',
    },
    {
      caseId: '101-23-44461',
      caseTitle: 'Talia Torres and Tylor Stevenson',
      dateFiled: '2023-04-04',
    },
    {
      caseId: '101-23-44460',
      caseTitle: 'Asia Hodges',
      dateFiled: '2023-03-01',
    },
    {
      caseId: '101-23-44459',
      caseTitle: 'Marilyn Lawson',
      dateFiled: '2023-02-14',
    },
    {
      caseId: '101-23-44458',
      caseTitle: 'April Pierce and Leah Pierce',
      dateFiled: '2023-02-04',
    },
    {
      caseId: '101-23-44457',
      caseTitle: 'Corinne Gordon',
      dateFiled: '2023-01-14',
    },
    {
      caseId: '101-23-44456',
      caseTitle: 'Marilyn Lang and Rudy Bryant',
      dateFiled: '2023-01-04',
    },
    {
      caseId: '101-23-44455',
      caseTitle: 'Justin Long and Michael Cera',
      dateFiled: '2023-02-07',
    },
  ];

  static caseDocketEntries = MockData.buildArray(MockData.getDocketEntry, 5);
  static caseDetails = MockData.getCaseDetail();
  static offices = MockData.getOffices().slice(0, 5);

  // Consolidated Lead Case
  static consolidationLeadCaseId = '999-99-00001';
  static consolidationLeadCaseSummary = MockData.getCaseSummary({
    override: { caseId: Chapter15MockApi.consolidationLeadCaseId },
  });
  static consolidation: Array<ConsolidationTo | ConsolidationFrom> = [
    MockData.getConsolidationReference({
      override: {
        otherCase: Chapter15MockApi.consolidationLeadCaseSummary,
        documentType: 'CONSOLIDATION_TO',
      },
    }),
    MockData.getConsolidationReference({
      override: { caseId: Chapter15MockApi.consolidationLeadCaseId },
    }),
    MockData.getConsolidationReference({
      override: { caseId: Chapter15MockApi.consolidationLeadCaseId },
    }),
  ];
  static consolidationLeadCase = MockData.getCaseDetail({
    override: {
      ...Chapter15MockApi.consolidationLeadCaseSummary,
      consolidation: Chapter15MockApi.consolidation,
    },
  });

  static orders = [
    MockData.getTransferOrder({ override: { id: 'guid-0' } }),
    MockData.getTransferOrder({ override: { id: 'guid-1', status: 'approved' } }),
    MockData.getTransferOrder({ override: { id: 'guid-2', status: 'rejected' } }),
    MockData.getConsolidationOrder({ override: { id: 'guid-3' } }),
    MockData.getConsolidationOrder({
      override: {
        id: 'guid-4',
        status: 'approved',
        leadCase: {
          ...this.consolidationLeadCaseSummary,
          docketEntries: [],
          orderDate: MockData.getDateBeforeToday().toISOString(),
        },
      },
    }),
    MockData.getConsolidationOrder({ override: { id: 'guid-5', status: 'rejected' } }),
  ];

  public static async list(path: string): Promise<ResponseData> {
    let response: ResponseData;
    switch (path) {
      case '/cases':
        response = {
          message: '',
          count: Chapter15MockApi.caseList.length,
          body: {
            caseList: Chapter15MockApi.caseList,
          },
        };
        break;
      default:
        response = {
          message: 'not found',
          count: 0,
          body: {
            caseList: [],
          },
        };
    }
    return Promise.resolve(response);
  }

  public static async get(
    path: string,
  ): Promise<
    Chapter15CaseSummaryResponseData | Chapter15CaseDetailsResponseData | SimpleResponseData
  > {
    let response: ResponseData | SimpleResponseData;
    if (path.match(/\/cases\/123-12-12345\/docket/)) {
      return Promise.reject(new Error());
    } else if (path.match(/\/cases\/001-77-77777\/summary/)) {
      return Promise.reject({ message: 'Case summary not found for the case ID.' });
    } else if (path.match(/\/cases\/999-99-00001\/associated/)) {
      response = {
        message: '',
        count: 1,
        body: this.consolidation,
      };
    } else if (path.match(/\/cases\/999-99-00001/)) {
      response = {
        message: '',
        count: 1,
        body: {
          caseDetails: {
            ...this.consolidationLeadCase,
            consolidation: this.consolidation,
          },
        },
      };
    } else if (path.match(/\/cases\/[\d-]+\/docket/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.caseDocketEntries,
      };
    } else if (path.match(/\/cases\/[\d-]+\/summary/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.caseDetails,
      };
    } else if (path.match(/\/cases\/[\d-]+\/associated/)) {
      response = {
        message: '',
        count: 1,
        body: [],
      };
    } else if (path.match(/\/cases\/[\d-]+/)) {
      response = {
        message: '',
        count: 1,
        body: {
          caseDetails: Chapter15MockApi.caseDetails,
        },
      };
    } else if (path.match(/\/orders-suggestions\/[\d-]+/)) {
      response = {
        success: true,
        body: [Chapter15MockApi.caseDetails],
      };
      return Promise.resolve(response as SimpleResponseData);
    } else if (path.match(/\/orders/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.orders,
      };
    } else if (path.match(/\/offices/)) {
      response = {
        message: '',
        count: 1,
        body: Chapter15MockApi.offices,
      };
    } else {
      response = {
        message: 'not found',
        count: 0,
        body: {
          caseDetails: {},
        },
      };
    }

    return Promise.resolve(response as Chapter15CaseDetailsResponseData);
  }

  public static async patch(_path: string, data: object, _options?: ObjectKeyVal) {
    const response = {
      message: '',
      count: 1,
      body: data,
    };
    return Promise.resolve(response);
  }

  public static async put(_path: string, data: object, _options?: ObjectKeyVal) {
    const response = {
      message: '',
      count: 1,
      body: data,
    };
    return Promise.resolve(response);
  }
}
