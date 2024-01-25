import { ApplicationContext } from '../adapters/types/basic';
import {
  CaseDetailInterface,
  CaseDetailsDbResult,
  CaseListDbResult,
} from '../adapters/types/cases';
import { getCasesGateway, getCasesRepository, getOfficesGateway } from '../factory';
import { CasesInterface } from './cases.interface';
import { CaseAssignmentUseCase } from './case.assignment';
import { UnknownError } from '../common-errors/unknown-error';
import { CamsError } from '../common-errors/cams-error';
import { AssignmentError } from './assignment.exception';
import { CaseAssignment } from '../adapters/types/case.assignment';
import { OfficesGatewayInterface } from './offices/offices.gateway.interface';
import { CasesRepository } from './gateways.types';

const MODULE_NAME = 'CASE-MANAGEMENT-USE-CASE';

export class CaseManagement {
  casesGateway: CasesInterface;
  casesRepo: CasesRepository;
  officesGateway: OfficesGatewayInterface;

  constructor(
    applicationContext: ApplicationContext,
    casesGateway?: CasesInterface,
    casesRepo?: CasesRepository,
  ) {
    if (!casesGateway || !casesRepo) {
      this.casesRepo = casesRepo ? casesRepo : getCasesRepository(applicationContext);
      this.casesGateway = casesGateway ? casesGateway : getCasesGateway(applicationContext);
    }
    this.officesGateway = getOfficesGateway(applicationContext);
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
    caseDetails.transfers = await this.casesRepo.getTransfers(applicationContext, caseId);

    const caseAssignment = new CaseAssignmentUseCase(applicationContext);
    caseDetails.assignments = await this.getCaseAssigneeNames(
      applicationContext,
      caseAssignment,
      caseDetails,
    );

    caseDetails.officeName = this.officesGateway.getOffice(caseDetails.courtDivision);

    return {
      success: true,
      message: '',
      body: {
        caseDetails,
      },
    };
  }

  public async getCaseSummary(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailInterface> {
    const caseSummary = await this.casesGateway.getCaseSummary(applicationContext, caseId);
    caseSummary.officeName = this.officesGateway.getOffice(caseSummary.courtDivision);
    return caseSummary;
  }

  private async getCaseAssigneeNames(
    _applicationContext: ApplicationContext,
    caseAssignment: CaseAssignmentUseCase,
    c: CaseDetailInterface,
  ) {
    try {
      const assignments: CaseAssignment[] = await caseAssignment.findAssignmentsByCaseId(c.caseId);
      return assignments.map((a) => {
        return a.name;
      });
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
