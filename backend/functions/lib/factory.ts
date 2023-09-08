import { ApplicationConfiguration } from './configs/application-configuration';
import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.local.inmemory.gateway';
import { Chapter11ApiGateway } from './adapters/gateways/cases.azure.sql.gateway';
import { Chapter11GatewayInterface } from './use-cases/chapter-11.gateway.interface';
import { Chapter11LocalGateway } from './adapters/gateways/chapter11.local.gateway';
import { CasesInterface } from './use-cases/cases.interface';
import { CaseAssignmentRepositoryInterface } from './interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './adapters/gateways/case.assignment.local.repository';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import CasesDxtrGateway from './adapters/gateways/cases.dxtr.gateway';
import { CosmosConfig } from './adapters/types/database';
import { CaseAssignmentCosmosDbRepository } from './adapters/gateways/case.assignment.cosmosdb.repository';
import CosmosClientHumble from './cosmos-humble-objects/cosmos-client-humble';
import FakeCosmosClientHumble from './cosmos-humble-objects/fake.cosmos-client-humble';

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();

  if (config.get('dbMock')) {
    return new AttorneyLocalGateway();
  } else {
    return new AttorneyLocalGateway();
    // return new AttorneyApiGateway(); // not yet implemented
  }
};

export const getChapter11Gateway = (): Chapter11GatewayInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();

  if (config.get('dbMock')) {
    return new Chapter11LocalGateway();
  } else {
    return new Chapter11ApiGateway();
  }
};

export const getCasesGateway = (): CasesInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();

  if (config.get('dbMock')) {
    return new CasesLocalGateway();
  } else {
    return new CasesDxtrGateway();
  }
};

export const getAssignmentRepository = (
  context: ApplicationContext,
): CaseAssignmentRepositoryInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();
  if (config.get('dbMock')) {
    if (context.caseAssignmentRepository) {
      return context.caseAssignmentRepository;
    } else {
      context.caseAssignmentRepository = new CaseAssignmentLocalRepository(context);
      return context.caseAssignmentRepository;
    }
  } else {
    return new CaseAssignmentCosmosDbRepository(context);
  }
};

export const getCosmosDbClient = (
  testClient: boolean = false,
): CosmosClientHumble | FakeCosmosClientHumble => {
  // TODO: evaluate whether this should be a singleton
  const config: ApplicationConfiguration = new ApplicationConfiguration();
  return testClient ? new FakeCosmosClientHumble() : new CosmosClientHumble(config);
};

export const getCosmosConfig = (): CosmosConfig => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();
  return config.get('cosmosConfig');
};
