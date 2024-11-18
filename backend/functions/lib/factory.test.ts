import { ApplicationContext } from './adapters/types/basic';
import { createMockApplicationContext } from './testing/testing-utilities';

describe('Factory functions', () => {
  let dbContext: ApplicationContext;
  let mockDbContext: ApplicationContext;
  let factory;

  let RuntimeStateMongoRepository;
  let MockMongoRepository;
  let OrdersMongoRepository;
  let CaseAssignmentMongoRepository;
  let MockOfficesGateway;
  let MockOrdersGateway;
  let DxtrOrdersGateway;
  let OfficesDxtrGateway;
  let CaseDocketUseCase;
  let CasesLocalGateway;
  let CasesDxtrGateway;

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
    });
  });

  beforeAll(async () => {
    dbContext = await createMockApplicationContext({
      env: {
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

  test('getOrdersRepository DXTR', async () => {
    const obj = factory.getOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(OrdersMongoRepository);
  });

  test('getRuntimeStateRepository', async () => {
    const obj = factory.getRuntimeStateRepository(dbContext);
    expect(obj).toBeInstanceOf(RuntimeStateMongoRepository);
  });
});
