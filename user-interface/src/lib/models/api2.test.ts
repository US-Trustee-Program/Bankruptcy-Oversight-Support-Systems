import { describe } from 'vitest';
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
import LocalStorage from '@/lib/utils/local-storage';
import { blankConfiguration } from '../testing/mock-configuration';
import { BankruptcySoftwareListItem, BankListItem } from '@common/cams/lists';
import { Creatable } from '@common/cams/creatable';

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

describe('extractPathFromUri', () => {
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

    vi.doMock('@/configuration/appConfiguration', async () => {
      return {
        default: () => ({
          ...blankConfiguration,
          useFakeApi: false,
        }),
      };
    });

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
    await callApiFunction(api2.Api2.getTrustees, null, api);
    await callApiFunction(api2.Api2.getTrustee, 'some-id', api);
    await callApiFunction(api2.Api2.getTrusteeHistory, 'some-id', api);
    await callApiFunction(api2.Api2.getBanks, null, api);
    await callApiFunction(api2.Api2.getBankruptcySoftwareList, null, api);
  });

  test('should call api.put function when calling putPrivilegedIdentityUser', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const action = { groups: ['some-group'], expires: '00-00-0000' };
    api2.Api2.putPrivilegedIdentityUser('some-id', action);
    expect(putSpy).toHaveBeenCalledWith(`/dev-tools/privileged-identity/some-id`, action, {});
  });

  test('should call postCaseNote api function', async () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: ['some-note'] });
    api2.Api2.postCaseNote({ caseId: 'some-id', title: 'some title', content: 'some note' });
    expect(postSpy).toHaveBeenCalled();
  });

  test('should call putCaseNote api function', async () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: ['some-note'] });
    api2.Api2.putCaseNote(
      MockData.getCaseNote({
        id: 'some-id',
        caseId: 'some-id',
        title: 'some title',
        content: 'some note',
      }),
    );
    expect(putSpy).toHaveBeenCalled();
  });

  test('should not call putCaseNote api function and handle error', async () => {
    const putSpy = vi.spyOn(api.default, 'put');
    await expect(
      api2.Api2.putCaseNote(
        MockData.getCaseNote({
          id: undefined as unknown as string,
          caseId: 'some-id',
          title: 'some title',
          content: 'some note',
        }),
      ),
    ).rejects.toThrow('Id must be provided');
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('should call http delete when deleteCaseNote api function is called', async () => {
    const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue();
    api2.Api2.deleteCaseNote({
      id: 'note-id',
      caseId: 'case-id',
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
      title,
      content: inputPassedThroughApi,
    });
    expect(postSpy).toHaveBeenCalledWith(path, { title, content: inputPassedThroughApi }, {});
  });

  test('should get through input title validation and call postCaseNote', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    const content = 'come content';
    const path = '/cases/some-id/notes';
    api2.Api2.postCaseNote({
      caseId: 'some-id',
      title: inputPassedThroughApi,
      content,
    });
    expect(postSpy).toHaveBeenCalledWith(path, { title: inputPassedThroughApi, content }, {});
  });

  test('should be rejected by input validation and not call postCaseNote', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    api2.Api2.postCaseNote({
      caseId: 'some-id',
      title: inputBlockedFromApi,
      content: inputBlockedFromApi,
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should not call post if sanitized values are empty', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    api2.Api2.postCaseNote({
      caseId: 'some-id',
      title: '<script>foo</script>',
      content: '<script>foo</script>',
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should not call putConsolidationOrderRejection functions with malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const baseOrder = MockData.getConsolidationOrder();
    const dirtyConsolidationOrder: ConsolidationOrderActionRejection = {
      ...baseOrder,
      rejectedCases: [baseOrder.childCases[0].caseId],
      reason: inputBlockedFromApi,
    };

    api2.Api2.putConsolidationOrderRejection(dirtyConsolidationOrder);
    expect(postSpy).not.toHaveBeenCalledWith();
  });

  test('should call putConsolidationOrderRejection functions with non-malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const path = '/consolidations/reject';
    const baseOrder = MockData.getConsolidationOrder();
    const dirtyConsolidationOrder: ConsolidationOrderActionRejection = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.childCases[0].caseId],
      reason: inputPassedThroughApi,
    };

    const cleanConsolidationOrder = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.childCases[0].caseId],
      reason: inputPassedThroughApi,
    };

    api2.Api2.putConsolidationOrderRejection(dirtyConsolidationOrder);
    expect(postSpy).toHaveBeenCalledWith(path, cleanConsolidationOrder, {});
  });

  test('should handle undefined reason in putConsolidationOrderRejection', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const path = '/consolidations/reject';
    const baseOrder = MockData.getConsolidationOrder();
    const consolidationOrderWithUndefinedReason: ConsolidationOrderActionRejection = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.childCases[0].caseId],
      reason: undefined,
    };

    const expectedOrderWithEmptyReason = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.childCases[0].caseId],
      reason: '',
    };

    api2.Api2.putConsolidationOrderRejection(consolidationOrderWithUndefinedReason);
    expect(putSpy).toHaveBeenCalledWith(path, expectedOrderWithEmptyReason, {});
  });

  test('should call patchTransferOrderRejection with purified malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: '' });
    const dirtyTransferOrder: TransferOrderActionRejection = {
      ...MockData.getTransferOrder(),
      status: 'rejected',
      reason: inputBlockedFromApi,
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
      status: 'rejected',
      reason: inputPassedThroughApi,
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
    await expect(api2.Api2.getTrustees()).rejects.toThrow(error);
    await expect(api2.Api2.getTrustee('trustee-id')).rejects.toThrow(error);
    await expect(api2.Api2.getTrusteeHistory('trustee-id')).rejects.toThrow(error);
    await expect(api2.Api2.getBanks()).rejects.toThrow(error);
    await expect(api2.Api2.getBankruptcySoftwareList()).rejects.toThrow(error);
    const mockOrder = MockData.getConsolidationOrder();
    await expect(
      api2.Api2.putConsolidationOrderApproval({
        consolidationId: mockOrder.consolidationId,
        consolidationType: 'administrative',
        approvedCases: [],
        leadCase: MockData.getCaseSummary(),
      }),
    ).rejects.toThrow(error);
  });

  test('should call api.post function when calling postTrustee', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: { id: 'trustee-id' } });
    const trusteeInput = MockData.getTrustee();
    api2.Api2.postTrustee(trusteeInput);
    expect(postSpy).toHaveBeenCalledWith('/trustees', trusteeInput, {});
  });

  test('should call api.patch function when calling patchTrustee', () => {
    const patchSpy = vi
      .spyOn(api.default, 'patch')
      .mockResolvedValue({ data: { id: 'trustee-id' } });
    const trusteeId = 'trustee-id';
    const trusteeInput = { name: 'Updated Trustee' };
    api2.Api2.patchTrustee(trusteeId, trusteeInput);
    expect(patchSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}`, trusteeInput, {});
  });

  test('should call api.get function when calling getTrustees', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: [{ id: 'trustee-id' }] });
    api2.Api2.getTrustees();
    expect(getSpy).toHaveBeenCalledWith('/trustees', {});
  });

  test('should call api.get function when calling getTrustee', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: { id: 'trustee-id' } });
    const trusteeId = 'trustee-id';
    api2.Api2.getTrustee(trusteeId);
    expect(getSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}`, {});
  });

  test('should call api.get function when calling getTrusteeHistory', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: [{ id: 'history-id' }] });
    const trusteeId = 'trustee-id';
    api2.Api2.getTrusteeHistory(trusteeId);
    expect(getSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}/history`, {});
  });

  test('should call api.get function when calling getBankruptcySoftwareList', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: { items: [] } });
    api2.Api2.getBankruptcySoftwareList();
    expect(getSpy).toHaveBeenCalledWith('/lists/bankruptcy-software', {});
  });

  test('should call api.get function when calling getBanks', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: { items: [] } });
    api2.Api2.getBanks();
    expect(getSpy).toHaveBeenCalledWith('/lists/banks', {});
  });

  test('should call api.post function when calling postBankruptcySoftware', () => {
    const postSpy = vi
      .spyOn(api.default, 'post')
      .mockResolvedValue({ data: { id: 'software-id' } });
    const softwareItem: Creatable<BankruptcySoftwareListItem> = {
      list: 'bankruptcy-software',
      key: 'Test Software',
      value: 'Test Software',
    };
    api2.Api2.postBankruptcySoftware(softwareItem);
    expect(postSpy).toHaveBeenCalledWith('/lists/bankruptcy-software', softwareItem, {});
  });

  test('should call api.delete function when calling deleteBankruptcySoftware', () => {
    const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue({ data: null });
    const softwareId = 'software-id';
    api2.Api2.deleteBankruptcySoftware(softwareId);
    expect(deleteSpy).toHaveBeenCalledWith(`/lists/bankruptcy-software/${softwareId}`, {});
  });

  test('should call api.post function when calling postBank', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: { id: 'bank-id' } });
    const bankItem: Creatable<BankListItem> = {
      list: 'banks' as const,
      key: 'Test Bank',
      value: 'Test Bank',
    };
    api2.Api2.postBank(bankItem);
    expect(postSpy).toHaveBeenCalledWith('/lists/banks', bankItem, {});
  });

  test('should call api.delete function when calling deleteBank', () => {
    const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue({ data: null });
    const bankId = 'bank-id';
    api2.Api2.deleteBank(bankId);
    expect(deleteSpy).toHaveBeenCalledWith(`/lists/banks/${bankId}`, {});
  });
});

describe('addAuthHeaderToApi', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/configuration/appConfiguration', async () => {
      return {
        default: () => ({
          ...blankConfiguration,
          useFakeApi: false,
        }),
      };
    });
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

function sum(...values: number[]) {
  return values.reduce((total, value) => {
    return total + value;
  }, 0);
}

async function callApiFunction<F extends (...args: unknown[]) => unknown>(
  fn: F,
  args: Parameters<F>[0] | undefined,
  api: ApiType,
) {
  const stuff = ['some stuff'];
  const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: stuff });
  const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: stuff });
  const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: stuff });
  const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: stuff });
  const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue({ data: stuff });
  await (fn as unknown as (...a: unknown[]) => unknown)(args as unknown);
  const spyCalls = sum(
    getSpy.mock.calls.length,
    patchSpy.mock.calls.length,
    postSpy.mock.calls.length,
    putSpy.mock.calls.length,
    deleteSpy.mock.calls.length,
  );
  expect(spyCalls).toEqual(1);
}
