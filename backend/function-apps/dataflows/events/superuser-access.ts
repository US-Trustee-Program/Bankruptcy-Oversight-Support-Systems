import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import { SUPERUSER_ACCESS_DLQ, SUPERUSER_ACCESS_QUEUE } from '../../../lib/storage-queues';
import { buildFunctionName, serializeError } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { UserAccessUseCase } from '../../../lib/use-cases/user-access/user-access';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { BadRequestError } from '../../../lib/common-errors/bad-request';
import { SuperUserAccessMessage } from '@common/cams/dataflow-events';
import { CamsRole } from '@common/cams/roles';
import { ALL_SCOPE } from '@common/cams/user-access';

const MODULE_NAME = ModuleNames.SUPERUSER_ACCESS;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

/** The one log line per message that operators and the Azure DevOps step search for by runId. */
const OUTCOME_LOG = 'SUPERUSER_ACCESS_OUTCOME';

type Outcome =
  'granted' | 'already-held' | 'revoked' | 'nothing-to-revoke' | 'rejected' | 'invalid' | 'failed';

const SUCCESSFUL_OUTCOMES: Outcome[] = ['granted', 'already-held', 'revoked', 'nothing-to-revoke'];

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidMessage(message: unknown): message is SuperUserAccessMessage {
  if (typeof message !== 'object' || message === null) return false;
  const { action, userId, runId, requestedBy } = message as Record<string, unknown>;
  return (
    (action === 'grant' || action === 'revoke') &&
    isNonBlankString(userId) &&
    isNonBlankString(runId) &&
    isNonBlankString(requestedBy)
  );
}

const LOGGED_FIELDS = ['runId', 'action', 'userId', 'requestedBy'] as const;

/**
 * The message's string fields, for the outcome log. Taken even from an invalid message, so a
 * malformed request can still be found by its runId.
 */
function loggedFields(message: unknown): Partial<Record<(typeof LOGGED_FIELDS)[number], string>> {
  if (typeof message !== 'object' || message === null) return {};
  const record = message as Record<string, unknown>;
  return Object.fromEntries(
    LOGGED_FIELDS.filter((key) => typeof record[key] === 'string').map((key) => [key, record[key]]),
  );
}

/**
 * Grants or revokes an unscoped Super User through UserAccessUseCase, so the change gets the same
 * checks and audit records as a grant from the Permissions screen. Started only by a message on
 * its queue (no HTTP trigger: dataflows are invoked through queues). A rejected request is final;
 * an unexpected failure goes to the DLQ, and the operator sends the message again.
 */
async function handler(message: SuperUserAccessMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const fields = loggedFields(message);
  let outcome: Outcome;
  let reason: string | undefined;

  if (!isValidMessage(message)) {
    outcome = 'invalid';
    invocationContext.extraOutputs.set(SUPERUSER_ACCESS_DLQ, { message });
  } else {
    const useCase = new UserAccessUseCase(context);
    const request = {
      userId: message.userId,
      role: CamsRole.SuperUser,
      regionId: ALL_SCOPE,
      officeCode: ALL_SCOPE,
    };
    const performer = {
      id: 'SYSTEM_PIPELINE',
      name: `Pipeline (requested by ${message.requestedBy.trim()})`,
    };
    try {
      if (message.action === 'grant') {
        const { created } = await useCase.grantPermission(context, request, performer);
        outcome = created ? 'granted' : 'already-held';
      } else {
        const { revoked } = await useCase.revokePermission(context, request, performer);
        outcome = revoked ? 'revoked' : 'nothing-to-revoke';
      }
    } catch (error) {
      if (error instanceof BadRequestError) {
        outcome = 'rejected';
        reason = error.message;
      } else {
        outcome = 'failed';
        const serialized = serializeError(error);
        context.logger.error(
          MODULE_NAME,
          `Super User ${message.action} failed: ${serialized.message}`,
          fields,
        );
        invocationContext.extraOutputs.set(SUPERUSER_ACCESS_DLQ, { message, error: serialized });
      }
    }
  }

  context.logger.info(MODULE_NAME, OUTCOME_LOG, {
    ...fields,
    outcome,
    ...(reason ? { reason } : {}),
  });

  const changed = outcome === 'granted' || outcome === 'revoked';
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handler', context.logger, {
    documentsWritten: changed ? 1 : 0,
    documentsFailed: outcome === 'failed' ? 1 : 0,
    success: SUCCESSFUL_OUTCOMES.includes(outcome),
    details: {
      action: fields.action ?? '',
      outcome,
      runId: fields.runId ?? '',
    },
  });
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: SUPERUSER_ACCESS_QUEUE.connection,
    queueName: SUPERUSER_ACCESS_QUEUE.queueName,
    handler,
    extraOutputs: [SUPERUSER_ACCESS_DLQ],
  });
}

const SuperUserAccess = {
  MODULE_NAME,
  setup,
};

export { handler };
export default SuperUserAccess;
