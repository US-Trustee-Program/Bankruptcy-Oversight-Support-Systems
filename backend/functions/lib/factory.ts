import { ApplicationConfiguration } from './configs/application-configuration';
import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.local.inmemory.gateway';
import { Chapter11ApiGateway } from './adapters/gateways/cases.azure.sql.gateway';
import { Chapter11GatewayInterface } from './use-cases/chapter-11.gateway.interface';
import { Chapter11LocalGateway } from './adapters/gateways/cases.local.inmemory.gateway';
import { CasesInterface } from './use-cases/cases.interface';
import { CaseAssignmentRepositoryInterface } from './interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './adapters/gateways/case.assignment.local.repository';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import CasesDxtrGateway from './adapters/gateways/cases.dxtr.gateway';

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
