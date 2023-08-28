import { ApplicationConfiguration } from './configs/application-configuration';
import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.local.inmemory.gateway';
import { Chapter11ApiGateway } from './adapters/gateways/cases.azure.sql.gateway';
import { Chapter11GatewayInterface } from './use-cases/chapter-11.gateway.interface';
import { Chapter11LocalGateway } from './adapters/gateways/cases.local.inmemory.gateway';
import { PacerApiGateway } from './adapters/gateways/pacer.api.gateway';
import { CasesInterface } from './use-cases/cases.interface';
import { PacerLocalGateway } from './adapters/gateways/pacer.local.gateway';
import { PacerSecretsGateway } from './adapters/gateways/pacer-secrets.gateway';
import { PacerSecretsInterface } from './adapters/gateways/pacer-secrets.interface';
import { CaseAssignmentRepositoryInterface } from './interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './adapters/gateways/case.assignment.local.repository';
import { ApplicationContext } from './adapters/types/basic';
// import { ManagedIdentityCredential, DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

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

export const getPacerGateway = (): CasesInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();

  if (config.get('pacerMock')) {
    return new PacerLocalGateway();
  } else {
    return new PacerApiGateway();
  }
};

export const getPacerTokenSecretGateway = (): PacerSecretsInterface => {
  return new PacerSecretsGateway();
};

export const getAssignmentRepository = (
  context: ApplicationContext,
): CaseAssignmentRepositoryInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();
  if (config.get('dbMock')) {
    console.log('===DEBUG=== data is being mocked');
    if (Object.prototype.hasOwnProperty.call(context.caseAssignmentRepository, 'getCount')) {
      console.log('===DEBUG=== Repository is already initialized.');
      return context.caseAssignmentRepository;
    } else {
      console.log('===DEBUG=== Repository is being NEWLY initialized.');
      context.caseAssignmentRepository = new CaseAssignmentLocalRepository();
      return context.caseAssignmentRepository;
    }
  } else {
    return new CaseAssignmentLocalRepository(); // to be replaced with the cosmosdb repository, once implemented.
  }
};

export const getCosmosDbClient = (): CosmosClient => {
  // return new CosmosClient({
  //   endpoint: this.dbEndpoint,
  //   aadCredentials: this.managedId
  //     ? new ManagedIdentityCredential({
  //         clientId: this.managedId,
  //       })
  //     : new DefaultAzureCredential(),
  // });

  return null;
};
