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
import { BankProfile } from '@common/cams/banks';

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
  default: typeof Api2;
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
    await callApiFunction(api2.default.getOversightStaff, null, api);
    await callApiFunction(api2.default.getCaseAssignments, 'some-id', api);
    await callApiFunction(api2.default.getCaseAssociations, 'some-id', api);
    await callApiFunction(api2.default.getCaseDetail, 'some-id', api);
    await callApiFunction(api2.default.getCaseDocket, 'some-id', api);
    await callApiFunction(api2.default.getCaseHistory, 'some-id', api);
    await callApiFunction(api2.default.getCaseSummary, 'some-id', api);
    await callApiFunction(api2.default.getCourts, null, api);
    await callApiFunction(api2.default.getMe, null, api);
    await callApiFunction(api2.default.getOffices, null, api);
    await callApiFunction(api2.default.getOfficeAttorneys, null, api);
    await callApiFunction(api2.default.getOfficeAssignees, null, api);
    await callApiFunction(api2.default.getOrders, null, api);
    await callApiFunction(api2.default.getOrderSuggestions, 'some-id', api);
    await callApiFunction(api2.default.putConsolidationOrderApproval, 'some-id', api);
    await callApiFunction(api2.default.searchCases, 'some-id', api);
    await callApiFunction(api2.default.getCaseNotes, 'some-id', api);
    await callApiFunction(api2.default.getPrivilegedIdentityUsers, null, api);
    await callApiFunction(api2.default.getPrivilegedIdentityUser, 'some-id', api);
    await callApiFunction(api2.default.deletePrivilegedIdentityUser, 'some-id', api);
    await callApiFunction(api2.default.getRoleAndOfficeGroupNames, 'some-id', api);
    await callApiFunction(api2.default.getTrustees, null, api);
    await callApiFunction(api2.default.getTrustee, 'some-id', api);
    await callApiFunction(api2.default.getTrusteeHistory, 'some-id', api);
    await callApiFunction(api2.default.getTrusteeAppointments, 'some-id', api);
    await callApiFunction(api2.default.getTrusteeOversightAssignments, 'some-id', api);
    await callApiFunction(api2.default.getBanks, null, api);
    await callApiFunction(api2.default.getSoftwareList, null, api);
    await callApiFunction(api2.default.getSoftware, 'sw-1', api);
    await callApiFunction(api2.default.getNotificationRouting, null, api);
  });

  test('should call api.put function when calling updateNotificationRouting', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    api2.default.updateNotificationRouting('chapter-7-oversight', {
      recipientAddresses: ['test@example.com'],
    });
    expect(putSpy).toHaveBeenCalledWith(
      '/dev-tools/notification-routing/chapter-7-oversight',
      { recipientAddresses: ['test@example.com'] },
      {},
    );
  });

  test('should call api.put function when calling putPrivilegedIdentityUser', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const action = { groups: ['some-group'], expires: '00-00-0000' };
    api2.default.putPrivilegedIdentityUser('some-id', action);
    expect(putSpy).toHaveBeenCalledWith(`/dev-tools/privileged-identity/some-id`, action, {});
  });

  test('should call postCaseNote api function', async () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: ['some-note'] });
    api2.default.postCaseNote({ caseId: 'some-id', title: 'some title', content: 'some note' });
    expect(postSpy).toHaveBeenCalled();
  });

  test('should call putCaseNote api function', async () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: ['some-note'] });
    api2.default.putCaseNote(
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
      api2.default.putCaseNote(
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
    api2.default.deleteCaseNote({
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
    api2.default.postCaseNote({
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
    api2.default.postCaseNote({
      caseId: 'some-id',
      title: inputPassedThroughApi,
      content,
    });
    expect(postSpy).toHaveBeenCalledWith(path, { title: inputPassedThroughApi, content }, {});
  });

  test('should be rejected by input validation and not call postCaseNote', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    api2.default.postCaseNote({
      caseId: 'some-id',
      title: inputBlockedFromApi,
      content: inputBlockedFromApi,
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should not call post if sanitized values are empty', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    api2.default.postCaseNote({
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
      rejectedCases: [baseOrder.memberCases[0].caseId],
      reason: inputBlockedFromApi,
    };

    api2.default.putConsolidationOrderRejection(dirtyConsolidationOrder);
    expect(postSpy).not.toHaveBeenCalledWith();
  });

  test('should call putConsolidationOrderRejection functions with non-malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const path = '/consolidations/reject';
    const baseOrder = MockData.getConsolidationOrder();
    const dirtyConsolidationOrder: ConsolidationOrderActionRejection = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.memberCases[0].caseId],
      reason: inputPassedThroughApi,
    };

    const cleanConsolidationOrder = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.memberCases[0].caseId],
      reason: inputPassedThroughApi,
    };

    api2.default.putConsolidationOrderRejection(dirtyConsolidationOrder);
    expect(postSpy).toHaveBeenCalledWith(path, cleanConsolidationOrder, {});
  });

  test('should handle undefined reason in putConsolidationOrderRejection', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: '' });
    const path = '/consolidations/reject';
    const baseOrder = MockData.getConsolidationOrder();
    const consolidationOrderWithUndefinedReason: ConsolidationOrderActionRejection = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.memberCases[0].caseId],
      reason: undefined,
    };

    const expectedOrderWithEmptyReason = {
      consolidationId: baseOrder.consolidationId,
      rejectedCases: [baseOrder.memberCases[0].caseId],
      reason: '',
    };

    api2.default.putConsolidationOrderRejection(consolidationOrderWithUndefinedReason);
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
    api2.default.patchTransferOrderRejection(dirtyTransferOrder);
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

    api2.default.patchTransferOrderRejection(transferOrder);
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
    await api2.default.postStaffAssignments(assignmentAction);
    expect(postSpy).toHaveBeenCalled();

    const patchSpy = vi.spyOn(api.default, 'patch').mockImplementation(() => {
      return Promise.resolve();
    });
    const approval: TransferOrderAction = {
      id: randomUUID(),
      caseId: MockData.randomCaseId(),
      taskType: 'transfer',
      newCase: MockData.getCaseSummary(),
      status: 'approved',
    };
    await api2.default.patchTransferOrderApproval(approval);
    expect(patchSpy).toHaveBeenCalled();
  });

  test('should handle error properly', async () => {
    const error = new Error('Not Found');
    vi.spyOn(api.default, 'get').mockRejectedValue(error);
    vi.spyOn(api.default, 'patch').mockRejectedValue(error);
    vi.spyOn(api.default, 'post').mockRejectedValue(error);
    vi.spyOn(api.default, 'put').mockRejectedValue(error);
    vi.spyOn(api.default, 'delete').mockRejectedValue(error);
    await expect(api2.default.getOversightStaff()).rejects.toThrow(error);
    await expect(api2.default.patchTransferOrderApproval({})).rejects.toThrow(error);
    await expect(
      api2.default.patchTransferOrderRejection({ reason: 'some-string' }),
    ).rejects.toThrow(error);
    await expect(api2.default.searchCases({})).rejects.toThrow(error);
    await expect(api2.default.deletePrivilegedIdentityUser('userId')).rejects.toThrow(error);
    await expect(api2.default.getTrustees()).rejects.toThrow(error);
    await expect(api2.default.getTrustee('trustee-id')).rejects.toThrow(error);
    await expect(api2.default.getTrusteeHistory('trustee-id')).rejects.toThrow(error);
    await expect(api2.default.getTrusteeOversightAssignments('trustee-id')).rejects.toThrow(error);
    await expect(
      api2.default.createTrusteeOversightAssignment(
        'trustee-id',
        'user-id',
        CamsRole.OversightAttorney,
      ),
    ).rejects.toThrow(error);
    await expect(api2.default.getBanks()).rejects.toThrow(error);
    await expect(api2.default.getSoftwareList()).rejects.toThrow(error);
    await expect(api2.default.getSoftware('sw-1')).rejects.toThrow(error);
    const mockOrder = MockData.getConsolidationOrder();
    await expect(
      api2.default.putConsolidationOrderApproval({
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
    api2.default.postTrustee(trusteeInput);
    expect(postSpy).toHaveBeenCalledWith('/trustees', trusteeInput, {});
  });

  test('should call api.patch function when calling patchTrustee', () => {
    const patchSpy = vi
      .spyOn(api.default, 'patch')
      .mockResolvedValue({ data: { id: 'trustee-id' } });
    const trusteeId = 'trustee-id';
    const trusteeInput = { firstName: 'Updated' };
    api2.default.patchTrustee(trusteeId, trusteeInput);
    expect(patchSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}`, trusteeInput, {});
  });

  test('should call api.patch with approve action when calling patchTrusteeVerificationOrderApproval', () => {
    const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValue(undefined);
    const id = 'verification-order-id';
    const resolvedTrusteeId = 'trustee-1';
    api2.default.patchTrusteeVerificationOrderApproval(id, resolvedTrusteeId);
    expect(patchSpy).toHaveBeenCalledWith(
      `/trustee-match-verification/${id}`,
      { action: 'approve', resolvedTrusteeId },
      {},
    );
  });

  test('should call api.patch with reject action and reason when calling patchTrusteeVerificationOrderRejection', () => {
    const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValue(undefined);
    const id = 'verification-order-id';
    const reason = 'Not the right person';
    api2.default.patchTrusteeVerificationOrderRejection(id, reason);
    expect(patchSpy).toHaveBeenCalledWith(
      `/trustee-match-verification/${id}`,
      { action: 'reject', reason },
      {},
    );
  });

  test('should call api.patch with reject action and undefined reason when calling patchTrusteeVerificationOrderRejection without reason', () => {
    const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValue(undefined);
    const id = 'verification-order-id';
    api2.default.patchTrusteeVerificationOrderRejection(id);
    expect(patchSpy).toHaveBeenCalledWith(
      `/trustee-match-verification/${id}`,
      { action: 'reject', reason: undefined },
      {},
    );
  });

  test('should call api.get function when calling getTrustees', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: [{ id: 'trustee-id' }] });
    api2.default.getTrustees();
    expect(getSpy).toHaveBeenCalledWith('/trustees', {});
  });

  test('should call api.get function when calling getTrustee', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: { id: 'trustee-id' } });
    const trusteeId = 'trustee-id';
    api2.default.getTrustee(trusteeId);
    expect(getSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}`, {});
  });

  test('should call api.get function when calling getTrusteeHistory', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: [{ id: 'history-id' }] });
    const trusteeId = 'trustee-id';
    api2.default.getTrusteeHistory(trusteeId);
    expect(getSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}/history`, {});
  });

  test('should call api.get function when calling getTrusteeAppointments', () => {
    const getSpy = vi
      .spyOn(api.default, 'get')
      .mockResolvedValue({ data: [{ id: 'appointment-id' }] });
    const trusteeId = 'trustee-id';
    api2.default.getTrusteeAppointments(trusteeId);
    expect(getSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}/appointments`, {});
  });

  test('should call api.put function when calling putTrusteeAppointment', () => {
    const putSpy = vi
      .spyOn(api.default, 'put')
      .mockResolvedValue({ data: { id: 'appointment-id' } });
    const trusteeId = 'trustee-id';
    const appointmentId = 'appointment-id';
    const appointmentInput = MockData.getTrusteeAppointment();
    api2.default.putTrusteeAppointment(trusteeId, appointmentId, appointmentInput);
    expect(putSpy).toHaveBeenCalledWith(
      `/trustees/${trusteeId}/appointments/${appointmentId}`,
      appointmentInput,
      {},
    );
  });

  test('should call api.get function when calling getTrusteeOversightAssignments', () => {
    const getSpy = vi
      .spyOn(api.default, 'get')
      .mockResolvedValue({ data: [{ id: 'assignment-id' }] });
    const trusteeId = 'trustee-id';
    api2.default.getTrusteeOversightAssignments(trusteeId);
    expect(getSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}/oversight-assignments`, {});
  });

  test('should call api.post function when calling createTrusteeOversightAssignment', () => {
    const postSpy = vi
      .spyOn(api.default, 'post')
      .mockResolvedValue({ data: { id: 'assignment-id' } });
    const trusteeId = 'trustee-id';
    const userId = 'user-id';
    const role = CamsRole.OversightAttorney;
    api2.default.createTrusteeOversightAssignment(trusteeId, userId, role);
    expect(postSpy).toHaveBeenCalledWith(
      `/trustees/${trusteeId}/oversight-assignments`,
      { userId, role },
      {},
    );
  });

  test('should call api.get function when calling getSoftwareList', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: [] });
    api2.default.getSoftwareList();
    expect(getSpy).toHaveBeenCalledWith('/bankruptcy-software', {});
  });

  test('should call api.post function when calling createSoftware', () => {
    const postSpy = vi
      .spyOn(api.default, 'post')
      .mockResolvedValue({ data: { id: 'software-id' } });
    api2.default.createSoftware({ name: 'Test Software' });
    expect(postSpy).toHaveBeenCalledWith('/bankruptcy-software', { name: 'Test Software' }, {});
  });

  test('should call api.get function when calling getSoftware', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: {} });
    api2.default.getSoftware('sw-1');
    expect(getSpy).toHaveBeenCalledWith('/bankruptcy-software/sw-1', {});
  });

  test('should call api.put function when calling updateSoftware', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: {} });
    api2.default.updateSoftware('sw-1', { name: 'Updated', status: 'inactive' });
    expect(putSpy).toHaveBeenCalledWith(
      '/bankruptcy-software/sw-1',
      { name: 'Updated', status: 'inactive' },
      {},
    );
  });

  test('should call api.get function when calling getBanks', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: { items: [] } });
    api2.default.getBanks();
    expect(getSpy).toHaveBeenCalledWith('/banks', {});
  });

  test('should call api.post function when calling createBank', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: {} });
    const bank: Pick<BankProfile, 'name'> = { name: 'Test Bank' };
    api2.default.createBank(bank);
    expect(postSpy).toHaveBeenCalledWith('/banks', bank, {});
  });

  test('should call api.get function when calling getBank', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: {} });
    api2.default.getBank('bank-1');
    expect(getSpy).toHaveBeenCalledWith('/banks/bank-1', {});
  });

  test('should call api.put function when calling updateBank', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: {} });
    const update = { name: 'Updated', status: 'inactive' as const };
    api2.default.updateBank('bank-1', update);
    expect(putSpy).toHaveBeenCalledWith('/banks/bank-1', update, {});
  });

  test('should call api.get when calling getTrusteeNotes', () => {
    const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: [] });
    const trusteeId = 'trustee-id';
    api2.default.getTrusteeNotes(trusteeId);
    expect(getSpy).toHaveBeenCalledWith(`/trustees/${trusteeId}/notes`, {});
  });

  test('should call api.post when calling postTrusteeNote with valid input', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    const note = MockData.getTrusteeNote({
      trusteeId: 'trustee-id',
      title: inputPassedThroughApi,
      content: inputPassedThroughApi,
    });
    api2.default.postTrusteeNote(note);
    expect(postSpy).toHaveBeenCalledWith(
      `/trustees/${note.trusteeId}/notes`,
      { title: note.title, content: note.content },
      {},
    );
  });

  test('should not call api.post when calling postTrusteeNote with malicious input', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    const note = MockData.getTrusteeNote({
      trusteeId: 'trustee-id',
      title: inputBlockedFromApi,
      content: inputBlockedFromApi,
    });
    api2.default.postTrusteeNote(note);
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should not call api.post when calling postTrusteeNote with script-only input that sanitizes to empty', () => {
    const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: '' });
    const note = MockData.getTrusteeNote({
      trusteeId: 'trustee-id',
      title: '<script>foo</script>',
      content: '<script>foo</script>',
    });
    api2.default.postTrusteeNote(note);
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should call api.put when calling putTrusteeNote with valid input', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: [{ id: 'note-id' }] });
    const note = MockData.getTrusteeNote({
      id: 'note-id',
      trusteeId: 'trustee-id',
      title: inputPassedThroughApi,
      content: inputPassedThroughApi,
    });
    api2.default.putTrusteeNote(note);
    expect(putSpy).toHaveBeenCalledWith(
      `/trustees/${note.trusteeId}/notes/${note.id}`,
      { title: note.title, content: note.content, updatedBy: note.updatedBy },
      {},
    );
  });

  test('should throw when calling putTrusteeNote without an id', async () => {
    const putSpy = vi.spyOn(api.default, 'put');
    const note = MockData.getTrusteeNote({
      id: undefined as unknown as string,
      trusteeId: 'trustee-id',
      title: inputPassedThroughApi,
      content: inputPassedThroughApi,
    });
    await expect(api2.default.putTrusteeNote(note)).rejects.toThrow('Id must be provided');
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('should not call api.put when calling putTrusteeNote with malicious input', () => {
    const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: [{ id: 'note-id' }] });
    const note = MockData.getTrusteeNote({
      id: 'note-id',
      trusteeId: 'trustee-id',
      title: inputBlockedFromApi,
      content: inputBlockedFromApi,
    });
    api2.default.putTrusteeNote(note);
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('should call api.delete when calling deleteTrusteeNote', () => {
    const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue();
    const note = MockData.getTrusteeNote({ id: 'note-id', trusteeId: 'trustee-id' });
    api2.default.deleteTrusteeNote(note);
    expect(deleteSpy).toHaveBeenCalledWith(`/trustees/${note.trusteeId}/notes/${note.id}`, {});
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

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function callApiFunction(fn: (args: any) => unknown, args: unknown, api: ApiType) {
  const stuff = ['some stuff'];
  const getSpy = vi.spyOn(api.default, 'get').mockResolvedValue({ data: stuff });
  const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValue({ data: stuff });
  const postSpy = vi.spyOn(api.default, 'post').mockResolvedValue({ data: stuff });
  const putSpy = vi.spyOn(api.default, 'put').mockResolvedValue({ data: stuff });
  const deleteSpy = vi.spyOn(api.default, 'delete').mockResolvedValue({ data: stuff });
  try {
    await fn(args);
    const spyCalls = sum(
      getSpy.mock.calls.length,
      patchSpy.mock.calls.length,
      postSpy.mock.calls.length,
      putSpy.mock.calls.length,
      deleteSpy.mock.calls.length,
    );
    expect(spyCalls).toEqual(1);
  } finally {
    // Restore spies after each call to prevent accumulation within the test
    // Use finally to ensure cleanup even if the test throws
    getSpy.mockRestore();
    patchSpy.mockRestore();
    postSpy.mockRestore();
    putSpy.mockRestore();
    deleteSpy.mockRestore();
  }
}
