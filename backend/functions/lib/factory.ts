import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.local.inmemory.gateway';
import { CasesInterface } from './use-cases/cases.interface';
import { CaseAssignmentRepositoryInterface } from './interfaces/case.assignment.repository.interface';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { CosmosConfig } from './adapters/types/database';
import { CaseAssignmentCosmosDbRepository } from './adapters/gateways/case.assignment.cosmosdb.repository';
import CosmosClientHumble from './cosmos-humble-objects/cosmos-client-humble';
import FakeCosmosClientHumble from './cosmos-humble-objects/fake.cosmos-client-humble';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  return new AttorneyLocalGateway();
};

export const getCasesGateway = (applicationContext: ApplicationContext): CasesInterface => {
  if (applicationContext.config.get('dbMock')) {
    return new CasesLocalGateway();
  } else {
    return new CasesDxtrGateway();
  }
};

export const getAssignmentRepository = (
  applicationContext: ApplicationContext,
): CaseAssignmentRepositoryInterface => {
  if (applicationContext.config.get('dbMock')) {
    return new CaseAssignmentCosmosDbRepository(applicationContext, true);
  } else {
    return new CaseAssignmentCosmosDbRepository(applicationContext);
  }
};

export const getCosmosDbClient = (
  applicationContext: ApplicationContext,
  testClient: boolean = false,
): CosmosClientHumble | FakeCosmosClientHumble => {
  return testClient
    ? new FakeCosmosClientHumble()
    : new CosmosClientHumble(applicationContext.config);
};

export const getCosmosConfig = (applicationContext: ApplicationContext): CosmosConfig => {
  return applicationContext.config.get('cosmosConfig');
};

export const getCaseDocketUseCase = (applicationContext: ApplicationContext): CaseDocketUseCase => {
  return new CaseDocketUseCase(applicationContext);
};
