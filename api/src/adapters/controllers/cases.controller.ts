import { Request } from 'express';
import log from '../logging.service';
import useCase from '../../use-cases';
import { RecordObj } from '../types/basic';
import { httpError, httpSuccess } from '../utils/http';
import proxyData from '../data-access.proxy';
import { CasePersistenceGateway } from '../types/persistence-gateway';

const NAMESPACE = 'CASES-CONTROLLER';

const casesDb: CasePersistenceGateway = (await proxyData('cases')) as CasePersistenceGateway;

const getAllCases = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Getting all cases.');

  try {
    const caseList = await useCase.listCases(casesDb);

    // success
    return httpSuccess(caseList);
  } catch (e: any) {
    // 404 Not Found Error
    return httpError(e, 404);
  }
};

const getCase = async (httpRequest: Request) => {
  log('info', NAMESPACE, `Getting single case ${httpRequest.params.caseId}.`);

  try {
    const caseId = +httpRequest.params.caseId;
    const result = await useCase.getCase(casesDb, caseId);

    // success
    return httpSuccess(result);
  } catch (e: any) {
    // 404 Not Found Error
    return httpError(e, 404);
  }
};

const createCase = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Inserting Case');

  try {
    log('info', NAMESPACE, 'analyst and chapter passed in', httpRequest.body);

    let record: RecordObj[] = [];

    for (let rec in httpRequest.body) {
      record.push({
        fieldName: rec,
        fieldValue: httpRequest.body[rec],
      } as RecordObj);
    }

    const result = await useCase.addCase(casesDb, record);

    // success
    return httpSuccess(result);
  } catch (e: any) {
    // 400 Error creating record
    return httpError(e, 400);
  }
};

const updateCase = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Updating Case');

  try {
    const caseId = +httpRequest.params.caseId;

    let record: RecordObj[] = [];

    for (let rec in httpRequest.body) {
      record.push({
        fieldName: rec,
        fieldValue: httpRequest.body[rec],
      } as RecordObj);
    }

    const result = await useCase.updateCase(casesDb, caseId, record);
    console.log(result);

    // success
    return httpSuccess(result);
  } catch (e: any) {
    // 400 Error updating record
    return httpError(e, 400);
  }
};

const deleteCase = async (httpRequest: Request) => {
  log('info', NAMESPACE, `Deleting case ${httpRequest.params.caseId}.`);

  try {
    const result = await useCase.deleteCase(casesDb, +httpRequest.params.caseId);
    return httpSuccess(result);
  } catch (e: any) {
    return httpError(e, 400);
  }
};

export default { createCase, getAllCases, getCase, updateCase, deleteCase };
