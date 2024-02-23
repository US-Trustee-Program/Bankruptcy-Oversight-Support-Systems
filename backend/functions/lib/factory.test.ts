import { CaseAssignmentCosmosDbRepository } from './adapters/gateways/case.assignment.cosmosdb.repository';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { MockOfficesGateway } from './adapters/gateways/dxtr/mock.offices.gateway';
import { MockOrdersGateway } from './adapters/gateways/dxtr/mock.orders.gateway';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.gateway';
import { DxtrOrdersGateway } from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { CasesLocalGateway } from './adapters/gateways/mock.cases.gateway';
import { OrdersCosmosDbRepository } from './adapters/gateways/orders.cosmosdb.repository';
import { RuntimeStateCosmosDbRepository } from './adapters/gateways/runtime-state.cosmosdb.repository';
import { ApplicationContext } from './adapters/types/basic';
import CosmosClientHumble from './cosmos-humble-objects/cosmos-client-humble';
import FakeAssignmentsCosmosClientHumble from './cosmos-humble-objects/fake.assignments.cosmos-client-humble';
import {
  getAssignmentRepository,
  getAssignmentsCosmosDbClient,
  getCaseDocketUseCase,
  getCasesGateway,
  getOfficesGateway,
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
} from './factory';
import { createMockApplicationContext } from './testing/testing-utilities';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';

describe('Factory functions', () => {
  let dbContext: ApplicationContext;
  let mockDbContext: ApplicationContext;

  beforeAll(async () => {
    dbContext = await createMockApplicationContext({
      DATABASE_MOCK: 'false',
      COSMOS_ENDPOINT: 'https://cosmos-ustp-cams-dev.documents.azure.us:443/',
    });
    mockDbContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('getAttorneyGateway', async () => {
    const obj = getCaseDocketUseCase(dbContext);
    expect(obj).toBeInstanceOf(CaseDocketUseCase);
  });

  test('getCasesGateway', async () => {
    const mockObj = getCasesGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(CasesLocalGateway);

    const obj = getCasesGateway(dbContext);
    expect(obj).toBeInstanceOf(CasesDxtrGateway);
  });

  test('getAssignmentRepository', async () => {
    const obj = getAssignmentRepository(dbContext);
    expect(obj).toBeInstanceOf(CaseAssignmentCosmosDbRepository);
  });

  test('getAssignmentsCosmosDbClient', async () => {
    const mockObj = getAssignmentsCosmosDbClient(mockDbContext);
    expect(mockObj).toBeInstanceOf(FakeAssignmentsCosmosClientHumble);

    const obj = getAssignmentsCosmosDbClient(dbContext);
    expect(obj).toBeInstanceOf(CosmosClientHumble);
  });

  test('getCaseDocketUseCase', async () => {
    const mockObj = getCaseDocketUseCase(mockDbContext);
    expect(mockObj).toBeInstanceOf(CaseDocketUseCase);

    const obj = getCaseDocketUseCase(dbContext);
    expect(obj).toBeInstanceOf(CaseDocketUseCase);
  });

  test('getOrdersGateway', async () => {
    const mockObj = getOrdersGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockOrdersGateway);

    const obj = getOrdersGateway(dbContext);
    expect(obj).toBeInstanceOf(DxtrOrdersGateway);
  });

  test('getOfficesGateway', async () => {
    const mockObj = getOfficesGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockOfficesGateway);

    const obj = getOfficesGateway(dbContext);
    expect(obj).toBeInstanceOf(OfficesDxtrGateway);
  });

  test('getOrdersRepository', async () => {
    const obj = getOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(OrdersCosmosDbRepository);
  });

  test('getRuntimeStateRepository', async () => {
    const obj = getRuntimeStateRepository(dbContext);
    expect(obj).toBeInstanceOf(RuntimeStateCosmosDbRepository);
  });
});
