import { ApplicationContext } from '../adapters/types/basic';
import { CaseDetailsDbResult, CaseListDbResult } from '../adapters/types/cases';
import { CaseDetailInterface } from '../../../../common/src/cams/cases';
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
      const cases = await this.casesGateway.getCases(applicationContext, {
        startingMonth: startingMonth || undefined,
      });

      for (const bCase of cases) {
        bCase.assignments = await this.getCaseAssigneeNames(applicationContext, bCase);
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
    caseDetails.assignments = await this.getCaseAssigneeNames(applicationContext, caseDetails);
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

  private async getCaseAssigneeNames(context: ApplicationContext, bCase: CaseDetailInterface) {
    const caseAssignment = new CaseAssignmentUseCase(context);
    try {
      const assignments: CaseAssignment[] = await caseAssignment.findAssignmentsByCaseId(
        bCase.caseId,
      );
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
