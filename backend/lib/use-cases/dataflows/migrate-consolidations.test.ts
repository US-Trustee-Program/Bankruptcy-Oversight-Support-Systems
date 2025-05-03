import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { CaseSummary } from '../../../../common/src/cams/cases';
import { ConsolidationFrom } from '../../../../common/src/cams/events';
import { CaseConsolidationHistory } from '../../../../common/src/cams/history';
import { ConsolidationType } from '../../../../common/src/cams/orders';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { AcmsGatewayImpl } from '../../adapters/gateways/acms/acms.gateway';
import CasesDxtrGateway from '../../adapters/gateways/dxtr/cases.dxtr.gateway';
import { CasesMongoRepository } from '../../adapters/gateways/mongo/cases.mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import AcmsOrders, { AcmsConsolidation, AcmsPredicate } from './migrate-consolidations';

describe('ACMS Orders', () => {
  let context;

  beforeAll(async () => {
    context = await createMockApplicationContext({ env: { DATABASE_MOCK: 'false' } });
  });

  beforeEach(async () => {
    jest
      .spyOn(AcmsGatewayImpl.prototype, 'getLeadCaseIds')
      .mockRejectedValue(new Error('unknown error'));
    jest
      .spyOn(AcmsGatewayImpl.prototype, 'getConsolidationDetails')
      .mockRejectedValue(new Error('unknown error'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return a page of consolidation orders', async () => {
    const expected: string[] = ['811100000', '1231111111'];
    const getConsolidationOrders = jest
      .spyOn(AcmsGatewayImpl.prototype, 'getLeadCaseIds')
      .mockResolvedValue(expected);

    const predicateAndPage: AcmsPredicate = {
      chapter: '00',
      divisionCode: '000',
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
    const getConsolidationSpy = jest
      .spyOn(CasesMongoRepository.prototype, 'getConsolidation')
      .mockResolvedValue([]);

    const leadCase = MockData.getCaseSummary();
    const childCases = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    const details: AcmsConsolidation = {
      childCases: [
        {
          caseId: childCases[0].caseId,
          consolidationDate: '2024-01-01',
          consolidationType: 'substantive',
        },
        {
          caseId: childCases[1].caseId,
          consolidationDate: '2024-01-01',
          consolidationType: 'administrative',
        },
      ],
      leadCaseId: leadCase.caseId,
    };

    const caseSummaryMap = new Map<string, CaseSummary>([
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
      [leadCase.caseId, leadCase],
    ]);

    const expectedFromLinks = details.childCases.map((bCase) => {
      const { caseId } = leadCase;
      const orderDate = bCase.consolidationDate;
      const consolidationType = bCase.consolidationType as ConsolidationType;
      return MockData.getConsolidationFrom({
        override: {
          caseId,
          consolidationType,
          orderDate,
          otherCase: caseSummaryMap.get(bCase.caseId),
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: orderDate,
        },
      });
    });

    const expectedHistory: CaseConsolidationHistory[] = [];
    const allCaseIds = Array.from(caseSummaryMap.keys());
    allCaseIds.forEach((caseId) => {
      expectedHistory.push({
        after: {
          childCases,
          leadCase,
          status: 'approved',
        },
        before: null,
        caseId,
        documentType: 'AUDIT_CONSOLIDATION',
        updatedBy: ACMS_SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-01',
      });
    });

    const expectedToLinks = details.childCases.map((bCase) => {
      const { caseId } = bCase;
      const orderDate = bCase.consolidationDate;
      const consolidationType = bCase.consolidationType as ConsolidationType;
      return MockData.getConsolidationTo({
        override: {
          caseId,
          consolidationType,
          orderDate,
          otherCase: leadCase,
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: orderDate,
        },
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

    expect(getConsolidationSpy).toHaveBeenCalled();
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

  test('should get histories for consolidations over a date range', async () => {
    jest
      .spyOn(CasesMongoRepository.prototype, 'createConsolidationFrom')
      .mockResolvedValue(MockData.getConsolidationFrom());
    jest
      .spyOn(CasesMongoRepository.prototype, 'createConsolidationTo')
      .mockResolvedValue(MockData.getConsolidationTo());
    const createCaseHistorySpy = jest
      .spyOn(CasesMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();
    jest.spyOn(CasesMongoRepository.prototype, 'getConsolidation').mockResolvedValue([]);

    const leadCase = MockData.getCaseSummary();
    const childCases = MockData.buildArray(MockData.getCaseSummary, 4);
    const details: AcmsConsolidation = {
      childCases: [
        {
          caseId: childCases[0].caseId,
          consolidationDate: '2024-01-01',
          consolidationType: 'substantive',
        },
        {
          caseId: childCases[1].caseId,
          consolidationDate: '2024-01-01',
          consolidationType: 'substantive',
        },
        {
          caseId: childCases[2].caseId,
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
        {
          caseId: childCases[3].caseId,
          consolidationDate: '2024-03-01',
          consolidationType: 'substantive',
        },
      ],
      leadCaseId: leadCase.caseId,
    };

    const caseSummaryMap = new Map<string, CaseSummary>([
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
      [childCases[2].caseId, childCases[2]],
      [childCases[3].caseId, childCases[3]],
      [leadCase.caseId, leadCase],
    ]);

    // History for lead case and 2 child cases on '2024-01-01'
    const allHistories: CaseConsolidationHistory[] = [];
    allHistories.push({
      after: {
        childCases: [childCases[0], childCases[1]],
        leadCase,
        status: 'approved',
      },
      before: null,
      caseId: childCases[0].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01',
    });
    allHistories.push({
      after: {
        childCases: [childCases[0], childCases[1]],
        leadCase,
        status: 'approved',
      },
      before: null,
      caseId: childCases[1].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01',
    });
    allHistories.push({
      after: {
        childCases: [childCases[0], childCases[1]],
        leadCase,
        status: 'approved',
      },
      before: null,
      caseId: leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01',
    });

    // History for lead case and next child case on '2024-02-01'
    allHistories.push({
      after: {
        childCases: [childCases[2]],
        leadCase,
        status: 'approved',
      },
      before: null,
      caseId: childCases[2].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
    });
    allHistories.push({
      after: {
        childCases: [childCases[0], childCases[1], childCases[2]],
        leadCase,
        status: 'approved',
      },
      before: {
        childCases: [childCases[0], childCases[1]],
        leadCase,
        status: 'approved',
      },
      caseId: leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
    });

    // History for lead case and next child case on '2024-03-01'
    allHistories.push({
      after: {
        childCases: [childCases[3]],
        leadCase,
        status: 'approved',
      },
      before: null,
      caseId: childCases[3].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-03-01',
    });
    allHistories.push({
      after: {
        childCases: [childCases[0], childCases[1], childCases[2], childCases[3]],
        leadCase,
        status: 'approved',
      },
      before: {
        childCases: [childCases[0], childCases[1], childCases[2]],
        leadCase,
        status: 'approved',
      },
      caseId: leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-03-01',
    });

    jest.spyOn(AcmsGatewayImpl.prototype, 'getConsolidationDetails').mockResolvedValue(details);
    jest
      .spyOn(CasesDxtrGateway.prototype, 'getCaseSummary')
      .mockImplementation((_context, caseId) => {
        return Promise.resolve(caseSummaryMap.get(caseId));
      });
    const useCase = new AcmsOrders();
    await useCase.migrateConsolidation(context, leadCase.caseId);

    expect(createCaseHistorySpy).toHaveBeenCalledTimes(allHistories.length);
    allHistories.forEach((history) => {
      expect(createCaseHistorySpy).toHaveBeenCalledWith(history);
    });
  });

  test('should not write links for links that have already been written', async () => {
    const mockConsolidationFrom = MockData.getConsolidationFrom({
      override: {
        updatedBy: ACMS_SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-01',
      },
    });
    const mockConsolidationTo = MockData.getConsolidationTo({
      override: {
        updatedBy: ACMS_SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-01',
      },
    });

    const createConsolidationFromSpy = jest
      .spyOn(CasesMongoRepository.prototype, 'createConsolidationFrom')
      .mockResolvedValue(mockConsolidationFrom);
    const createConsolidationToSpy = jest
      .spyOn(CasesMongoRepository.prototype, 'createConsolidationTo')
      .mockResolvedValue(mockConsolidationTo);
    const createCaseHistorySpy = jest
      .spyOn(CasesMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();

    const leadCase = MockData.getCaseSummary();
    const childCases = [
      MockData.getCaseSummary({
        override: {
          caseId: mockConsolidationFrom.caseId,
        },
      }),
      MockData.getCaseSummary(),
    ];
    const details: AcmsConsolidation = {
      childCases: [
        {
          caseId: childCases[0].caseId,
          consolidationDate: '2024-01-01',
          consolidationType: 'substantive',
        },
        {
          caseId: childCases[1].caseId,
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
      ],
      leadCaseId: leadCase.caseId,
    };

    // Create a single existing link for the first record coming back from ACMS
    const existingFromLink: ConsolidationFrom = {
      caseId: leadCase.caseId,
      consolidationType: 'substantive',
      documentType: 'CONSOLIDATION_FROM',
      orderDate: '2024-01-01',
      otherCase: childCases[0],
      updatedBy: mockConsolidationFrom.updatedBy,
      updatedOn: mockConsolidationFrom.updatedOn,
    };
    const existingChildCaseId = childCases[0].caseId;
    jest
      .spyOn(CasesMongoRepository.prototype, 'getConsolidation')
      .mockResolvedValue([existingFromLink]);

    const caseSummaryMap = new Map<string, CaseSummary>([
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
      [leadCase.caseId, leadCase],
    ]);

    const filterExistingCase = (bCase) => bCase.caseId !== existingChildCaseId;

    const expectedFromLinks = details.childCases.filter(filterExistingCase).map((bCase) => {
      const { caseId } = leadCase;
      const orderDate = bCase.consolidationDate;
      const consolidationType = bCase.consolidationType as ConsolidationType;
      return MockData.getConsolidationFrom({
        override: {
          caseId,
          consolidationType,
          orderDate,
          otherCase: caseSummaryMap.get(bCase.caseId),
          updatedBy: mockConsolidationFrom.updatedBy,
          updatedOn: orderDate,
        },
      });
    });

    const expectedHistory: CaseConsolidationHistory[] = [];
    expectedHistory.push({
      after: {
        childCases: childCases.filter(filterExistingCase),
        leadCase,
        status: 'approved',
      },
      before: null,
      caseId: childCases[1].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
    });
    expectedHistory.push({
      after: {
        childCases: childCases.filter(filterExistingCase),
        leadCase,
        status: 'approved',
      },
      before: null,
      caseId: leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
    });

    const expectedToLinks = details.childCases.filter(filterExistingCase).map((bCase) => {
      const { caseId } = bCase;
      const orderDate = bCase.consolidationDate;
      const consolidationType = bCase.consolidationType as ConsolidationType;
      return MockData.getConsolidationTo({
        override: {
          caseId,
          consolidationType,
          orderDate,
          otherCase: leadCase,
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: orderDate,
        },
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

    expect(createConsolidationToSpy).toHaveBeenCalledTimes(expectedToLinks.length);
    expect(createConsolidationFromSpy).toHaveBeenCalledTimes(expectedFromLinks.length);
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

  test('should not do anything if consolidations from ACMS are already in the cases repo', async () => {
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
      childCases: [
        {
          caseId: childCases[0].caseId,
          consolidationDate: '2024-01-01',
          consolidationType: 'substantive',
        },
        {
          caseId: childCases[1].caseId,
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
      ],
      leadCaseId: leadCase.caseId,
    };

    // Create a single existing link for the first record coming back from ACMS
    const existingToLinks: ConsolidationFrom[] = [
      {
        caseId: leadCase.caseId,
        consolidationType: 'substantive',
        documentType: 'CONSOLIDATION_FROM',
        orderDate: '2024-01-01',
        otherCase: childCases[0],
        updatedBy: context.session.user,
        updatedOn: new Date().toISOString(),
      },
      {
        caseId: leadCase.caseId,
        consolidationType: 'substantive',
        documentType: 'CONSOLIDATION_FROM',
        orderDate: '2024-01-01',
        otherCase: childCases[1],
        updatedBy: context.session.user,
        updatedOn: '2024-02-01',
      },
    ];
    jest
      .spyOn(CasesMongoRepository.prototype, 'getConsolidation')
      .mockResolvedValue(existingToLinks);

    const caseSummaryMap = new Map<string, CaseSummary>([
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
      [leadCase.caseId, leadCase],
    ]);

    jest.spyOn(AcmsGatewayImpl.prototype, 'getConsolidationDetails').mockResolvedValue(details);
    jest
      .spyOn(CasesDxtrGateway.prototype, 'getCaseSummary')
      .mockImplementation((_context, caseId) => {
        return Promise.resolve(caseSummaryMap.get(caseId));
      });
    const useCase = new AcmsOrders();
    await useCase.migrateConsolidation(context, leadCase.caseId);

    expect(createConsolidationToSpy).not.toHaveBeenCalled();
    expect(createConsolidationFromSpy).not.toHaveBeenCalled();
    expect(createCaseHistorySpy).not.toHaveBeenCalled();
  });

  test('should throw exceptions', async () => {
    const useCase = new AcmsOrders();

    const predicate: AcmsPredicate = {
      chapter: '00',
      divisionCode: '000',
    };

    const predicateAndPage: AcmsPredicate = {
      ...predicate,
    };

    await expect(useCase.getLeadCaseIds(context, predicateAndPage)).rejects.toThrow();
  });

  test('should not throw exceptions', async () => {
    const useCase = new AcmsOrders();

    await expect(useCase.migrateConsolidation(context, '000-11-22222')).resolves.toEqual(
      expect.objectContaining({ success: false }),
    );
  });
});
