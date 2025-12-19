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
  let OktaGateway;
  let CaseNotesMongoRepository;
  let UsersMongoRepository;
  let OktaUserGroupGateway;
  let MockUserGroupGateway;
  let StaffMongoRepository;
  let TrusteeAppointmentsMongoRepository;

  beforeEach(async () => {
    vi.resetModules();

    factory = await import('./factory');

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

    OktaGateway = (await import('./adapters/gateways/okta/okta-gateway')).default;

    CaseNotesMongoRepository = (
      await import('./adapters/gateways/mongo/case-notes.mongo.repository')
    ).CaseNotesMongoRepository;

    UsersMongoRepository = (await import('./adapters/gateways/mongo/user.repository'))
      .UsersMongoRepository;

    OktaUserGroupGateway = (await import('./adapters/gateways/okta/okta-user-group-gateway'))
      .default;

    MockUserGroupGateway = (await import('./testing/mock-gateways/mock-user-group-gateway'))
      .default;

    StaffMongoRepository = (await import('./adapters/gateways/mongo/staff.mongo.repository'))
      .StaffMongoRepository;

    TrusteeAppointmentsMongoRepository = (
      await import('./adapters/gateways/mongo/trustee-appointments.mongo.repository')
    ).TrusteeAppointmentsMongoRepository;
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

  test('getAssignmentRepository', async () => {
    const obj = factory.getAssignmentRepository(dbContext);
    expect(obj).toBeInstanceOf(CaseAssignmentMongoRepository);
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

  test('getOfficesRepository', async () => {
    const context = { ...dbContext };
    context.config.authConfig.provider = 'okta';

    const obj = factory.getOfficesRepository(context);
    expect(obj).toBeInstanceOf(OfficesMongoRepository);
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

  test('getConsolidationOrdersRepository', async () => {
    const obj = factory.getConsolidationOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(ConsolidationOrdersMongoRepository);
  });

  test('getUserSessionCacheRepository', async () => {
    const obj = factory.getUserSessionCacheRepository(dbContext);
    expect(obj).toBeInstanceOf(UserSessionCacheRepository);
  });

  test('getOrdersRepository', async () => {
    const obj = factory.getOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(OrdersMongoRepository);
  });

  test('getRuntimeStateRepository', async () => {
    const obj = factory.getRuntimeStateRepository(dbContext);
    expect(obj).toBeInstanceOf(RuntimeStateMongoRepository);
  });

  test('getCaseNotesRepository', async () => {
    const obj = factory.getCaseNotesRepository(dbContext);
    expect(obj).toBeInstanceOf(CaseNotesMongoRepository);
  });

  test('getUsersRepository', async () => {
    const obj = factory.getUsersRepository(dbContext);
    expect(obj).toBeInstanceOf(UsersMongoRepository);
  });

  test('getAuthorizationGateway should return null if no recognized provider', async () => {
    const contextWithInvalidProvider = { ...dbContext };
    contextWithInvalidProvider.config.authConfig.provider = 'test';
    const result = factory.getAuthorizationGateway(contextWithInvalidProvider);
    expect(result).toBeNull();
  });

  test('getAuthorizationGateway should return real gateway', async () => {
    const contextWithOkta = { ...dbContext };
    contextWithOkta.config.authConfig.provider = 'okta';
    const result = factory.getAuthorizationGateway(contextWithOkta);
    expect(result).toEqual(OktaGateway);
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

  test('getUserGroupGateway should return mock user group gateway', async () => {
    const contextWithMock = { ...dbContext };
    contextWithMock.config.authConfig.provider = 'mock';
    contextWithMock.config.userGroupGatewayConfig.provider = 'mock';
    const result = await factory.getUserGroupGateway(contextWithMock);
    expect(result).toBeInstanceOf(MockUserGroupGateway);
  });

  test('getUserSessionUseCase', async () => {
    const context = { ...dbContext };
    context.config.authConfig.provider = 'okta';

    const obj = factory.getUserSessionUseCase(context);
    expect(obj).toBeInstanceOf(UserSessionUseCase);
  });

  test('getStaffRepository', async () => {
    const obj = factory.getStaffRepository(dbContext);
    expect(obj).toBeInstanceOf(StaffMongoRepository);
  });

  test('getTrusteeAppointmentsRepository', async () => {
    const obj = factory.getTrusteeAppointmentsRepository(dbContext);
    expect(obj).toBeInstanceOf(TrusteeAppointmentsMongoRepository);
  });

  test('getTrusteeAppointmentsRepository mock', async () => {
    const mockObj = factory.getTrusteeAppointmentsRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockMongoRepository);
  });
});
