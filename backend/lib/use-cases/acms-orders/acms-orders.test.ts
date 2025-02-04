import Factory from '../../factory';
import { createMockApplicationContext, getExpectedError } from '../../testing/testing-utilities';
import { AcmsGateway } from '../gateways.types';
import AcmsOrders, { AcmsConsolidation, AcmsPredicate } from './acms-orders';
import { CasesMongoRepository } from '../../adapters/gateways/mongo/cases.mongo.repository';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { AcmsGatewayImpl } from '../../adapters/gateways/acms/acms.gateway';
import CasesDxtrGateway from '../../adapters/gateways/dxtr/cases.dxtr.gateway';
import { CaseSummary } from '../../../../common/src/cams/cases';
import { ConsolidationType } from '../../../../common/src/cams/orders';
import { CaseConsolidationHistory } from '../../../../common/src/cams/history';
import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { ConsolidationFrom } from '../../../../common/src/cams/events';
import { UnknownError } from '../../common-errors/unknown-error';

const mockAcmsGateway: AcmsGateway = {
  getLeadCaseIds: function (..._ignore): Promise<string[]> {
    throw new Error('Function not implemented.');
  },
  getConsolidationDetails: function (..._ignore): Promise<AcmsConsolidation> {
    throw new Error('Function not implemented.');
  },
  getCaseIdsToMigrate: function (..._ignore): Promise<string[]> {
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

  test('should return a page of consolidation orders', async () => {
    const expected: string[] = ['811100000', '1231111111'];
    const getConsolidationOrders = jest
      .spyOn(mockAcmsGateway, 'getLeadCaseIds')
      .mockResolvedValue(expected);
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);

    const predicateAndPage: AcmsPredicate = {
      divisionCode: '000',
      chapter: '00',
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
      leadCaseId: leadCase.caseId,
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
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: orderDate,
        },
      });
    });

    const expectedHistory: CaseConsolidationHistory[] = [];
    const allCaseIds = Array.from(caseSummaryMap.keys());
    allCaseIds.forEach((caseId) => {
      expectedHistory.push({
        documentType: 'AUDIT_CONSOLIDATION',
        before: null,
        after: {
          status: 'approved',
          leadCase,
          childCases,
        },
        updatedBy: ACMS_SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-01',
        caseId,
      });
    });

    const expectedToLinks = details.childCases.map((bCase) => {
      const caseId = bCase.caseId;
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
      leadCaseId: leadCase.caseId,
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
    };

    const caseSummaryMap = new Map<string, CaseSummary>([
      [leadCase.caseId, leadCase],
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
      [childCases[2].caseId, childCases[2]],
      [childCases[3].caseId, childCases[3]],
    ]);

    // History for lead case and 2 child cases on '2024-01-01'
    const allHistories: CaseConsolidationHistory[] = [];
    allHistories.push({
      caseId: childCases[0].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      before: null,
      after: {
        status: 'approved',
        leadCase,
        childCases: [childCases[0], childCases[1]],
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01',
    });
    allHistories.push({
      caseId: childCases[1].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      before: null,
      after: {
        status: 'approved',
        leadCase,
        childCases: [childCases[0], childCases[1]],
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01',
    });
    allHistories.push({
      caseId: leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      before: null,
      after: {
        status: 'approved',
        leadCase,
        childCases: [childCases[0], childCases[1]],
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01',
    });

    // History for lead case and next child case on '2024-02-01'
    allHistories.push({
      caseId: childCases[2].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      before: null,
      after: {
        status: 'approved',
        leadCase,
        childCases: [childCases[2]],
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
    });
    allHistories.push({
      caseId: leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      before: {
        status: 'approved',
        leadCase,
        childCases: [childCases[0], childCases[1]],
      },
      after: {
        status: 'approved',
        leadCase,
        childCases: [childCases[0], childCases[1], childCases[2]],
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
    });

    // History for lead case and next child case on '2024-03-01'
    allHistories.push({
      caseId: childCases[3].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      before: null,
      after: {
        status: 'approved',
        leadCase,
        childCases: [childCases[3]],
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-03-01',
    });
    allHistories.push({
      caseId: leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      before: {
        status: 'approved',
        leadCase,
        childCases: [childCases[0], childCases[1], childCases[2]],
      },
      after: {
        status: 'approved',
        leadCase,
        childCases: [childCases[0], childCases[1], childCases[2], childCases[3]],
      },
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
          consolidationType: 'substantive',
        },
      ],
    };

    // Create a single existing link for the first record coming back from ACMS
    const existingFromLink: ConsolidationFrom = {
      consolidationType: 'substantive',
      caseId: leadCase.caseId,
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
      [leadCase.caseId, leadCase],
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
    ]);

    const filterExistingCase = (bCase) => bCase.caseId !== existingChildCaseId;

    const expectedFromLinks = details.childCases.filter(filterExistingCase).map((bCase) => {
      const caseId = leadCase.caseId;
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
      documentType: 'AUDIT_CONSOLIDATION',
      before: null,
      after: {
        status: 'approved',
        leadCase,
        childCases: childCases.filter(filterExistingCase),
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
      caseId: childCases[1].caseId,
    });
    expectedHistory.push({
      documentType: 'AUDIT_CONSOLIDATION',
      before: null,
      after: {
        status: 'approved',
        leadCase,
        childCases: childCases.filter(filterExistingCase),
      },
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: '2024-02-01',
      caseId: leadCase.caseId,
    });

    const expectedToLinks = details.childCases.filter(filterExistingCase).map((bCase) => {
      const caseId = bCase.caseId;
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
          consolidationType: 'substantive',
        },
      ],
    };

    // Create a single existing link for the first record coming back from ACMS
    const existingToLinks: ConsolidationFrom[] = [
      {
        consolidationType: 'substantive',
        caseId: leadCase.caseId,
        documentType: 'CONSOLIDATION_FROM',
        orderDate: '2024-01-01',
        otherCase: childCases[0],
        updatedBy: context.session.user,
        updatedOn: new Date().toISOString(),
      },
      {
        consolidationType: 'substantive',
        caseId: leadCase.caseId,
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
      [leadCase.caseId, leadCase],
      [childCases[0].caseId, childCases[0]],
      [childCases[1].caseId, childCases[1]],
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
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
    const useCase = new AcmsOrders();

    const predicate: AcmsPredicate = {
      divisionCode: '000',
      chapter: '00',
    };

    const predicateAndPage: AcmsPredicate = {
      ...predicate,
    };

    await expect(useCase.getLeadCaseIds(context, predicateAndPage)).rejects.toThrow();
  });

  test('should not throw exceptions', async () => {
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
    const useCase = new AcmsOrders();

    await expect(useCase.migrateConsolidation(context, '000-11-22222')).resolves.toEqual(
      expect.objectContaining({ success: false }),
    );
  });

  test('should return case ids for migration', async () => {
    const caseIds = MockData.buildArray(MockData.randomCaseId, 1000);
    jest.spyOn(AcmsGatewayImpl.prototype, 'getCaseIdsToMigrate').mockResolvedValue(caseIds);
    const useCase = new AcmsOrders();

    const actual = await useCase.getCaseIdsToMigrate(context);
    expect(actual).toEqual(caseIds);
  });

  test('should throw error if we cannot get case ids to migrate', async () => {
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
    const useCase = new AcmsOrders();
    const expected = new UnknownError('test-module', {
      message: 'Failed to get case IDs to migrate from the ACMS gateway.',
    });

    const actualError = await getExpectedError<UnknownError>(() =>
      useCase.getCaseIdsToMigrate(context),
    );
    expect(actualError).toEqual(
      expect.objectContaining({
        ...expected,
        module: expect.any(String),
        originalError: expect.anything(),
      }),
    );
  });
});
