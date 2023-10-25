import { ApplicationContext, ObjectKeyVal } from '../adapters/types/basic';
import {
  CaseDetailsDbResult,
  CaseListDbResult,
  CaseDetailInterface,
} from '../adapters/types/cases';
import { getCasesGateway } from '../factory';
import { CasesInterface } from './cases.interface';
import { CaseAssignment } from './case.assignment';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';

export class CaseManagement {
  casesGateway: CasesInterface;

  constructor(casesGateway?: CasesInterface) {
    if (!casesGateway) {
      this.casesGateway = getCasesGateway();
    } else {
      this.casesGateway = casesGateway;
    }
  }

  async getCases(context: ApplicationContext): Promise<CaseListDbResult> {
    try {
      let startingMonth = parseInt(process.env.STARTING_MONTH);
      if (startingMonth > 0) {
        startingMonth = 0 - startingMonth;
      }
      const caseAssignment = new CaseAssignment(context);
      const cases = await this.casesGateway.getCases(context, {
        startingMonth: startingMonth || undefined,
      });

      for (const c of cases) {
        c.assignments = await this.getCaseAssigneeNames(caseAssignment, c);
      }

      return {
        success: true,
        message: '',
        count: cases?.length,
        body: {
          caseList: cases as ObjectKeyVal[],
        },
      };
    } catch (e) {
      const message = (e as Error).message;
      return {
        success: false,
        message: message || 'Unknown Error received while retrieving cases',
        count: 0,
        body: {
          caseList: [],
        },
      };
    }
  }

  public async getCaseDetail(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailsDbResult> {
    const caseDetails = await this.casesGateway.getCaseDetail(context, caseId);
    const caseAssignment = new CaseAssignment(context);
    caseDetails.assignments = await this.getCaseAssigneeNames(caseAssignment, caseDetails);

    return {
      success: true,
      message: '',
      body: {
        caseDetails,
      },
    };
  }

  private async getCaseAssigneeNames(caseAssignment: CaseAssignment, c: CaseDetailInterface) {
    const assignments: CaseAttorneyAssignment[] = await caseAssignment.findAssignmentsByCaseId(
      c.caseId,
    );
    const assigneeNames = assignments.map((a) => {
      return a.name;
    });
    return assigneeNames;
  }
}
