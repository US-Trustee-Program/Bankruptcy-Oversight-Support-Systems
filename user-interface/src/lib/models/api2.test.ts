import { describe } from 'vitest';
import MockApi2 from '@/lib/testing/mock-api2';
import Api2, { _Api2, addAuthHeaderToApi, extractPathFromUri, useGenericApi } from './api2';
import Api, { addApiAfterHook, addApiBeforeHook } from '@/lib/models/api';
import MockData from '@common/cams/test-utilities/mock-data';
import { StaffAssignmentAction } from '@common/cams/assignments';
import { CamsRole } from '@common/cams/roles';
import { randomUUID } from 'crypto';
import {
  ConsolidationOrderActionRejection,
  TransferOrderAction,
  TransferOrderActionRejection,
} from '@common/cams/orders';

type ApiType = {
  addApiBeforeHook: typeof addApiBeforeHook;
  addApiAfterHook: typeof addApiAfterHook;
  readonly default: typeof Api;
};

type Api2Type = {
  extractPathFromUri: typeof extractPathFromUri;
  addAuthHeaderToApi: typeof addAuthHeaderToApi;
  useGenericApi: typeof useGenericApi;
  _Api2: typeof _Api2;
  Api2: typeof Api2;
};

describe('Api2', () => {
  beforeEach(() => {
    import.meta.env.CAMS_PA11Y = true;
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should return MockApi2 when CAMS_PA11Y is set to true', async () => {
    const mockSpy = vi.spyOn(MockApi2, 'getAttorneys');
    const api = await import('./api2');
    await api.Api2.getAttorneys();
    expect(mockSpy).toHaveBeenCalled();
  });

  test('should return _Api2 when CAMS_PA11Y is set to false', async () => {
    import.meta.env.CAMS_PA11Y = false;
    const mockSpy = vi.spyOn(MockApi2, 'getAttorneys');
    const api2 = await import('./api2');
    const api = await import('./api');
    const apiSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: [] });
    await api2.Api2.getAttorneys();
    expect(mockSpy).not.toHaveBeenCalled();
    expect(apiSpy).toHaveBeenCalled();
  });
});

describe('extractPathFromUri', () => {
  import.meta.env.CAMS_PA11Y = false;

  test('should return path when given full uri with protocol, domain, and parameters', () => {
    const api = addAuthHeaderToApi();
    api.host = `https://some-domain.gov`;
    const expectedPath = '/this/is/a/path';
    const uri = `${api.host}${expectedPath}?these=are&the=params`;

    const { uriOrPathSubstring } = extractPathFromUri(uri, api);

    expect(uriOrPathSubstring).toEqual(expectedPath);
  });

  test('should return path when given only a path', () => {
    const api = addAuthHeaderToApi();
    api.host = '';
    const expectedPath = '/this/is/a/path';

    const { uriOrPathSubstring } = extractPathFromUri(expectedPath, api);

    expect(uriOrPathSubstring).toEqual(expectedPath);
  });
});

const sanitizationInputs = [
  ['This is just a plain sentence.', 'This is just a plain sentence.'],
  ["Let's remove this item.", "Let's remove this item."],
  ['We need to find a better way.', 'We need to find a better way.'],
  ['This is a safe string.', 'This is a safe string.'],
  ["Let's fetch some data.", "Let's fetch some data."],
  [
    'This is a test.',
    'This is <p>abc<iframe//src=jAva&Tab;script:alert(3)>def</iframe></p>a test.',
  ],
  ['', '<script></script>'],
  ['', '<script>foo</script>'],
  ['', "<script>alert('XSS');</script>"],
];

// the following aren't working as expected.  The data is not sanitized at all.
//  ['Use setTimeout;', 'Use setTimeout(() => {}, 1000);'],
//  ['document.querySelector', "document.querySelector('#id');"],
//  ['fetch', "fetch('/api/data');"],

