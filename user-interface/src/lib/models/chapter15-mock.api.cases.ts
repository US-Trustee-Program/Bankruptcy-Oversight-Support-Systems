import { ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { ResponseData, SimpleResponseData } from '../type-declarations/api';
import Api from './api';
import { ObjectKeyVal } from '@/lib/type-declarations/basic';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { ResponseBody } from '@common/api/response';
import { CaseBasics } from '@common/cams/cases';
import Actions from '@common/cams/actions';
import { SUPERUSER } from '@common/cams/test-utilities/mock-user';
import { ResourceActions } from '../../../../common/dist/cams/actions';

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
  static caseActions = [Actions.ManageAssignments];
  static caseDetails = MockData.getCaseDetail({
    override: { _actions: this.caseActions, chapter: '15' },
  });
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
    MockData.getTransferOrder({ override: { id: 'guid-0', orderDate: '2024-01-01' } }),
    MockData.getTransferOrder({
      override: { id: 'guid-1', orderDate: '2024-02-01', status: 'approved' },
    }),
    MockData.getTransferOrder({
      override: { id: 'guid-2', orderDate: '2024-03-01', status: 'rejected' },
    }),
    MockData.getConsolidationOrder({ override: { id: 'guid-3', orderDate: '2024-04-01' } }),
    MockData.getConsolidationOrder({
      override: {
        id: 'guid-4',
        orderDate: '2024-05-01',
        status: 'approved',
        leadCase: {
          ...this.consolidationLeadCaseSummary,
        },
      },
    }),
    MockData.getConsolidationOrder({
      override: {
        id: 'guid-5',
        orderDate: '2024-06-01',
        status: 'rejected',
        reason: 'This is a rejection reason.',
      },
    }),
  ];

  // TODO: add handling of other uses of POST (e.g. case assignment creation)
  public static async post(path: string, body: object, _options: ObjectKeyVal) {
    if (path.match(/\/cases/)) {
      const searchRequest = body as { caseNumber: string };
      const _actions = [Actions.ManageAssignments];
      const caseNumber = searchRequest ? searchRequest.caseNumber : '';
      const response: ResponseBody<ResourceActions<CaseBasics>[]> = {
        data: [],
      };
      if (caseNumber === '99-99999') {
        return Promise.reject(new Error('api error'));
      } else if (caseNumber === '00-00000') {
        response.data = [MockData.getCaseBasics({ override: { caseId: `011-${caseNumber}` } })];
      } else if (caseNumber === '11-00000') {
        response.data = [];
      } else {
        response.data = [
          { ...MockData.getCaseBasics({ override: { caseId: `011-${caseNumber}` } }), _actions },
          { ...MockData.getCaseBasics({ override: { caseId: `070-${caseNumber}` } }), _actions },
          { ...MockData.getCaseBasics({ override: { caseId: `132-${caseNumber}` } }), _actions },
          { ...MockData.getCaseBasics({ override: { caseId: `3E1-${caseNumber}` } }), _actions },
          { ...MockData.getCaseBasics({ override: { caseId: `256-${caseNumber}` } }), _actions },
        ];
      }
      return response;
    } else {
      return Promise.reject(new Error());
    }
  }

  // TODO: This needs to be refactored to only return ResponseBody shaped responses.
  public static async get(path: string): Promise<ResponseBody> {
    let response: ResponseData | SimpleResponseData | ResponseBody;
    if (path.match(/\/cases\/123-12-12345\/docket/)) {
      return Promise.reject(new Error());
    } else if (path.match(/\/cases\/001-77-77777\/summary/)) {
      return Promise.reject({ message: 'Case summary not found for the case ID.' });
    } else if (path.match(/\/cases\/999-99-00001\/associated/)) {
      response = {
        data: this.consolidation,
      };
    } else if (path.match(/\/cases\/999-99-00001\/docket/)) {
      response = {
        data: [],
      };
    } else if (path.match(/\/cases\/999-99-00001/)) {
      response = {
        data: {
          ...this.consolidationLeadCase,
          consolidation: this.consolidation,
        },
      };
    } else if (path.match(/\/cases\/[A-Z\d-]+\/docket/)) {
      response = {
        data: Chapter15MockApi.caseDocketEntries,
      };
    } else if (path.match(/\/cases\/[A-Z\d-]+\/summary/i)) {
      response = {
        data: Chapter15MockApi.caseDetails,
      };
    } else if (path.match(/\/cases\/[A-Z\d-]+\/associated/)) {
      response = {
        data: [],
      };
    } else if (path.match(/\/cases\/[A-Z\d-]+/)) {
      response = {
        data: Chapter15MockApi.caseDetails,
      };
    } else if (path.match(/\/orders-suggestions\/[A-Z\d-]+/)) {
      response = {
        data: [Chapter15MockApi.caseDetails],
      };
      return Promise.resolve(response);
    } else if (path.match(/\/orders/)) {
      response = {
        data: Chapter15MockApi.orders,
      };
    } else if (path.match(/\/offices/)) {
      response = {
        data: Chapter15MockApi.offices,
      };
    } else if (path.match(/\/me/)) {
      response = {
        data: MockData.getCamsSession({ user: SUPERUSER.user }),
      };
    } else {
      response = {
        data: {},
      };
    }

    return Promise.resolve(response);
  }

  public static async patch(_path: string, data: object, _options?: ObjectKeyVal) {
    const response = {
      data,
    };
    return Promise.resolve(response);
  }

  public static async put(_path: string, data: object, _options?: ObjectKeyVal) {
    const response = {
      data,
    };
    return Promise.resolve(response);
  }
}
