import Factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AcmsGateway } from '../gateways.types';
import AcmsOrders, { AcmsConsolidation, Predicate, PredicateAndPage } from './acms-orders';
import { CasesMongoRepository } from '../../adapters/gateways/mongo/cases.mongo.repository';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { AcmsGatewayImpl } from '../../adapters/gateways/acms/acms.gateway';
import CasesDxtrGateway from '../../adapters/gateways/dxtr/cases.dxtr.gateway';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { ConsolidationType } from '../../../../../common/src/cams/orders';
import { CaseConsolidationHistory } from '../../../../../common/src/cams/history';
import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';

const mockAcmsGateway: AcmsGateway = {
  getPageCount: function (..._ignore): Promise<number> {
    throw new Error('Function not implemented.');
  },
  getLeadCaseIds: function (..._ignore): Promise<string[]> {
    throw new Error('Function not implemented.');
  },
  getConsolidationDetails: function (..._ignore): Promise<AcmsConsolidation> {
    throw new Error('Function not implemented.');
  },
};

describe('ACMS Orders', () => {
  let context;

  beforeAll(async () => {
    context = await createMockApplicationContext({ env: { DATABASE_MOCK: 'false' } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return a page count', async () => {
    const expected = 5;
    const getPageCount = jest.spyOn(mockAcmsGateway, 'getPageCount').mockResolvedValue(expected);
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);

    const predicate: Predicate = {
      divisionCode: '000',
      chapter: '00',
    };
    const useCase = new AcmsOrders();
    const actual = await useCase.getPageCount(context, predicate);

    expect(getPageCount).toHaveBeenCalledWith(context, predicate);
    expect(actual).toEqual(expected);
  });

  test('should return a page of consolidation orders', async () => {
    const expected: string[] = ['811100000', '1231111111'];
    const getConsolidationOrders = jest
      .spyOn(mockAcmsGateway, 'getLeadCaseIds')
      .mockResolvedValue(expected);
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);

    const predicateAndPage: PredicateAndPage = {
      divisionCode: '000',
      chapter: '00',
      pageNumber: 1,
    };

    const useCase = new AcmsOrders();
    const actual = await useCase.getLeadCaseIds(context, predicateAndPage);

    expect(getConsolidationOrders).toHaveBeenCalledWith(context, predicateAndPage);
    expect(actual).toEqual(expected);
  });

  test('should write case references for consolidations to the cases repo', async () => {
    const createConsolidationFromSpy = jest
      .spyOn(CasesMongoRepository.prototype, 'createConsolidationFrom')
      .mockResolvedValue(MockData.getConsolidationFrom());
    const createConsolidationToSpy = jest
      .spyOn(CasesMongoRepository.prototype, 'createConsolidationTo')
      .mockResolvedValue(MockData.getConsolidationTo());
    const createCaseHistorySpy = jest
      .spyOn(CasesMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();

    const leadCase = MockData.getCaseSummary();
    const childCases = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    const details: AcmsConsolidation = {
      leadCaseId: leadCase.caseId,
      childCases: [
        {
          caseId: childCases[0].caseId,
          consolidationDate: '2024-01-01',
          consolidationType: 'substantive',
        },
        {
          caseId: childCases[1].caseId,
          consolidationDate: '2024-02-01',
          consolidationType: 'administrative',
        },
      ],
    };

    const caseSummaryMap = new Map<string, CaseSummary>([
      [leadCase.caseId, leadCase],
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
    ]);

    const expectedFromLinks = details.childCases.map((bCase) => {
      const caseId = leadCase.caseId;
      const orderDate = bCase.consolidationDate;
      const consolidationType = bCase.consolidationType as ConsolidationType;
      return MockData.getConsolidationFrom({
        override: {
          caseId,
          consolidationType,
          orderDate,
          otherCase: caseSummaryMap.get(bCase.caseId),
        },
      });
    });

    const expectedHistory: CaseConsolidationHistory[] = [];
    const allCaseIds = Array.from(caseSummaryMap.keys());
    allCaseIds.forEach((caseId) => {
      expectedHistory.push({
        caseId,
        documentType: 'AUDIT_CONSOLIDATION',
        before: null,
        after: {
          status: 'approved',
          leadCase,
          childCases,
        },
        updatedBy: ACMS_SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-01',
      });
    });

    const expectedToLinks = details.childCases.map((bCase) => {
      const caseId = bCase.caseId;
      const orderDate = bCase.consolidationDate;
      const consolidationType = bCase.consolidationType as ConsolidationType;
      return MockData.getConsolidationTo({
        override: { caseId, consolidationType, orderDate, otherCase: leadCase },
      });
    });

    jest.spyOn(AcmsGatewayImpl.prototype, 'getConsolidationDetails').mockResolvedValue(details);
    jest
      .spyOn(CasesDxtrGateway.prototype, 'getCaseSummary')
      .mockImplementation((_context, caseId) => {
        return Promise.resolve(caseSummaryMap.get(caseId));
      });
    const useCase = new AcmsOrders();
    await useCase.migrateConsolidation(context, leadCase.caseId);

    expect(createConsolidationToSpy).toHaveBeenCalledTimes(childCases.length);
    expect(createConsolidationFromSpy).toHaveBeenCalledTimes(childCases.length);
    expect(createCaseHistorySpy).toHaveBeenCalledTimes(expectedHistory.length);

    expectedFromLinks.forEach((fromLink) => {
      expect(createConsolidationFromSpy).toHaveBeenCalledWith(fromLink);
    });
    expectedToLinks.forEach((toLink) => {
      expect(createConsolidationToSpy).toHaveBeenCalledWith(toLink);
    });
    expectedHistory.forEach((history) => {
      expect(createCaseHistorySpy).toHaveBeenCalledWith(history);
    });
  });

  test('should throw exceptions', async () => {
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
    const useCase = new AcmsOrders();

    const predicate: Predicate = {
      divisionCode: '000',
      chapter: '00',
    };

    const predicateAndPage: PredicateAndPage = {
      ...predicate,
      pageNumber: 1,
    };

    await expect(useCase.getPageCount(context, predicate)).rejects.toThrow();
    await expect(useCase.getLeadCaseIds(context, predicateAndPage)).rejects.toThrow();
    await expect(useCase.migrateConsolidation(context, '000-11-22222')).rejects.toThrow();
  });
});