describe('_Api2 functions', async () => {
  let api: ApiType;
  let api2: Api2Type;

  beforeEach(async () => {
    vi.resetModules();
    import.meta.env.CAMS_PA11Y = false;
    api = await import('./api');
    api2 = await import('./api2');
  });

  test('should call real api functions', async () => {
    await callApiFunction(api2.Api2.getAttorneys, null, api);
    await callApiFunction(api2.Api2.getCaseAssignments, 'some-id', api);
    await callApiFunction(api2.Api2.getCaseAssociations, 'some-id', api);
    await callApiFunction(api2.Api2.getCaseDetail, 'some-id', api);
    await callApiFunction(api2.Api2.getCaseDocket, 'some-id', api);
    await callApiFunction(api2.Api2.getCaseHistory, 'some-id', api);
    await callApiFunction(api2.Api2.getCaseSummary, 'some-id', api);
    await callApiFunction(api2.Api2.getCourts, null, api);
    await callApiFunction(api2.Api2.getMe, null, api);
    await callApiFunction(api2.Api2.getOffices, null, api);
    await callApiFunction(api2.Api2.getOfficeAttorneys, null, api);
    await callApiFunction(api2.Api2.getOrders, null, api);
    await callApiFunction(api2.Api2.getOrderSuggestions, 'some-id', api);
    await callApiFunction(api2.Api2.putConsolidationOrderApproval, 'some-id', api);
    await callApiFunction(api2.Api2.putConsolidationOrderRejection, 'some-id', api);
    await callApiFunction(api2.Api2.searchCases, 'some-id', api);
    await callApiFunction(api2.Api2.getCaseNotes, 'some-id', api);
  });

  test('should call postCaseNote api function', async () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: ['some-note'] });
    api2.Api2.postCaseNote('some-id', 'some note');
    expect(postSpy).toHaveBeenCalled();
  });

  test.each(sanitizationInputs)(
    'should sanitize input on postCaseNote function',
    async (cleanInput: string, dirtyInput: string) => {
      const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
      const path = '/cases/some-id/notes';
      api2.Api2.postCaseNote('some-id', dirtyInput);
      expect(postSpy).toHaveBeenCalledWith(path, { note: cleanInput }, {});
    },
  );

  test.each(sanitizationInputs)(
    'should sanitize input on putConsolidationOrderRejection functions',
    async (cleanInput: string, dirtyInput: string) => {
      const postSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
      const path = '/consolidations/reject';
      const baseOrder = MockData.getConsolidationOrder();
      const dirtyConsolidationOrder: ConsolidationOrderActionRejection = {
        ...baseOrder,
        rejectedCases: [baseOrder.childCases[0].caseId],
        status: 'rejected',
        reason: dirtyInput,
      };
      const cleanConsolidationOrder = {
        ...baseOrder,
        rejectedCases: [baseOrder.childCases[0].caseId],
        status: 'rejected',
        reason: cleanInput,
      };

      api2.Api2.putConsolidationOrderRejection(dirtyConsolidationOrder);
      expect(postSpy).toHaveBeenCalledWith(path, cleanConsolidationOrder, {});
    },
  );

  test.each(sanitizationInputs)(
    'should sanitize input on patchTransferOrder on transfer rejection',
    async (cleanInput: string, dirtyInput: string) => {
      const postSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: '' });
      const dirtyTransferOrder: TransferOrderActionRejection = {
        ...MockData.getTransferOrder(),
        status: 'rejected',
        reason: dirtyInput,
      };

      const cleanTransferOrder = {
        ...dirtyTransferOrder,
        reason: cleanInput,
      };

      const path = `/orders/${dirtyTransferOrder.id}`;

      api2.Api2.patchTransferOrder(dirtyTransferOrder);
      expect(postSpy).toHaveBeenCalledWith(path, cleanTransferOrder, {});
    },
  );

  test('should handle no body properly', async () => {
    const postSpy = vi.spyOn(api.default, 'post').mockImplementation(() => {
      return Promise.resolve();
    });
    const assignmentAction: StaffAssignmentAction = {
      caseId: '000-00-00000',
      attorneyList: MockData.buildArray(MockData.getAttorneyUser, 2),
      role: CamsRole.TrialAttorney,
    };
    await api2.Api2.postStaffAssignments(assignmentAction);
    expect(postSpy).toHaveBeenCalled();

    const patchSpy = vi.spyOn(api.default, 'patch').mockImplementation(() => {
      return Promise.resolve();
    });
    const approval: TransferOrderAction = {
      id: randomUUID(),
      caseId: MockData.randomCaseId(),
      orderType: 'transfer',
      newCase: MockData.getCaseSummary(),
      status: 'approved',
    };
    await api2.Api2.patchTransferOrder(approval);
    expect(patchSpy).toHaveBeenCalled();
  });

  test('should handle error properly', async () => {
    const error = new Error('Not Found');
    vi.spyOn(api.default, 'get').mockRejectedValue(error);
    vi.spyOn(api.default, 'patch').mockRejectedValue(error);
    vi.spyOn(api.default, 'post').mockRejectedValue(error);
    vi.spyOn(api.default, 'put').mockRejectedValue(error);
    await expect(api2.Api2.getAttorneys()).rejects.toThrow(error);
    await expect(api2.Api2.patchTransferOrder({})).rejects.toThrow(error);
    await expect(api2.Api2.searchCases({})).rejects.toThrow(error);
    await expect(
      api2.Api2.putConsolidationOrderApproval({
        ...MockData.getConsolidationOrder(),
        approvedCases: [],
        leadCase: MockData.getCaseSummary(),
      }),
    ).rejects.toThrow(error);
  });
});

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function callApiFunction(fn: (args: any) => unknown, args: unknown, api: ApiType) {
  const stuff = ['some stuff'];
  const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: stuff });
  const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: stuff });
  const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: stuff });
  const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: stuff });
  const actual: unknown = await fn(args);
  const spyCalls =
    getSpy.mock.calls.length +
    patchSpy.mock.calls.length +
    postSpy.mock.calls.length +
    putSpy.mock.calls.length;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  expect(actual.data).toEqual(stuff);
  expect(spyCalls).toEqual(1);
}
