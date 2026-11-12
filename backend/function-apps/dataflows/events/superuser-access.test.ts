import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { UserAccessUseCase } from '../../../lib/use-cases/user-access/user-access';
import { SUPERUSER_ACCESS_DLQ } from '../../../lib/storage-queues';
import { BadRequestError } from '../../../lib/common-errors/bad-request';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { SuperUserAccessMessage } from '@common/cams/dataflow-events';
import { CamsRole } from '@common/cams/roles';
import { UserRoleAssignment } from '@common/cams/user-access';
import { handler } from './superuser-access';

const permission: UserRoleAssignment = {
  documentType: 'USER_ROLE_ASSIGNMENT',
  id: 'assignment-1',
  userId: '00uabc1234567890abcd',
  userName: 'Alice Adams',
  role: CamsRole.SuperUser,
  regionId: null,
  officeCode: null,
  assignedBy: 'SYSTEM_PIPELINE',
  assignedByName: 'Pipeline (requested by Jane Doe)',
  assignedAt: '2026-11-12T00:00:00.000Z',
  expiresAt: null,
  active: true,
  activeKey: 'SuperUser|*|*',
};

const grantMessage: SuperUserAccessMessage = {
  action: 'grant',
  userId: '00uabc1234567890abcd',
  runId: 'run-42',
  requestedBy: 'Jane Doe',
};
const revokeMessage: SuperUserAccessMessage = { ...grantMessage, action: 'revoke' };
const messageFor = (action: 'grant' | 'revoke') =>
  action === 'grant' ? grantMessage : revokeMessage;

const superUserRequest = {
  userId: '00uabc1234567890abcd',
  role: CamsRole.SuperUser,
  regionId: 'all',
  officeCode: 'all',
};
const pipelinePerformer = { id: 'SYSTEM_PIPELINE', name: 'Pipeline (requested by Jane Doe)' };

function expectedOutcomeLog(message: SuperUserAccessMessage, outcome: string, reason?: string) {
  return {
    runId: message.runId,
    action: message.action,
    userId: message.userId,
    requestedBy: message.requestedBy,
    outcome,
    ...(reason ? { reason } : {}),
  };
}

function makeInvocationContext(): InvocationContext {
  return {
    invocationId: 'test-id',
    functionName: 'superuser-access-handler',
    extraOutputs: new Map(),
    log: vi.fn(),
  } as unknown as InvocationContext;
}

