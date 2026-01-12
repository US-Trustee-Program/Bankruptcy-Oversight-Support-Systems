import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentUseCase } from '../../use-cases/case-assignment/case-assignment';
import { AssignmentError } from '../../use-cases/case-assignment/assignment.exception';
import { CaseAssignment } from '@common/cams/assignments';
import { CamsUserReference } from '@common/cams/users';
import { AssignableRole } from '@common/cams/roles';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { VALID_CASEID_PATTERN } from '@common/cams/cases';

const MODULE_NAME = 'ASSIGNMENT-CONTROLLER';
const INVALID_ROLE_MESSAGE = 'The provided role is not an assignable role.';
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 01-12345.';

export class CaseAssignmentController implements CamsController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit | CamsHttpResponseInit<CaseAssignment[]>> {
    try {
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      if (context.request.method === 'POST') {
        this.validateRequestParameters(
          context.request.body['caseId'],
          context.request.body['role'],
        );
        await assignmentUseCase.createTrialAttorneyAssignments(
          context,
          context.request.body['caseId'],
          context.request.body['attorneyList'] as CamsUserReference[],
          context.request.body['role'],
        );
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else {
        const assignmentsMap = await assignmentUseCase.findAssignmentsByCaseId([
          context.request.params['id'],
        ]);
        const assignments = assignmentsMap.get(context.request.params['id']);
        return httpSuccess({
          body: {
            data: assignments,
          },
        });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  private validateRequestParameters(caseId: string, role: string) {
    const badParams = [];
    const messages = [];
    if (!caseId) {
      badParams.push('caseId');
    } else if (!caseId.match(VALID_CASEID_PATTERN)) {
      messages.push(INVALID_CASEID_MESSAGE);
    }
    if (!role) {
      badParams.push('role');
    } else if (!(role in AssignableRole)) {
      messages.push(INVALID_ROLE_MESSAGE);
    }
    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      throw new AssignmentError(MODULE_NAME, { message: messages.join(' ') });
    }
  }
}
