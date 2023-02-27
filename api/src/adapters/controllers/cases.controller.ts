import { NextFunction, Request, Response } from 'express';
import log from '../logging.service';
import useCase from '../../use-cases';
import { RecordObj } from '../types/basic';
import { httpError, httpSuccess } from '../utils/http';

const NAMESPACE = 'CASES-CONTROLLER';

const getAllCases = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Getting all cases.');

  try {
    const caseList = await useCase.listCases();

    // success
    return httpSuccess(caseList);
  } catch (e: any) {
    // 404 Not Found Error
    return httpError(e, 404);
  }
};

/*
          // connection error
          // 503 service unavailable
          return res.status(503).json({
            message: error.message,
            error
          });
  */

const getCase = async (httpRequest: Request) => {
  log('info', NAMESPACE, `Getting single case ${httpRequest.params.caseId}.`);

  try {
    const caseId = +httpRequest.params.caseId;
    const result = await useCase.getCase(caseId);

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
    let { analyst, chapter } = httpRequest.body;
    log('info', NAMESPACE, 'analyst and chapter passed in', httpRequest.body);

    const record: RecordObj[] = [
      {
        fieldName: 'analyst',
        fieldValue: analyst,
      },
      {
        fieldName: 'chapter',
        fieldValue: chapter,
      },
    ];

    const result = await useCase.addCase(record);

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
    let { analyst, chapter } = httpRequest.body;
    const caseId = +httpRequest.params.caseId;

    const record: RecordObj[] = [
      {
        fieldName: 'case_id',
        fieldValue: caseId,
      },
      {
        fieldName: 'analyst',
        fieldValue: analyst,
      },
      {
        fieldName: 'chapter',
        fieldValue: chapter,
      },
    ];

    const result = useCase.updateCase(caseId, record);

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
    const result = await useCase.deleteCase(+httpRequest.params.caseId);
    return httpSuccess(result);
  } catch (e: any) {
    return httpError(e, 400);
  }
};

export default { createCase, getAllCases, getCase, updateCase, deleteCase };
