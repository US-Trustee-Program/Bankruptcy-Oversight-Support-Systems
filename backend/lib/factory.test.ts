import { ApplicationContext } from './adapters/types/basic';
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

  beforeEach(async () => {
    await jest.isolateModulesAsync(async () => {
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

      DxtrOrdersGateway = (await import('./adapters/gateways/dxtr/orders.dxtr.gateway'))
        .DxtrOrdersGateway;

      CaseDocketUseCase = (await import('./use-cases/case-docket/case-docket')).CaseDocketUseCase;

      OfficesDxtrGateway = (await import('./adapters/gateways/dxtr/offices.dxtr.gateway')).default;

      CasesLocalGateway = (await import('./adapters/gateways/cases.local.gateway'))
        .CasesLocalGateway;

      CasesDxtrGateway = (await import('./adapters/gateways/dxtr/cases.dxtr.gateway')).default;

      CaseAssignmentMongoRepository = (
        await import('./adapters/gateways/mongo/case-assignment.mongo.repository')
      ).CaseAssignmentMongoRepository;

      OfficesMongoRepository = (await import('./adapters/gateways/mongo/offices.mongo.repository'))
        .OfficesMongoRepository;

      UserSessionUseCase = (await import('./use-cases/user-session/user-session'))
        .UserSessionUseCase;

      OktaGateway = (await import('./adapters/gateways/okta/okta-gateway')).default;
    });
  });

  beforeAll(async () => {
    dbContext = await createMockApplicationContext({
      env: {
        CAMS_LOGIN_PROVIDER: 'okta',
        DATABASE_MOCK: 'false',
        COSMOS_ENDPOINT: 'https://cosmos-ustp-cams-dev.documents.azure.us:443/',
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

  test('getUserSessionUseCase', async () => {
    const context = { ...dbContext };
    context.config.authConfig.provider = 'okta';

    const obj = factory.getUserSessionUseCase(context);
    expect(obj).toBeInstanceOf(UserSessionUseCase);
  });
});