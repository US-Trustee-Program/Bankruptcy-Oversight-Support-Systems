import { NextFunction, Request, Response } from 'express';
import logging from '../logging.service';
//import { getAllFrom, createRecord, getRecord, updateRecord, deleteRecord } from '../models/mock/cases.model';
import cases from '../models/mock/cases.model';

const NAMESPACE = 'CASES-CONTROLLER';

const getAllCases = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Getting all cases.');

  const result = cases.getAll();

  if (result && result.hasOwnProperty('success')) {
    return res.status(200).json({
      message: 'cases list',
      count: 1,
      body: result
    });
  } else {
    return res.status(404).json({
      message: 'Record not found'
    });
  }
};

  /*
          // success
          return res.status(200).json({
            results
          });

          // 404 Not Found Error
          return res.status(404).json({
            message: error.message,
            error
          });

          // connection error
          // 503 service unavailable
          return res.status(503).json({
            message: error.message,
            error
          });
  */

const getCase = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, `Getting single case ${req.params.caseId}.`);

  let result = cases.getRecord(req.params.caseId);

  if (result && result.hasOwnProperty('success')) {
    return res.status(200).json({
      message: 'cases list',
      count: 1,
      body: result
    });
  } else {
    return res.status(404).json({
      message: 'Record not found'
    });
  }
};

const createCase = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Inserting Case');

  let { analyst, chapter } = req.body;
  logging.info(NAMESPACE, 'analyst and chapter passed in', req.body);

  if (cases.createRecord({ analyst, chapter })) {
    return res.status(200).json({
      message: 'inserted case'
    });
  } else {
    return res.status(500).json({
      message: 'failed to inserted case'
    });
  }

  /*
  let query = `INSERT INTO Cases (analyst, chapter) VALUES ("${analyst}", "${chapter}")`;

  Connect()
    .then((connection) => {
      Query(connection, query)
        .then((result) => {
          logging.info(NAMESPACE, 'Case created: ', result);

          return res.status(200).json({
            result
          });
        })
        .catch((error) => {
          logging.error(NAMESPACE, error.message, error);

          // 400 bad request
          return res.status(400).json({
            message: error.message,
            error
          });
        })
        .finally(() => {
          logging.info(NAMESPACE, 'Closing connection.');
          connection.close();
        });
    })
    .catch((error) => {
      logging.error(NAMESPACE, error.message, error);

      // 503 service unavailable
      return res.status(503).json({
        message: error.message,
        error
      });
    });
  */
};

const updateCase = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Updating Case');

  const record = new caseRecord({
    caseId: req.params.caseId,
    analyst: req.body.analyst,
    chapter: req.body.chapter,
  });

  let result = cases.updateRecord(record);

  let { analyst, chapter } = req.body;

  const index = caseTable.findIndex((item) => item.caseid == +req.params.caseId);

  logging.info(NAMESPACE, 'original record: ', caseTable[index]);

  caseTable[index] = {
    caseid: +req.params.caseId,
    analyst,
    chapter
  };

  logging.info(NAMESPACE, 'record updated: ', caseTable[index]);

  return res.status(200).json({
    message: 'updated cases'
  });

  /*
  let query = `UPDATE Cases SET (analyst="${analyst}", chapter="${chapter}") WHERE CaseId=${req.params.caseId}`;

  Connect()
    .then((connection) => {
      Query(connection, query)
        .then((result) => {
          logging.info(NAMESPACE, 'Case updated: ', result);

          return res.status(200).json({
            result
          });
        })
        .catch((error) => {
          logging.error(NAMESPACE, error.message, error);

          // 400 bad request
          return res.status(400).json({
            message: error.message,
            error
          });
        })
        .finally(() => {
          logging.info(NAMESPACE, 'Closing connection.');
          connection.close();
        });
    })
    .catch((error) => {
      logging.error(NAMESPACE, error.message, error);

      // 503 service unavailable
      return res.status(503).json({
        message: error.message,
        error
      });
    });
  */
};

const deleteCase = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, `Deleting Case ${req.params.caseId}`);

  caseTable = caseTable.filter((theCase) => theCase.caseid != +req.params.caseId);

  return res.status(200).json({
    message: 'deleted case'
  });

  /*
  let { analyst, chapter } = req.body;

  let query = `DELETE from Cases WHERE CaseId=${req.params.caseId}`;

  Connect()
    .then((connection) => {
      Query(connection, query)
        .then((result) => {
          logging.info(NAMESPACE, 'Case deleted: ', result);

          return res.status(200).json({
            result
          });
        })
        .catch((error) => {
          logging.error(NAMESPACE, error.message, error);

          // 400 bad request
          return res.status(400).json({
            message: error.message,
            error
          });
        })
        .finally(() => {
          logging.info(NAMESPACE, 'Closing connection.');
          connection.close();
        });
    })
    .catch((error) => {
      logging.error(NAMESPACE, error.message, error);

      // 503 service unavailable
      return res.status(503).json({
        message: error.message,
        error
      });
    });
  */
};

export default { createCase, getAllCases, getCase, updateCase, deleteCase };
