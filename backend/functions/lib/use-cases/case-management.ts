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

export class CourtCaseManagement {
  casesGateway: CasesInterface;

  constructor(casesGateway?: CasesInterface) {
    if (!casesGateway) {
      this.casesGateway = getCasesGateway();
    } else {
      this.casesGateway = casesGateway;
    }
  }

  async getChapter15CaseList(context: ApplicationContext): Promise<CaseListDbResult> {
    //TODO Ticket Number CAMS_193: refactor this to getCaseList
    try {
      let startingMonth = parseInt(process.env.STARTING_MONTH);
      if (startingMonth > 0) {
        startingMonth = 0 - startingMonth;
      }
      const caseAssignment = new CaseAssignment(context);
      const cases = await this.casesGateway.getChapter15Cases(context, {
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

  async getAllCases(context: ApplicationContext): Promise<CaseListDbResult> {
    //TODO Ticket Number CAMS_193: refactor this to getCaseList
    try {
      let startingMonth = parseInt(process.env.STARTING_MONTH);
      if (startingMonth > 0) {
        startingMonth = 0 - startingMonth;
      }
      const caseAssignment = new CaseAssignment(context);
      const cases = await this.casesGateway.getAllCases(context, {
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
    const caseDetails = await this.casesGateway.getChapter15Case(context, caseId);
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
