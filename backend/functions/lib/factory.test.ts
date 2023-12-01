import { CaseAssignmentCosmosDbRepository } from './adapters/gateways/case.assignment.cosmosdb.repository';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { applicationContextCreator } from './adapters/utils/application-context-creator';
import { getAssignmentRepository, getCaseDocketUseCase, getCasesGateway } from './factory';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';

const functionContext = require('azure-function-context-mock');

describe('Verify select factory methods that depend on config flag DATABASE_MOCK', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env.DATABASE_MOCK = 'false';
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test.skip('should return object of type CaseAssignmentCosmosDbRepository', async () => {
    // TODO This test fails in pipeline
    const applicationContext = await applicationContextCreator(functionContext);
    const assignmentRepository = getAssignmentRepository(applicationContext);
    expect(assignmentRepository).toBeInstanceOf(CaseAssignmentCosmosDbRepository);
  });

  test('should return object of type CasesDxtrGateway', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const factoryObj = getCasesGateway(applicationContext);
    expect(factoryObj).toBeInstanceOf(CasesDxtrGateway);
  });

  test('should return object of type CaseDocketUseCase', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const factoryObj = getCaseDocketUseCase(applicationContext);
    expect(factoryObj).toBeInstanceOf(CaseDocketUseCase);
  });
});
