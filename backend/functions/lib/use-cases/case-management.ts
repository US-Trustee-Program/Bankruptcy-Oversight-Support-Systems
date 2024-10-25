import { ApplicationContext } from '../adapters/types/basic';
import { CaseBasics, CaseDetail, CaseSummary } from '../../../../common/src/cams/cases';
import {
  getAssignmentRepository,
  getCasesGateway,
  getCasesRepository,
  getOfficesGateway,
} from '../factory';
import { CasesInterface } from './cases.interface';
import { CaseAssignmentUseCase } from './case-assignment';
import { UnknownError } from '../common-errors/unknown-error';
import { isCamsError } from '../common-errors/cams-error';
import { AssignmentError } from './assignment.exception';
import { OfficesGateway } from './offices/offices.types';
import { CaseAssignmentRepository, CasesRepository } from './gateways.types';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { CasesSearchPredicate } from '../../../../common/src/api/search';
import Actions, { Action, ResourceActions } from '../../../../common/src/cams/actions';
import { CamsRole } from '../../../../common/src/cams/roles';
import { CamsUserReference, getCourtDivisionCodes } from '../../../../common/src/cams/users';
import { buildOfficeCode } from './offices/offices';

const MODULE_NAME = 'CASE-MANAGEMENT-USE-CASE';

export function getAction<T extends CaseBasics>(
  context: ApplicationContext,
  bCase: ResourceActions<T>,
): Action[] {
  const userDivisions = getCourtDivisionCodes(context.session.user);
  const actions: Action[] = [];
  if (
    userDivisions.includes(bCase.courtDivisionCode) &&
    context.session.user.roles.includes(CamsRole.CaseAssignmentManager)
  ) {
    actions.push(Actions.merge(Actions.ManageAssignments, bCase));
  }
  return actions;
}

export default class CaseManagement {
  assignmentGateway: CaseAssignmentRepository;
  casesGateway: CasesInterface;
  casesRepo: CasesRepository;
  officesGateway: OfficesGateway;

  constructor(
    applicationContext: ApplicationContext,
    casesGateway?: CasesInterface,
    casesRepo?: CasesRepository,
  ) {
    this.assignmentGateway = getAssignmentRepository(applicationContext);
    this.casesRepo = casesRepo ? casesRepo : getCasesRepository(applicationContext);
    this.casesGateway = casesGateway ? casesGateway : getCasesGateway(applicationContext);
    this.officesGateway = getOfficesGateway(applicationContext);
  }

  public async searchCases(
    context: ApplicationContext,
    predicate: CasesSearchPredicate,
  ): Promise<ResourceActions<CaseBasics>[]> {
    try {
      if (predicate.assignments && predicate.assignments.length > 0) {
        const caseIdSet = new Set<string>();
        for (const user of predicate.assignments) {
          const caseAssignments = await this.assignmentGateway.findAssignmentsByAssignee(user.id);
          caseAssignments.forEach((caseAssignment) => {
            caseIdSet.add(caseAssignment.caseId);
          });
        }
        predicate.caseIds = Array.from(caseIdSet);
        // if we're requesting cases with specific assignments, and none are found, return [] early
        if (predicate.caseIds.length == 0) {
          return [];
        }
      }
      const cases: ResourceActions<CaseBasics>[] = await this.casesGateway.searchCases(
        context,
        predicate,
      );
      for (const casesKey in cases) {
        const bCase = cases[casesKey];
        bCase.officeCode = buildOfficeCode(bCase.regionId, bCase.courtDivisionCode);
        bCase._actions = getAction<CaseBasics>(context, bCase);
      }
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
  ): Promise<ResourceActions<CaseDetail>> {
    const caseDetails = await this.casesGateway.getCaseDetail(applicationContext, caseId);
    caseDetails.transfers = await this.casesRepo.getTransfers(applicationContext, caseId);
    caseDetails.consolidation = await this.casesRepo.getConsolidation(applicationContext, caseId);
    caseDetails.assignments = await this.getCaseAssignments(applicationContext, caseDetails);
    caseDetails.officeName = this.officesGateway.getOfficeName(caseDetails.courtDivisionCode);
    const _actions = getAction<CaseDetail>(applicationContext, caseDetails);

    return { ...caseDetails, _actions };
  }

  public async getCaseSummary(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseSummary> {
    const caseSummary = await this.casesGateway.getCaseSummary(applicationContext, caseId);
    return caseSummary;
  }

  private async getCaseAssignments(
    context: ApplicationContext,
    bCase: CaseDetail,
  ): Promise<CamsUserReference[]> {
    const caseAssignment = new CaseAssignmentUseCase(context);
    try {
      const assignments: CaseAssignment[] = await caseAssignment.findAssignmentsByCaseId(
        bCase.caseId,
      );
      return assignments.map((a) => {
        return { id: a.userId, name: a.name };
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
