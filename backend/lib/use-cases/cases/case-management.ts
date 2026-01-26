import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
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
import { CaseBasics, CaseDetail, CaseSummary, SyncedCase } from '@common/cams/cases';
import Actions, { Action, ResourceActions } from '@common/cams/actions';
import { getCourtDivisionCodes } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { CasesSearchPredicate } from '@common/api/search';
import { CaseAssignment } from '@common/cams/assignments';
import {
  generatePhoneticTokensWithNicknames,
  filterCasesByDebtorNameSimilarity,
  SIMILARITY_THRESHOLD,
} from './phonetic-utils';

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
    this.assignmentRepository = factory.getAssignmentRepository(applicationContext);
    this.casesGateway = casesGateway ? casesGateway : factory.getCasesGateway(applicationContext);
    this.officesGateway = factory.getOfficesGateway(applicationContext);
    this.casesRepository = factory.getCasesRepository(applicationContext);
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

      let consolidationMemberCaseIds: string[] = [];
      if (predicate.excludeMemberConsolidations === true) {
        consolidationMemberCaseIds =
          await this.casesRepository.getConsolidationMemberCaseIds(predicate);
        predicate.excludedCaseIds = consolidationMemberCaseIds;
      }

      const phoneticSearchEnabled = context.featureFlags?.['phonetic-search-enabled'] === true;
      const augmentedPredicate = { ...predicate };

      if (predicate.debtorName) {
        context.logger.info(MODULE_NAME, 'Debtor name search criteria used');

        if (phoneticSearchEnabled) {
          augmentedPredicate.phoneticTokens = generatePhoneticTokensWithNicknames(
            predicate.debtorName,
          );
        }
      }

      let searchResult = await this.casesRepository.searchCases(augmentedPredicate);

      if (predicate.debtorName && phoneticSearchEnabled && augmentedPredicate.phoneticTokens) {
        const filteredCases = filterCasesByDebtorNameSimilarity(
          searchResult.data,
          predicate.debtorName,
          SIMILARITY_THRESHOLD,
        );

        const start = predicate.offset || 0;
        const end = start + (predicate.limit || 25);
        const paginatedCases = filteredCases.slice(start, end);

        searchResult = {
          metadata: { total: filteredCases.length },
          data: paginatedCases,
        };
      }

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
        const assignmentsMap = await this.assignmentRepository.getAssignmentsForCases(caseIds);
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
    const casesRepo = factory.getCasesRepository(context);
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
