import { ApplicationContext } from '../../adapters/types/basic';
import Factory, {
  getAssignmentRepository,
  getCasesGateway,
  getCasesRepository,
  getOfficesGateway,
} from '../../factory';
import { CasesInterface } from './cases.interface';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { UnknownError } from '../../common-errors/unknown-error';
import { isCamsError } from '../../common-errors/cams-error';
import { AssignmentError } from '../case-assignment/assignment.exception';
import { OfficesGateway } from '../offices/offices.types';
import {
  CamsPaginationResponse,
  CaseAssignmentRepository,
  CasesRepository,
} from '../gateways.types';
import { buildOfficeCode } from '../offices/offices';
import { getCamsError } from '../../common-errors/error-utilities';
import { CaseBasics, CaseDetail, CaseSummary, SyncedCase } from '../../../../common/src/cams/cases';
import Actions, { Action, ResourceActions } from '../../../../common/src/cams/actions';
import { getCourtDivisionCodes } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { CasesSearchPredicate } from '../../../../common/src/api/search';
import { CaseAssignment } from '../../../../common/src/cams/assignments';

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
  assignmentRepository: CaseAssignmentRepository; //Fix naming
  casesGateway: CasesInterface;
  officesGateway: OfficesGateway;
  casesRepository: CasesRepository;

  constructor(applicationContext: ApplicationContext, casesGateway?: CasesInterface) {
    this.assignmentRepository = getAssignmentRepository(applicationContext);
    this.casesGateway = casesGateway ? casesGateway : getCasesGateway(applicationContext);
    this.officesGateway = getOfficesGateway(applicationContext);
    this.casesRepository = getCasesRepository(applicationContext);
  }

  public async searchCases(
    context: ApplicationContext,
    predicate: CasesSearchPredicate,
    includeAssignments: boolean,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>> {
    try {
      if (predicate.assignments && predicate.assignments.length > 0) {
        const caseIdSet = new Set<string>();
        for (const user of predicate.assignments) {
          const caseAssignments = await this.assignmentRepository.findAssignmentsByAssignee(
            user.id,
          );
          caseAssignments.forEach((caseAssignment) => {
            caseIdSet.add(caseAssignment.caseId);
          });
        }
        predicate.caseIds = Array.from(caseIdSet);
        // if we're requesting cases with specific assignments, and none are found, return [] early

        if (predicate.caseIds.length === 0) {
          return { metadata: { total: 0 }, data: [] };
        }
      }

      let consolidationChildCaseIds: string[] = [];
      if (predicate.excludeChildConsolidations === true) {
        consolidationChildCaseIds =
          await this.casesRepository.getConsolidationChildCaseIds(predicate);
        predicate.excludedCaseIds = consolidationChildCaseIds;
      }

      const searchResult = await this.casesRepository.searchCases(predicate);

      const casesMap = new Map<string, ResourceActions<SyncedCase>>();
      const caseIds = [];
      for (const casesKey in searchResult.data) {
        caseIds.push(searchResult.data[casesKey].caseId);
        const bCase = searchResult.data[casesKey];
        bCase.officeCode = buildOfficeCode(bCase.regionId, bCase.courtDivisionCode);
        bCase._actions = getAction<CaseBasics>(context, bCase);
        casesMap.set(bCase.caseId, bCase);
      }
      // TODO: in a subsequent PR, use a merge in the repo to get assignments at the same time as the rest
      if (includeAssignments) {
        const assignmentsMap = await this.assignmentRepository.findAssignmentsByCaseId(caseIds);
        for (const caseId of caseIds) {
          const assignments = assignmentsMap.get(caseId) ?? [];
          const caseWithAssignments = {
            ...casesMap.get(caseId),
            assignments,
          };
          casesMap.set(caseId, caseWithAssignments);
        }
      }

      return { metadata: searchResult.metadata, data: Array.from(casesMap.values()) };
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
    context: ApplicationContext,
    caseId: string,
  ): Promise<ResourceActions<CaseDetail>> {
    const casesRepo = Factory.getCasesRepository(context);
    try {
      const caseDetails = await this.casesGateway.getCaseDetail(context, caseId);
      caseDetails.transfers = await casesRepo.getTransfers(caseId);
      caseDetails.consolidation = await casesRepo.getConsolidation(caseId);
      caseDetails.assignments = await this.getCaseAssignments(context, caseDetails);
      caseDetails.officeName = this.officesGateway.getOfficeName(caseDetails.courtDivisionCode);
      caseDetails.officeCode = buildOfficeCode(caseDetails.regionId, caseDetails.courtDivisionCode);
      const _actions = getAction<CaseDetail>(context, caseDetails);

      return { ...caseDetails, _actions };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getCaseSummary(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseSummary> {
    try {
      const caseSummary = await this.casesGateway.getCaseSummary(applicationContext, caseId);
      return caseSummary;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async getCaseAssignments(
    context: ApplicationContext,
    bCase: CaseDetail,
  ): Promise<CaseAssignment[]> {
    const caseAssignment = new CaseAssignmentUseCase(context);
    try {
      const assignmentsMap = await caseAssignment.findAssignmentsByCaseId([bCase.caseId]);
      return assignmentsMap.get(bCase.caseId);
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
