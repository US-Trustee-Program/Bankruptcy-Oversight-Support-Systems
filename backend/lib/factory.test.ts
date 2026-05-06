import { vi } from 'vitest';
import { ApplicationContext } from './adapters/types/basic';
import OktaHumble from './humble-objects/okta-humble';
import { createMockApplicationContext } from './testing/testing-utilities';

describe('Factory function-apps', () => {
  let dbContext: ApplicationContext;
  let mockDbContext: ApplicationContext;
  let factory;

  let RuntimeStateMongoRepository;
  let MockMongoRepository;
  let OrdersMongoRepository;
  let ConsolidationOrdersMongoRepository;
  let CaseAssignmentMongoRepository;
  let MockOfficesGateway;
  let MockOrdersGateway;
  let DxtrOrdersGateway;
  let OfficesDxtrGateway;
  let OfficesMongoRepository;
  let CaseDocketUseCase;
  let CasesLocalGateway;
  let CasesDxtrGateway;
  let UserSessionCacheRepository;
  let UserSessionUseCase;
  let MockUserSessionUseCase;
  let OktaGateway;
  let MockOpenIdConnectGateway;
  let CaseNotesMongoRepository;
  let TrusteeNotesMongoRepository;
  let UsersMongoRepository;
  let OktaUserGroupGateway;
  let MockUserGroupGateway;
  let TrusteeAppointmentsMongoRepository;
  let TrusteesMongoRepository;
  let TrusteeAssistantsMongoRepository;
  let ArchivedCasesMongoRepository;
  let ListsMongoRepository;
  let UserGroupsMongoRepository;
  let OfficeAssigneeMongoRepository;
  let TrusteeUpcomingKeyDatesMongoRepository;
  let TrusteeMatchVerificationMongoRepository;
  let TrusteeProfessionalIdsMongoRepository;
  let LocalStorageGateway;
  let AzureBlobObjectStorageGateway;
  let AcmsGatewayImpl;
  let AtsGatewayImpl;
  let MockAtsGateway;
  let ApiToDataflowsGatewayImpl;

  beforeEach(async () => {
    vi.resetModules();

    factory = (await import('./factory')).default;

    RuntimeStateMongoRepository = (
      await import('./adapters/gateways/mongo/runtime-state.mongo.repository')
    ).RuntimeStateMongoRepository;

    MockMongoRepository = (await import('./testing/mock-gateways/mock-mongo.repository'))
      .MockMongoRepository;

    OrdersMongoRepository = (await import('./adapters/gateways/mongo/orders.mongo.repository'))
      .OrdersMongoRepository;

    UserSessionCacheRepository = (
      await import('./adapters/gateways/mongo/user-session-cache.mongo.repository')
    ).UserSessionCacheMongoRepository;

    ConsolidationOrdersMongoRepository = (
      await import('./adapters/gateways/mongo/consolidations.mongo.repository')
    ).default;

    MockOfficesGateway = (await import('./testing/mock-gateways/mock.offices.gateway'))
      .MockOfficesGateway;

    MockOrdersGateway = (await import('./testing/mock-gateways/mock.orders.gateway'))
      .MockOrdersGateway;

    DxtrOrdersGateway = (await import('./adapters/gateways/dxtr/orders.dxtr.gateway')).default;

    CaseDocketUseCase = (await import('./use-cases/case-docket/case-docket')).CaseDocketUseCase;

    OfficesDxtrGateway = (await import('./adapters/gateways/dxtr/offices.dxtr.gateway')).default;

    CasesLocalGateway = (await import('./adapters/gateways/cases.local.gateway')).CasesLocalGateway;

    CasesDxtrGateway = (await import('./adapters/gateways/dxtr/cases.dxtr.gateway')).default;

    CaseAssignmentMongoRepository = (
      await import('./adapters/gateways/mongo/case-assignment.mongo.repository')
    ).CaseAssignmentMongoRepository;

    OfficesMongoRepository = (await import('./adapters/gateways/mongo/offices.mongo.repository'))
      .OfficesMongoRepository;

    UserSessionUseCase = (await import('./use-cases/user-session/user-session')).UserSessionUseCase;

    MockUserSessionUseCase = (await import('./testing/mock-gateways/mock-user-session-use-case'))
      .MockUserSessionUseCase;

    OktaGateway = (await import('./adapters/gateways/okta/okta-gateway')).default;

    MockOpenIdConnectGateway = (await import('./testing/mock-gateways/mock-oauth2-gateway'))
      .default;

    CaseNotesMongoRepository = (
      await import('./adapters/gateways/mongo/case-notes.mongo.repository')
    ).CaseNotesMongoRepository;

    TrusteeNotesMongoRepository = (
      await import('./adapters/gateways/mongo/trustee-notes.mongo.repository')
    ).TrusteeNotesMongoRepository;

    UsersMongoRepository = (await import('./adapters/gateways/mongo/user.repository'))
      .UsersMongoRepository;

    OktaUserGroupGateway = (await import('./adapters/gateways/okta/okta-user-group-gateway'))
      .default;

    MockUserGroupGateway = (await import('./testing/mock-gateways/mock-user-group-gateway'))
      .default;

    TrusteeAppointmentsMongoRepository = (
      await import('./adapters/gateways/mongo/trustee-appointments.mongo.repository')
    ).TrusteeAppointmentsMongoRepository;

    TrusteesMongoRepository = (await import('./adapters/gateways/mongo/trustees.mongo.repository'))
      .TrusteesMongoRepository;

    TrusteeAssistantsMongoRepository = (
      await import('./adapters/gateways/mongo/trustee-assistants.mongo.repository')
    ).TrusteeAssistantsMongoRepository;

    ArchivedCasesMongoRepository = (
      await import('./adapters/gateways/mongo/archived-cases.mongo.repository')
    ).ArchivedCasesMongoRepository;

    ListsMongoRepository = (await import('./adapters/gateways/mongo/lists.mongo.repository'))
      .ListsMongoRepository;

    UserGroupsMongoRepository = (
      await import('./adapters/gateways/mongo/user-groups.mongo.repository')
    ).UserGroupsMongoRepository;

    OfficeAssigneeMongoRepository = (
      await import('./adapters/gateways/mongo/office-assignee.mongo.repository')
    ).OfficeAssigneeMongoRepository;

    TrusteeUpcomingKeyDatesMongoRepository = (
      await import('./adapters/gateways/mongo/trustee-upcoming-key-dates.mongo.repository')
    ).TrusteeUpcomingKeyDatesMongoRepository;

    TrusteeMatchVerificationMongoRepository = (
      await import('./adapters/gateways/mongo/trustee-match-verification.mongo.repository')
    ).TrusteeMatchVerificationMongoRepository;

    TrusteeProfessionalIdsMongoRepository = (
      await import('./adapters/gateways/mongo/trustee-professional-ids.mongo.repository')
    ).TrusteeProfessionalIdsMongoRepository;

    LocalStorageGateway = (await import('./adapters/gateways/storage/local-storage-gateway'))
      .default;

    AzureBlobObjectStorageGateway = (
      await import('./adapters/gateways/storage/azure-blob-object-storage.gateway')
    ).AzureBlobObjectStorageGateway;

    AcmsGatewayImpl = (await import('./adapters/gateways/acms/acms.gateway')).AcmsGatewayImpl;

    AtsGatewayImpl = (await import('./adapters/gateways/ats/ats.gateway')).AtsGatewayImpl;

    MockAtsGateway = (await import('./adapters/gateways/ats/ats.mock.gateway')).MockAtsGateway;

    ApiToDataflowsGatewayImpl = (
      await import('./adapters/gateways/api-to-dataflows/api-to-dataflows.gateway')
    ).ApiToDataflowsGatewayImpl;
  });

  beforeAll(async () => {
    dbContext = await createMockApplicationContext({
      env: {
        CAMS_LOGIN_PROVIDER: 'okta',
        DATABASE_MOCK: 'false',
        COSMOS_ENDPOINT: 'https://cosmos-ustp-cams-dev.documents.azure.us:443/',
        CAMS_USER_GROUP_GATEWAY_CONFIG:
          'url=https://fake.url|clientId=mock|keyId=mock|privateKey={"foo": "bar"}}',
      },
    });
    mockDbContext = await createMockApplicationContext();
  });

  test('getAttorneyGateway', async () => {
    const obj = factory.getCaseDocketUseCase(dbContext);
    expect(obj).toBeInstanceOf(CaseDocketUseCase);
  });

  test('getCasesGateway mock', async () => {
    const mockObj = factory.getCasesGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(CasesLocalGateway);
  });

  test('getCasesGateway DXTR', async () => {
    const obj = factory.getCasesGateway(dbContext);
    expect(obj).toBeInstanceOf(CasesDxtrGateway);
  });

  test('getCasesGateway returns cached instance on second call', async () => {
    const first = factory.getCasesGateway(dbContext);
    const second = factory.getCasesGateway(dbContext);
    expect(second).toBe(first);
  });

  test('getAssignmentRepository real', async () => {
    const obj = factory.getAssignmentRepository(dbContext);
    expect(obj).toBeInstanceOf(CaseAssignmentMongoRepository);
  });

  test('getAssignmentRepository mock', async () => {
    const mockObj = factory.getAssignmentRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getCaseDocketUseCase mock', async () => {
    const mockObj = factory.getCaseDocketUseCase(mockDbContext);
    expect(mockObj).toBeInstanceOf(CaseDocketUseCase);
  });

  test('getCaseDocketUseCase DXTR', async () => {
    const obj = factory.getCaseDocketUseCase(dbContext);
    expect(obj).toBeInstanceOf(CaseDocketUseCase);
  });

  test('getOrdersGateway mock', async () => {
    const mockObj = factory.getOrdersGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockOrdersGateway);
  });

  test('getOrdersGateway DXTR', async () => {
    const obj = factory.getOrdersGateway(dbContext);
    expect(obj).toBeInstanceOf(DxtrOrdersGateway);
  });

  test('getOrdersGateway returns cached instance on second call', async () => {
    const first = factory.getOrdersGateway(dbContext);
    const second = factory.getOrdersGateway(dbContext);
    expect(second).toBe(first);
  });

  test('getOfficesRepository real', async () => {
    const context = { ...dbContext };
    context.config.authConfig.provider = 'okta';

    const obj = factory.getOfficesRepository(context);
    expect(obj).toBeInstanceOf(OfficesMongoRepository);
  });

  test('getOfficesRepository mock', async () => {
    const context = { ...mockDbContext };
    context.config.authConfig.provider = 'mock';

    const obj = factory.getOfficesRepository(context);
    expect(obj).toBeInstanceOf(MockMongoRepository);
  });

  test('getOfficesGateway mock', async () => {
    const mockObj = factory.getOfficesGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockOfficesGateway);
  });

  test('getOfficesGateway DXTR', async () => {
    const obj = factory.getOfficesGateway(dbContext);
    expect(obj).toBeInstanceOf(OfficesDxtrGateway);
  });

  test('getOrdersRepository mock', async () => {
    const mockObj = factory.getOrdersRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getOrdersRepository mock returns cached instance on second call', async () => {
    const first = factory.getOrdersRepository(mockDbContext);
    const second = factory.getOrdersRepository(mockDbContext);
    expect(second).toBe(first);
  });

  test('getConsolidationOrdersRepository', async () => {
    const obj = factory.getConsolidationOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(ConsolidationOrdersMongoRepository);
  });

  test('getConsolidationOrdersRepository mock', async () => {
    const mockObj = factory.getConsolidationOrdersRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getConsolidationOrdersRepository mock returns cached instance on second call', async () => {
    const first = factory.getConsolidationOrdersRepository(mockDbContext);
    const second = factory.getConsolidationOrdersRepository(mockDbContext);
    expect(second).toBe(first);
  });

  test('getCasesRepository real', async () => {
    const obj = factory.getCasesRepository(dbContext);
    expect(obj).toBeDefined();
  });

  test('getCasesRepository mock', async () => {
    const mockObj = factory.getCasesRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getCasesRepository mock returns cached instance on second call', async () => {
    const first = factory.getCasesRepository(mockDbContext);
    const second = factory.getCasesRepository(mockDbContext);
    expect(second).toBe(first);
  });

  test('getUserSessionCacheRepository real', async () => {
    const obj = factory.getUserSessionCacheRepository(dbContext);
    expect(obj).toBeInstanceOf(UserSessionCacheRepository);
  });

  test('getUserSessionCacheRepository mock', async () => {
    const mockObj = factory.getUserSessionCacheRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getUserSessionCacheRepository mock returns cached instance on second call', async () => {
    const first = factory.getUserSessionCacheRepository(mockDbContext);
    const second = factory.getUserSessionCacheRepository(mockDbContext);
    expect(second).toBe(first);
  });

  test('getOrdersRepository', async () => {
    const obj = factory.getOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(OrdersMongoRepository);
  });

  test('getRuntimeStateRepository real', async () => {
    const obj = factory.getRuntimeStateRepository(dbContext);
    expect(obj).toBeInstanceOf(RuntimeStateMongoRepository);
  });

  test('getRuntimeStateRepository mock', async () => {
    const mockObj = factory.getRuntimeStateRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getOrderSyncStateRepo creates and caches', async () => {
    const first = factory.getOrderSyncStateRepo(dbContext);
    const second = factory.getOrderSyncStateRepo(dbContext);
    expect(second).toBe(first);
  });

  test('getOfficeStaffSyncStateRepo creates and caches', async () => {
    const first = factory.getOfficeStaffSyncStateRepo(dbContext);
    const second = factory.getOfficeStaffSyncStateRepo(dbContext);
    expect(second).toBe(first);
  });

  test('getCasesSyncStateRepo creates and caches', async () => {
    const first = factory.getCasesSyncStateRepo(dbContext);
    const second = factory.getCasesSyncStateRepo(dbContext);
    expect(second).toBe(first);
  });

  test('getPhoneticBackfillStateRepo creates and caches', async () => {
    const first = factory.getPhoneticBackfillStateRepo(dbContext);
    const second = factory.getPhoneticBackfillStateRepo(dbContext);
    expect(second).toBe(first);
  });

  test('getCaseAppointmentDateBackfillStateRepo creates and caches', async () => {
    const first = factory.getCaseAppointmentDateBackfillStateRepo(dbContext);
    const second = factory.getCaseAppointmentDateBackfillStateRepo(dbContext);
    expect(second).toBe(first);
  });

  test('getTrusteeAppointmentsSyncStateRepo creates and caches', async () => {
    const first = factory.getTrusteeAppointmentsSyncStateRepo(dbContext);
    const second = factory.getTrusteeAppointmentsSyncStateRepo(dbContext);
    expect(second).toBe(first);
  });

  test('getTrusteeNotesMetricsSyncStateRepo creates and caches', async () => {
    const first = factory.getTrusteeNotesMetricsSyncStateRepo(dbContext);
    const second = factory.getTrusteeNotesMetricsSyncStateRepo(dbContext);
    expect(second).toBe(first);
  });

  test('getCaseNotesRepository real', async () => {
    const obj = factory.getCaseNotesRepository(dbContext);
    expect(obj).toBeInstanceOf(CaseNotesMongoRepository);
  });

  test('getCaseNotesRepository mock', async () => {
    const mockObj = factory.getCaseNotesRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getTrusteeNotesRepository real', async () => {
    const obj = factory.getTrusteeNotesRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteeNotesMongoRepository);
  });

  test('getTrusteeNotesRepository mock', async () => {
    const mockObj = factory.getTrusteeNotesRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getArchivedCasesRepository real', async () => {
    const obj = factory.getArchivedCasesRepository(dbContext);
    expect(obj).toBeInstanceOf(ArchivedCasesMongoRepository);
  });

  test('getArchivedCasesRepository mock', async () => {
    const mockObj = factory.getArchivedCasesRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getUsersRepository real', async () => {
    const obj = factory.getUsersRepository(dbContext);
    expect(obj).toBeInstanceOf(UsersMongoRepository);
  });

  test('getUsersRepository real returns cached instance on second call', async () => {
    const first = factory.getUsersRepository(dbContext);
    const second = factory.getUsersRepository(dbContext);
    expect(second).toBe(first);
  });

  test('getUsersRepository mock', async () => {
    const mockObj = factory.getUsersRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getAuthorizationGateway should return null if no recognized provider', async () => {
    const contextWithInvalidProvider = { ...dbContext };
    contextWithInvalidProvider.config.authConfig.provider = 'test';
    const result = factory.getAuthorizationGateway(contextWithInvalidProvider);
    expect(result).toBeNull();
  });

  test('getAuthorizationGateway should return OktaGateway for okta provider', async () => {
    const contextWithOkta = { ...dbContext };
    contextWithOkta.config.authConfig.provider = 'okta';
    const result = factory.getAuthorizationGateway(contextWithOkta);
    expect(result).toEqual(OktaGateway);
  });

  test('getAuthorizationGateway should return MockOpenIdConnectGateway for mock provider', async () => {
    const contextWithMock = { ...dbContext };
    contextWithMock.config.authConfig.provider = 'mock';
    const result = factory.getAuthorizationGateway(contextWithMock);
    expect(result).toEqual(MockOpenIdConnectGateway);
  });

  test('getUserGroupGateway should return Okta user group gateway', async () => {
    const contextWithOkta = { ...dbContext };
    contextWithOkta.config.authConfig.provider = 'okta';
    contextWithOkta.config.userGroupGatewayConfig.provider = 'okta';
    contextWithOkta.config.userGroupGatewayConfig.clientId = 'mock';
    contextWithOkta.config.userGroupGatewayConfig.keyId = 'mock';
    contextWithOkta.config.userGroupGatewayConfig.url = 'https://fake.url';
    contextWithOkta.config.userGroupGatewayConfig.privateKey = '{}';
    vi.spyOn(OktaHumble.prototype, 'init').mockImplementation(vi.fn());

    const result = await factory.getUserGroupGateway(contextWithOkta);
    expect(result).toBeInstanceOf(OktaUserGroupGateway);
  });

  test('getUserGroupGateway returns cached instance on second call for okta', async () => {
    const contextWithOkta = { ...dbContext };
    contextWithOkta.config.authConfig.provider = 'okta';
    contextWithOkta.config.userGroupGatewayConfig.provider = 'okta';
    contextWithOkta.config.userGroupGatewayConfig.clientId = 'mock';
    contextWithOkta.config.userGroupGatewayConfig.keyId = 'mock';
    contextWithOkta.config.userGroupGatewayConfig.url = 'https://fake.url';
    contextWithOkta.config.userGroupGatewayConfig.privateKey = '{}';
    vi.spyOn(OktaHumble.prototype, 'init').mockImplementation(vi.fn());

    const first = await factory.getUserGroupGateway(contextWithOkta);
    const second = await factory.getUserGroupGateway(contextWithOkta);
    expect(second).toBe(first);
  });

  test('getUserGroupGateway should return mock user group gateway', async () => {
    const contextWithMock = { ...dbContext };
    contextWithMock.config.authConfig.provider = 'mock';
    contextWithMock.config.userGroupGatewayConfig.provider = 'mock';
    const result = await factory.getUserGroupGateway(contextWithMock);
    expect(result).toBeInstanceOf(MockUserGroupGateway);
  });

  test('getUserGroupGateway throws when init fails for okta', async () => {
    const contextWithOkta = { ...dbContext };
    contextWithOkta.config.authConfig.provider = 'okta';
    contextWithOkta.config.userGroupGatewayConfig.provider = 'okta';
    contextWithOkta.config.userGroupGatewayConfig.clientId = 'mock';
    contextWithOkta.config.userGroupGatewayConfig.keyId = 'mock';
    contextWithOkta.config.userGroupGatewayConfig.url = 'https://fake.url';
    contextWithOkta.config.userGroupGatewayConfig.privateKey = '{}';
    vi.spyOn(OktaUserGroupGateway.prototype, 'init').mockRejectedValue(new Error('init failed'));

    await expect(factory.getUserGroupGateway(contextWithOkta)).rejects.toThrow();
  });

  test('getUserGroupGateway throws for unsupported provider', async () => {
    const contextWithBadProvider = { ...dbContext };
    contextWithBadProvider.config.authConfig.provider = 'unsupported';

    await expect(factory.getUserGroupGateway(contextWithBadProvider)).rejects.toThrow();
  });

  test('getUserSessionUseCase real', async () => {
    const context = { ...dbContext };
    context.config.authConfig.provider = 'okta';

    const obj = factory.getUserSessionUseCase(context);
    expect(obj).toBeInstanceOf(UserSessionUseCase);
  });

  test('getUserSessionUseCase mock', async () => {
    const context = { ...dbContext };
    context.config.authConfig.provider = 'mock';

    const obj = factory.getUserSessionUseCase(context);
    expect(obj).toBeInstanceOf(MockUserSessionUseCase);
  });

  test('getStorageGateway returns LocalStorageGateway', async () => {
    const obj = factory.getStorageGateway(dbContext);
    expect(obj).toEqual(LocalStorageGateway);
  });

  test('getStorageGateway returns cached instance on second call', async () => {
    const first = factory.getStorageGateway(dbContext);
    const second = factory.getStorageGateway(dbContext);
    expect(second).toBe(first);
  });

  test('getObjectStorageGateway returns AzureBlobObjectStorageGateway', async () => {
    const obj = factory.getObjectStorageGateway(dbContext);
    expect(obj).toBeInstanceOf(AzureBlobObjectStorageGateway);
  });

  test('getObjectStorageGateway returns cached instance on second call', async () => {
    const first = factory.getObjectStorageGateway(dbContext);
    const second = factory.getObjectStorageGateway(dbContext);
    expect(second).toBe(first);
  });

  test('getAcmsGateway returns AcmsGatewayImpl', async () => {
    const obj = factory.getAcmsGateway(dbContext);
    expect(obj).toBeInstanceOf(AcmsGatewayImpl);
  });

  test('getAcmsGateway returns cached instance on second call', async () => {
    const first = factory.getAcmsGateway(dbContext);
    const second = factory.getAcmsGateway(dbContext);
    expect(second).toBe(first);
  });

  test('getAtsGateway mock', async () => {
    const mockObj = factory.getAtsGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockAtsGateway);
  });

  test('getAtsGateway real', async () => {
    const obj = factory.getAtsGateway(dbContext);
    expect(obj).toBeInstanceOf(AtsGatewayImpl);
  });

  test('getAtsGateway returns cached instance on second call', async () => {
    const first = factory.getAtsGateway(dbContext);
    const second = factory.getAtsGateway(dbContext);
    expect(second).toBe(first);
  });

  test('getOfficeAssigneesRepository mock', async () => {
    const mockObj = factory.getOfficeAssigneesRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getOfficeAssigneesRepository real', async () => {
    const obj = factory.getOfficeAssigneesRepository(dbContext);
    expect(obj).toBeInstanceOf(OfficeAssigneeMongoRepository);
  });

  test('getUserGroupsRepository mock', async () => {
    const mockObj = factory.getUserGroupsRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getUserGroupsRepository real', async () => {
    const obj = factory.getUserGroupsRepository(dbContext);
    expect(obj).toBeInstanceOf(UserGroupsMongoRepository);
  });

  test('getTrusteesRepository real', async () => {
    const obj = factory.getTrusteesRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteesMongoRepository);
  });

  test('getTrusteesRepository mock', async () => {
    const mockObj = factory.getTrusteesRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getTrusteeAppointmentsRepository real', async () => {
    const obj = factory.getTrusteeAppointmentsRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteeAppointmentsMongoRepository);
  });

  test('getTrusteeAppointmentsRepository mock', async () => {
    const mockObj = factory.getTrusteeAppointmentsRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getTrusteeAssistantsRepository real', async () => {
    const obj = factory.getTrusteeAssistantsRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteeAssistantsMongoRepository);
  });

  test('getTrusteeAssistantsRepository mock', async () => {
    const mockObj = factory.getTrusteeAssistantsRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getListsGateway real', async () => {
    const obj = factory.getListsGateway(dbContext);
    expect(obj).toBeInstanceOf(ListsMongoRepository);
  });

  test('getListsGateway mock', async () => {
    const mockObj = factory.getListsGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getTrusteeUpcomingKeyDatesRepository real', async () => {
    const obj = factory.getTrusteeUpcomingKeyDatesRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteeUpcomingKeyDatesMongoRepository);
  });

  test('getTrusteeUpcomingKeyDatesRepository mock', async () => {
    const mockObj = factory.getTrusteeUpcomingKeyDatesRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getTrusteeMatchVerificationRepository real', async () => {
    const obj = factory.getTrusteeMatchVerificationRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteeMatchVerificationMongoRepository);
  });

  test('getTrusteeMatchVerificationRepository mock', async () => {
    const mockObj = factory.getTrusteeMatchVerificationRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getTrusteeProfessionalIdsRepository real', async () => {
    const obj = factory.getTrusteeProfessionalIdsRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteeProfessionalIdsMongoRepository);
  });

  test('getTrusteeProfessionalIdsRepository mock', async () => {
    const mockObj = factory.getTrusteeProfessionalIdsRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });

  test('getApiToDataflowsGateway', async () => {
    const obj = factory.getApiToDataflowsGateway(dbContext);
    expect(obj).toBeInstanceOf(ApiToDataflowsGatewayImpl);
  });
});
