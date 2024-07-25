import { ApplicationContext } from '../adapters/types/basic';
import { CaseDetailsDbResult } from '../adapters/types/cases';
import { CaseBasics, CaseDetail } from '../../../../common/src/cams/cases';
import { getCasesGateway, getCasesRepository, getOfficesGateway } from '../factory';
import { CasesInterface } from './cases.interface';
import { CaseAssignmentUseCase } from './case.assignment';
import { UnknownError } from '../common-errors/unknown-error';
import { isCamsError } from '../common-errors/cams-error';
import { AssignmentError } from './assignment.exception';
import { OfficesGatewayInterface } from './offices/offices.gateway.interface';
import { CasesRepository } from './gateways.types';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { CasesSearchPredicate } from '../../../../common/src/api/search';
import { ResourceActions } from '../../../../common/src/api/response';
import { CamsRole } from '../../../../common/src/cams/session';

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

  public async searchCases(
    context: ApplicationContext,
    predicate: CasesSearchPredicate,
  ): Promise<Array<CaseBasics & Partial<ResourceActions>>> {
    try {
      const cases: Array<CaseBasics & Partial<ResourceActions>> =
        await this.casesGateway.searchCases(context, predicate);
      const userDivisions = context.session.user.offices.map((office) => office.courtDivisionCode);
      cases.forEach((bCase) => {
        if (
          userDivisions.includes(bCase.courtDivisionCode) &&
          context.session.user.roles.includes(CamsRole.CaseAssignmentManager)
        ) {
          bCase = {
            ...bCase,
            actions: [
              {
                actionName: 'manage assignments',
                method: 'POST',
                url: `/case-assignments/${bCase.caseId}`,
              },
            ],
          };
        }
      });
      return cases;
    } catch (originalError) {
      if (!isCamsError(originalError)) {
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
    caseDetails.consolidation = await this.casesRepo.getConsolidation(applicationContext, caseId);
    caseDetails.assignments = await this.getCaseAssigneeNames(applicationContext, caseDetails);
    caseDetails.officeName = this.officesGateway.getOffice(caseDetails.courtDivisionCode);

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
  ): Promise<CaseDetail> {
    const caseSummary = await this.casesGateway.getCaseSummary(applicationContext, caseId);
    caseSummary.officeName = this.officesGateway.getOffice(caseSummary.courtDivisionCode);
    return caseSummary;
  }

  private async getCaseAssigneeNames(context: ApplicationContext, bCase: CaseDetail) {
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
