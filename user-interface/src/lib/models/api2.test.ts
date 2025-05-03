import Api, { addApiAfterHook, addApiBeforeHook } from '@/lib/models/api';
import MockApi2 from '@/lib/testing/mock-api2';
import LocalStorage from '@/lib/utils/local-storage';
import { StaffAssignmentAction } from '@common/cams/assignments';
import {
  ConsolidationOrderActionRejection,
  TransferOrderAction,
  TransferOrderActionRejection,
} from '@common/cams/orders';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import { randomUUID } from 'crypto';
import { describe } from 'vitest';

import Api2, { _Api2, addAuthHeaderToApi, extractPathFromUri, useGenericApi } from './api2';

type Api2Type = {
  _Api2: typeof _Api2;
  addAuthHeaderToApi: typeof addAuthHeaderToApi;
  Api2: typeof Api2;
  extractPathFromUri: typeof extractPathFromUri;
  useGenericApi: typeof useGenericApi;
};

type ApiType = {
  addApiAfterHook: typeof addApiAfterHook;
  addApiBeforeHook: typeof addApiBeforeHook;
  readonly default: typeof Api;
};

describe.skip('Api2 mocking', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TODO: Why doesn't the module return the mock api 2?
  test('should return MockApi2 when CAMS_PA11Y is set to true', async () => {
    import.meta.env.CAMS_PA11Y = true;
    const api2 = await import('./api2');
    const mockSpy = vi.spyOn(MockApi2, 'getAttorneys');
    await api2.Api2.getAttorneys();
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

const inputPassedThroughApi = 'This is just a plain sentence.';
const inputBlockedFromApi = "<script>alert('XSS');</script>";

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
    await callApiFunction(api2.Api2.getOfficeAssignees, null, api);
    await callApiFunction(api2.Api2.getOrders, null, api);
    await callApiFunction(api2.Api2.getOrderSuggestions, 'some-id', api);
    await callApiFunction(api2.Api2.putConsolidationOrderApproval, 'some-id', api);
    await callApiFunction(api2.Api2.searchCases, 'some-id', api);
    await callApiFunction(api2.Api2.getCaseNotes, 'some-id', api);
    await callApiFunction(api2.Api2.getPrivilegedIdentityUsers, null, api);
    await callApiFunction(api2.Api2.getPrivilegedIdentityUser, 'some-id', api);
    await callApiFunction(api2.Api2.deletePrivilegedIdentityUser, 'some-id', api);
    await callApiFunction(api2.Api2.getRoleAndOfficeGroupNames, 'some-id', api);
  });

  test('should call api.put function when calling putPrivilegedIdentityUser', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const action = { expires: '00-00-0000', groups: ['some-group'] };
    api2.Api2.putPrivilegedIdentityUser('some-id', action);
    expect(putSpy).toHaveBeenCalledWith(`/dev-tools/privileged-identity/some-id`, action, {});
  });

  test('should call postCaseNote api function', async () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: ['some-note'] });
    api2.Api2.postCaseNote({ caseId: 'some-id', content: 'some note', title: 'some title' });
    expect(postSpy).toHaveBeenCalled();
  });

  test('should call putCaseNote api function', async () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: ['some-note'] });
    api2.Api2.putCaseNote({
      caseId: 'some-id',
      content: 'some note',
      id: 'some-id',
      title: 'some title',
    });
    expect(putSpy).toHaveBeenCalled();
  });

  test('should note call putCaseNote api function and handle error', async () => {
    const putSpy = vi.spyOn(api.default, 'put');
    await expect(
      api2.Api2.putCaseNote({
        caseId: 'some-id',
        content: 'some note',
        title: 'some title',
      }),
    ).rejects.toThrow('Id must be provided');
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('should call http delete when deleteCaseNote api function is called', async () => {
    const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue();
    api2.Api2.deleteCaseNote({
      caseId: 'case-id',
      id: 'note-id',
      updatedBy: MockData.getCamsUserReference(),
    });

    expect(deleteSpy).toHaveBeenCalledWith('/cases/case-id/notes/note-id', {});
  });

  test('should get through input input content validation and call postCaseNote', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    const title = 'some title';
    const path = '/cases/some-id/notes';
    api2.Api2.postCaseNote({
      caseId: 'some-id',
      content: inputPassedThroughApi,
      title,
    });
    expect(postSpy).toHaveBeenCalledWith(path, { content: inputPassedThroughApi, title }, {});
  });

  test('should get through input title validation and call postCaseNote', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    const content = 'come content';
    const path = '/cases/some-id/notes';
    api2.Api2.postCaseNote({
      caseId: 'some-id',
      content,
      title: inputPassedThroughApi,
    });
    expect(postSpy).toHaveBeenCalledWith(path, { content, title: inputPassedThroughApi }, {});
  });

  test('should be rejected by input validation and not call postCaseNote', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    api2.Api2.postCaseNote({
      caseId: 'some-id',
      content: inputBlockedFromApi,
      title: inputBlockedFromApi,
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should not call post if sanitized values are empty', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    api2.Api2.postCaseNote({
      caseId: 'some-id',
      content: '<script>foo</script>',
      title: '<script>foo</script>',
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should not call putConsolidationOrderRejection functions with malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const baseOrder = MockData.getConsolidationOrder();
    const dirtyConsolidationOrder: ConsolidationOrderActionRejection = {
      ...baseOrder,
      reason: inputBlockedFromApi,
      rejectedCases: [baseOrder.childCases[0].caseId],
      status: 'rejected',
    };

    api2.Api2.putConsolidationOrderRejection(dirtyConsolidationOrder);
    expect(postSpy).not.toHaveBeenCalledWith();
  });

  test('should call putConsolidationOrderRejection functions with non-malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const path = '/consolidations/reject';
    const baseOrder = MockData.getConsolidationOrder();
    const dirtyConsolidationOrder: ConsolidationOrderActionRejection = {
      ...baseOrder,
      reason: inputPassedThroughApi,
      rejectedCases: [baseOrder.childCases[0].caseId],
      status: 'rejected',
    };

    const cleanConsolidationOrder = {
      ...baseOrder,
      reason: inputPassedThroughApi,
      rejectedCases: [baseOrder.childCases[0].caseId],
      status: 'rejected',
    };

    api2.Api2.putConsolidationOrderRejection(dirtyConsolidationOrder);
    expect(postSpy).toHaveBeenCalledWith(path, cleanConsolidationOrder, {});
  });

  test('should call patchTransferOrderRejection with purified malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: '' });
    const dirtyTransferOrder: TransferOrderActionRejection = {
      ...MockData.getTransferOrder(),
      reason: inputBlockedFromApi,
      status: 'rejected',
    };
    const purifiedTransferOrder = { ...dirtyTransferOrder, reason: '' };
    api2.Api2.patchTransferOrderRejection(dirtyTransferOrder);
    expect(postSpy).toHaveBeenCalledWith(
      `/orders/${dirtyTransferOrder.id}`,
      purifiedTransferOrder,
      {},
    );
  });

  test('should call patchTransferOrderRejection with non-malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: '' });
    const transferOrder: TransferOrderActionRejection = {
      ...MockData.getTransferOrder(),
      reason: inputPassedThroughApi,
      status: 'rejected',
    };

    const path = `/orders/${transferOrder.id}`;

    api2.Api2.patchTransferOrderRejection(transferOrder);
    expect(postSpy).toHaveBeenCalledWith(path, transferOrder, {});
  });

  test('should handle no body properly', async () => {
    const postSpy = vi.spyOn(api.default, 'post').mockImplementation(() => {
      return Promise.resolve();
    });
    const assignmentAction: StaffAssignmentAction = {
      attorneyList: MockData.buildArray(MockData.getAttorneyUser, 2),
      caseId: '000-00-00000',
      role: CamsRole.TrialAttorney,
    };
    await api2.Api2.postStaffAssignments(assignmentAction);
    expect(postSpy).toHaveBeenCalled();

    const patchSpy = vi.spyOn(api.default, 'patch').mockImplementation(() => {
      return Promise.resolve();
    });
    const approval: TransferOrderAction = {
      caseId: MockData.randomCaseId(),
      id: randomUUID(),
      newCase: MockData.getCaseSummary(),
      orderType: 'transfer',
      status: 'approved',
    };
    await api2.Api2.patchTransferOrderApproval(approval);
    expect(patchSpy).toHaveBeenCalled();
  });

  test('should handle error properly', async () => {
    const error = new Error('Not Found');
    vi.spyOn(api.default, 'get').mockRejectedValue(error);
    vi.spyOn(api.default, 'patch').mockRejectedValue(error);
    vi.spyOn(api.default, 'post').mockRejectedValue(error);
    vi.spyOn(api.default, 'put').mockRejectedValue(error);
    vi.spyOn(api.default, 'delete').mockRejectedValue(error);
    await expect(api2.Api2.getAttorneys()).rejects.toThrow(error);
    await expect(api2.Api2.patchTransferOrderApproval({})).rejects.toThrow(error);
    await expect(api2.Api2.patchTransferOrderRejection({ reason: 'some-string' })).rejects.toThrow(
      error,
    );
    await expect(api2.Api2.searchCases({})).rejects.toThrow(error);
    await expect(api2.Api2.deletePrivilegedIdentityUser('userId')).rejects.toThrow(error);
    await expect(
      api2.Api2.putConsolidationOrderApproval({
        ...MockData.getConsolidationOrder(),
        approvedCases: [],
        leadCase: MockData.getCaseSummary(),
      }),
    ).rejects.toThrow(error);
  });
});

describe('addAuthHeaderToApi', () => {
  beforeEach(() => {
    vi.resetModules();
    import.meta.env.CAMS_PA11Y = false;
    Api.headers = {};
  });

  test('should add Authorization header when session exists', () => {
    const mockSession = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(mockSession);

    const result = addAuthHeaderToApi();

    expect(result.headers['Authorization']).toBe(`Bearer ${mockSession.accessToken}`);
  });

  test('should not add Authorization header when session does not exist', () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    const result = addAuthHeaderToApi();

    expect(result.headers['Authorization']).toBeUndefined();
  });
});

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function callApiFunction(fn: (args: any) => unknown, args: unknown, api: ApiType) {
  const stuff = ['some stuff'];
  const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: stuff });
  const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: stuff });
  const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: stuff });
  const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: stuff });
  const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue({ data: stuff });
  await fn(args);
  const spyCalls = sum(
    getSpy.mock.calls.length,
    patchSpy.mock.calls.length,
    postSpy.mock.calls.length,
    putSpy.mock.calls.length,
    deleteSpy.mock.calls.length,
  );
  expect(spyCalls).toEqual(1);
}

function sum(...values: number[]) {
  return values.reduce((total, value) => {
    return total + value;
  }, 0);
}
