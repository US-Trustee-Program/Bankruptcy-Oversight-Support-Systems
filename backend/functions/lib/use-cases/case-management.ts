import { ApplicationContext } from '../adapters/types/basic';
import {
  CaseDetailsDbResult,
  CaseListDbResult,
  CaseDetailInterface,
} from '../adapters/types/cases';
import { getCasesGateway } from '../factory';
import { CasesInterface } from './cases.interface';
import { CaseAssignmentUseCase } from './case.assignment';
import { UnknownError } from '../common-errors/unknown-error';
import { CamsError } from '../common-errors/cams-error';
import { AssignmentError } from './assignment.exception';
import { getOffice } from '../adapters/gateways/offices.gateway';
import { CaseAssignment } from '../adapters/types/case.assignment';

const MODULE_NAME = 'CASE-MANAGEMENT-USE-CASE';

export class CaseManagement {
  casesGateway: CasesInterface;

  constructor(applicationContext: ApplicationContext, casesGateway?: CasesInterface) {
    if (!casesGateway) {
      this.casesGateway = getCasesGateway(applicationContext);
    } else {
      this.casesGateway = casesGateway;
    }
  }

  async getCases(applicationContext: ApplicationContext): Promise<CaseListDbResult> {
    try {
      let startingMonth = parseInt(process.env.STARTING_MONTH);
      if (startingMonth > 0) {
        startingMonth = 0 - startingMonth;
      }
      const caseAssignment = new CaseAssignmentUseCase(applicationContext);
      const cases = await this.casesGateway.getCases(applicationContext, {
        startingMonth: startingMonth || undefined,
      });

      for (const c of cases) {
        c.assignments = await this.getCaseAssigneeNames(applicationContext, caseAssignment, c);
      }

      return {
        success: true,
        message: '',
        count: cases?.length,
        body: {
          caseList: cases as CaseDetailInterface[],
        },
      };
    } catch (originalError) {
      if (!(originalError instanceof CamsError)) {
        throw new UnknownError(MODULE_NAME, {
          message:
            'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
          originalError,
          status: 500,
        });
      } else {
        throw originalError;
      }
    }
  }

  public async getCaseDetail(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailsDbResult> {
    const caseDetails = await this.casesGateway.getCaseDetail(applicationContext, caseId);
    const caseAssignment = new CaseAssignmentUseCase(applicationContext);
    caseDetails.assignments = await this.getCaseAssigneeNames(
      applicationContext,
      caseAssignment,
      caseDetails,
    );

    caseDetails.officeName = getOffice(caseDetails.courtDivision);

    return {
      success: true,
      message: '',
      body: {
        caseDetails,
      },
    };
  }

  private async getCaseAssigneeNames(
    applicationContext: ApplicationContext,
    caseAssignment: CaseAssignmentUseCase,
    c: CaseDetailInterface,
  ) {
    try {
      const assignments: CaseAssignment[] = await caseAssignment.findAssignmentsByCaseId(c.caseId);
      const assigneeNames = assignments.map((a) => {
        return a.name;
      });
      return assigneeNames;
    } catch (e) {
      throw new AssignmentError(MODULE_NAME, {
        message:
          'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
        originalError: e,
        status: 500,
      });
    }
  }
}
