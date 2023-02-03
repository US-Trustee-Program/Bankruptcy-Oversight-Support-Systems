import { NextFunction, Request, Response } from 'express';
import logging from '../config/logging';
import { Connect, Query } from '../config/mssql';

const NAMESPACE = 'Cases';

type caseRecord = {
  caseid: number;
  analyst: string;
  chapter: string;
}

let caseTable: caseRecord[] = [];

const createCase = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Inserting Case');

  let { analyst, chapter } = req.body;
  logging.info(NAMESPACE, 'analyst and chapter passed in', req.body);

  caseTable.push({
    caseid: caseTable.length + 1,
    analyst: analyst,
    chapter: chapter
  });

  return res.status(200).json({
    message: 'inserted case'
  });

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

const getAllCases = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Getting all cases.');

  return res.status(200).json({
    message: 'cases list',
    count: caseTable.length,
    body: caseTable
  });

  /*
  let query = 'SELECT * FROM Cases';

  Connect()
    .then((connection) => {
      Query(connection, query)
        .then((results) => {
          logging.info(NAMESPACE, 'Retrieved cases: ', results);

          return res.status(200).json({
            results
          });
        })
        .catch((error) => {
          logging.error(NAMESPACE, error.message, error);

          // 404 Not Found
          return res.status(404).json({
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

const getCase = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, `Getting single case ${req.params.caseId}.`);

  const caseDetail = caseTable.filter(theCase => theCase.caseid == +req.params.caseId).pop();

  return res.status(200).json({
    message: 'cases list',
    count: caseTable.length,
    body: caseDetail
  });
};

const updateCase = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Updating Case');

  let { analyst, chapter } = req.body;

  const index = caseTable.findIndex(item => item.caseid == +req.params.caseId);

  logging.info(NAMESPACE, 'original record: ', caseTable[index]);

  caseTable[index] = {
    caseid: +req.params.caseId,
    analyst,
    chapter
  }

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

  caseTable = caseTable.filter(theCase => theCase.caseid != +req.params.caseId);

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
