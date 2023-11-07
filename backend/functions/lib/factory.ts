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

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  return new AttorneyLocalGateway();
};

export const getCasesGateway = (context: ApplicationContext): CasesInterface => {
  if (context.config.get('dbMock')) {
    return new CasesLocalGateway();
  } else {
    return new CasesDxtrGateway();
  }
};

export const getAssignmentRepository = (
  context: ApplicationContext,
): CaseAssignmentRepositoryInterface => {
  if (context.config.get('dbMock')) {
    return new CaseAssignmentCosmosDbRepository(context, true);
  } else {
    return new CaseAssignmentCosmosDbRepository(context);
  }
};

export const getCosmosDbClient = (
  context: ApplicationContext,
  testClient: boolean = false,
): CosmosClientHumble | FakeCosmosClientHumble => {
  return testClient ? new FakeCosmosClientHumble() : new CosmosClientHumble(context.config);
};

export const getCosmosConfig = (context: ApplicationContext): CosmosConfig => {
  return context.config.get('cosmosConfig');
};