describe('superuser-access handler', () => {
  let context: ApplicationContext;
  let invocationContext: InvocationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    invocationContext = makeInvocationContext();
  });

  function outcomeLog(infoSpy: ReturnType<typeof vi.spyOn>) {
    const calls = infoSpy.mock.calls.filter(
      ([, message]) => message === 'SUPERUSER_ACCESS_OUTCOME',
    );
    expect(calls).toHaveLength(1);
    return calls[0][2];
  }

  // The DLQ output is serialised to JSON on the real queue, so assert what survives that.
  const dlqAsQueued = () =>
    JSON.parse(JSON.stringify(invocationContext.extraOutputs.get(SUPERUSER_ACCESS_DLQ) ?? null));

  function spyOnUseCase() {
    return {
      grantSpy: vi
        .spyOn(UserAccessUseCase.prototype, 'grantPermission')
        .mockResolvedValue({ result: { permission, replaced: [] }, created: true }),
      revokeSpy: vi
        .spyOn(UserAccessUseCase.prototype, 'revokePermission')
        .mockResolvedValue({ revoked: { ...permission, active: false } }),
    };
  }

  test.each([
    { caseName: 'a new grant', created: true, outcome: 'granted' },
    { caseName: 'a Super User the user already holds', created: false, outcome: 'already-held' },
  ])('should grant Super User and log $outcome for $caseName', async ({ created, outcome }) => {
    const { grantSpy } = spyOnUseCase();
    grantSpy.mockResolvedValue({ result: { permission, replaced: [] }, created });
    const infoSpy = vi.spyOn(context.logger, 'info');

    await handler(grantMessage, invocationContext);

    expect(grantSpy).toHaveBeenCalledWith(context, superUserRequest, pipelinePerformer);
    expect(outcomeLog(infoSpy)).toEqual(expectedOutcomeLog(grantMessage, outcome));
    expect(dlqAsQueued()).toBeNull();
  });

  test.each([
    {
      caseName: 'a held Super User',
      revoked: { ...permission, active: false },
      outcome: 'revoked',
    },
    { caseName: 'no Super User', revoked: null, outcome: 'nothing-to-revoke' },
  ])('should revoke Super User and log $outcome for $caseName', async ({ revoked, outcome }) => {
    const { revokeSpy } = spyOnUseCase();
    revokeSpy.mockResolvedValue({ revoked });
    const infoSpy = vi.spyOn(context.logger, 'info');

    await handler(revokeMessage, invocationContext);

    expect(revokeSpy).toHaveBeenCalledWith(context, superUserRequest, pipelinePerformer);
    expect(outcomeLog(infoSpy)).toEqual(expectedOutcomeLog(revokeMessage, outcome));
    expect(dlqAsQueued()).toBeNull();
  });

  test('should trim requestedBy in the performer name', async () => {
    const { grantSpy } = spyOnUseCase();

    await handler({ ...grantMessage, requestedBy: '  Jane Doe ' }, invocationContext);

    expect(grantSpy).toHaveBeenCalledWith(context, superUserRequest, pipelinePerformer);
  });

  test.each(['grant', 'revoke'] as const)(
    'should log a %s the use case rejects as rejected, with the reason, and not send it to the DLQ',
    async (action) => {
      const { grantSpy, revokeSpy } = spyOnUseCase();
      const rejection = new BadRequestError('USER-ACCESS-USE-CASE', {
        message: 'The user is not a CAMS user.',
      });
      (action === 'grant' ? grantSpy : revokeSpy).mockRejectedValue(rejection);
      const infoSpy = vi.spyOn(context.logger, 'info');

      await handler(messageFor(action), invocationContext);

      expect(outcomeLog(infoSpy)).toEqual(
        expectedOutcomeLog(messageFor(action), 'rejected', 'The user is not a CAMS user.'),
      );
      expect(dlqAsQueued()).toBeNull();
    },
  );

  test.each(['grant', 'revoke'] as const)(
    'should log a %s that fails as failed, log the error and send the message and error to the DLQ',
    async (action) => {
      const { grantSpy, revokeSpy } = spyOnUseCase();
      (action === 'grant' ? grantSpy : revokeSpy).mockRejectedValue(
        new Error('cosmos unavailable'),
      );
      const infoSpy = vi.spyOn(context.logger, 'info');
      const errorSpy = vi.spyOn(context.logger, 'error');

      await handler(messageFor(action), invocationContext);

      expect(outcomeLog(infoSpy)).toEqual(expectedOutcomeLog(messageFor(action), 'failed'));
      expect(errorSpy).toHaveBeenCalledWith(
        'SUPERUSER-ACCESS',
        expect.stringContaining('cosmos unavailable'),
        expect.objectContaining({ runId: 'run-42' }),
      );
      expect(dlqAsQueued()).toEqual({
        message: messageFor(action),
        error: expect.objectContaining({ name: 'Error', message: 'cosmos unavailable' }),
      });
    },
  );

  test('should still log, trace and dead-letter when the use case rejects with a non-Error value', async () => {
    const { grantSpy } = spyOnUseCase();
    grantSpy.mockRejectedValue(undefined);
    const infoSpy = vi.spyOn(context.logger, 'info');
    const traceSpy = vi.spyOn(context.observability, 'completeTrace');

    await handler(grantMessage, invocationContext);

    expect(outcomeLog(infoSpy)).toEqual(expectedOutcomeLog(grantMessage, 'failed'));
    expect(dlqAsQueued()).toEqual({ message: grantMessage, error: { message: 'undefined' } });
    expect(traceSpy).toHaveBeenCalledTimes(1);
  });

  test.each([
    { caseName: 'a string', message: 'grant 00uabc1234567890abcd', logged: {} },
    { caseName: 'null', message: null, logged: {} },
    {
      caseName: 'an unknown action',
      message: { ...grantMessage, action: 'delete' },
      logged: { ...grantMessage, action: 'delete' },
    },
    {
      caseName: 'a missing userId',
      message: { ...grantMessage, userId: undefined },
      logged: { action: 'grant', runId: 'run-42', requestedBy: 'Jane Doe' },
    },
    {
      caseName: 'a blank userId',
      message: { ...grantMessage, userId: '  ' },
      logged: { ...grantMessage, userId: '  ' },
    },
    {
      caseName: 'a missing runId',
      message: { ...grantMessage, runId: undefined },
      logged: { action: 'grant', userId: grantMessage.userId, requestedBy: 'Jane Doe' },
    },
    {
      caseName: 'a blank requestedBy',
      message: { ...grantMessage, requestedBy: ' ' },
      logged: { ...grantMessage, requestedBy: ' ' },
    },
    {
      caseName: 'a non-string requestedBy',
      message: { ...grantMessage, requestedBy: 7 },
      logged: { action: 'grant', userId: grantMessage.userId, runId: 'run-42' },
    },
  ])(
    'should change nothing, log invalid with the fields it has and send $caseName to the DLQ',
    async ({ message, logged }) => {
      const { grantSpy, revokeSpy } = spyOnUseCase();
      const infoSpy = vi.spyOn(context.logger, 'info');

      await handler(message as unknown as SuperUserAccessMessage, invocationContext);

      expect(grantSpy).not.toHaveBeenCalled();
      expect(revokeSpy).not.toHaveBeenCalled();
      expect(outcomeLog(infoSpy)).toEqual({ ...logged, outcome: 'invalid' });
      expect(dlqAsQueued()).toEqual({ message });
    },
  );

  describe('the dataflow trace', () => {
    const rejection = new BadRequestError('USER-ACCESS-USE-CASE', { message: 'No.' });
    test.each([
      {
        outcome: 'granted',
        message: grantMessage,
        created: true,
        written: 1,
        failed: 0,
        success: true,
      },
      {
        outcome: 'already-held',
        message: grantMessage,
        created: false,
        written: 0,
        failed: 0,
        success: true,
      },
      {
        outcome: 'revoked',
        message: revokeMessage,
        revoked: permission,
        written: 1,
        failed: 0,
        success: true,
      },
      {
        outcome: 'nothing-to-revoke',
        message: revokeMessage,
        revoked: null,
        written: 0,
        failed: 0,
        success: true,
      },
      {
        outcome: 'rejected',
        message: grantMessage,
        error: rejection,
        written: 0,
        failed: 0,
        success: false,
      },
      {
        outcome: 'failed',
        message: grantMessage,
        error: new Error('boom'),
        written: 0,
        failed: 1,
        success: false,
      },
      { outcome: 'invalid', message: { runId: 'run-42' }, written: 0, failed: 0, success: false },
    ])(
      'should record $outcome with its counts and success $success',
      async ({ outcome, message, created, revoked, error, written, failed, success }) => {
        const { grantSpy, revokeSpy } = spyOnUseCase();
        if (created !== undefined) {
          grantSpy.mockResolvedValue({ result: { permission, replaced: [] }, created });
        }
        if (revoked !== undefined) revokeSpy.mockResolvedValue({ revoked });
        if (error) grantSpy.mockRejectedValue(error);
        const traceSpy = vi.spyOn(context.observability, 'completeTrace');

        await handler(message as SuperUserAccessMessage, invocationContext);

        expect(traceSpy).toHaveBeenCalledTimes(1);
        expect(traceSpy).toHaveBeenCalledWith(
          expect.anything(),
          'DataflowHandlerComplete',
          expect.objectContaining({
            success,
            properties: expect.objectContaining({
              moduleName: 'SUPERUSER-ACCESS',
              action: (message as SuperUserAccessMessage).action ?? '',
              outcome,
              runId: 'run-42',
            }),
            measurements: { documentsWritten: written, documentsFailed: failed },
          }),
          expect.any(Array),
          context.logger,
        );
      },
    );
  });
});
