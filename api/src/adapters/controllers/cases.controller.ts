import { NextFunction, Request, Response } from 'express';
import log from '../logging.service';
import { addCase, listCases, getCase, updateCase, deleteCase } from '../../use-cases';
import { RecordObj } from '../types/basic';

const NAMESPACE = 'CASES-CONTROLLER';

const getAllCases = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Getting all cases.');

  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const caseList = await listCases();

    // success
    return {
      headers: headers,
      statusCode: 200,
      body: caseList,
    };
  } catch (e: any) {
    log('error', NAMESPACE, e.message, e);
    // 404 Not Found Error
    return {
      headers,
      statusCode: 404,
      body: {
        error: e.message,
      }
    };
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

/*
const getCase = async (req: Request, res: Response, next: NextFunction) => {
  log('info', NAMESPACE, `Getting single case ${req.params.caseId}.`);

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
*/

const createCase = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Inserting Case');

  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    let { analyst, chapter } = httpRequest.body;
    log('info', NAMESPACE, 'analyst and chapter passed in', httpRequest.body);

    const record: RecordObj[] = [
      {
        fieldName: 'foo',
        fieldValue: 'foo',
      },
    ];

    const result = await addCase(record);

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
          log('info', NAMESPACE, 'Case created: ', result);

          return res.status(200).json({
            result
          });
        })
        .catch((error) => {
          log('error', NAMESPACE, error.message, error);

          // 400 bad request
          return res.status(400).json({
            message: error.message,
            error
          });
        })
        .finally(() => {
          log('info', NAMESPACE, 'Closing connection.');
          connection.close();
        });
    })
    .catch((error) => {
      log('error', NAMESPACE, error.message, error);

      // 503 service unavailable
      return res.status(503).json({
        message: error.message,
        error
      });
    });
  */
};

/*
const updateCase = async (req: Request, res: Response, next: NextFunction) => {
  log('info', NAMESPACE, 'Updating Case');

  const record = new caseRecord({
    caseId: req.params.caseId,
    analyst: req.body.analyst,
    chapter: req.body.chapter
  });

  let result = cases.updateRecord(record);

  let { analyst, chapter } = req.body;

  const index = caseTable.findIndex((item) => item.caseid == +req.params.caseId);

  log('info', NAMESPACE, 'original record: ', caseTable[index]);

  caseTable[index] = {
    caseid: +req.params.caseId,
    analyst,
    chapter
  };

  log('info', NAMESPACE, 'record updated: ', caseTable[index]);

  return res.status(200).json({
    message: 'updated cases'
  });

  */
  /*
  let query = `UPDATE Cases SET (analyst="${analyst}", chapter="${chapter}") WHERE CaseId=${req.params.caseId}`;

  Connect()
    .then((connection) => {
      Query(connection, query)
        .then((result) => {
          log('info', NAMESPACE, 'Case updated: ', result);

          return res.status(200).json({
            result
          });
        })
        .catch((error) => {
          log('error', NAMESPACE, error.message, error);

          // 400 bad request
          return res.status(400).json({
            message: error.message,
            error
          });
        })
        .finally(() => {
          log('info', NAMESPACE, 'Closing connection.');
          connection.close();
        });
    })
    .catch((error) => {
      log('error', NAMESPACE, error.message, error);

      // 503 service unavailable
      return res.status(503).json({
        message: error.message,
        error
      });
    });
  */
//};

/*
const deleteCase = async (req: Request, res: Response, next: NextFunction) => {
  log('info', NAMESPACE, `Deleting Case ${req.params.caseId}`);

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
          log('info', NAMESPACE, 'Case deleted: ', result);

          return res.status(200).json({
            result
          });
        })
        .catch((error) => {
          log('error', NAMESPACE, error.message, error);

          // 400 bad request
          return res.status(400).json({
            message: error.message,
            error
          });
        })
        .finally(() => {
          log('info', NAMESPACE, 'Closing connection.');
          connection.close();
        });
    })
    .catch((error) => {
      log('error', NAMESPACE, error.message, error);

      // 503 service unavailable
      return res.status(503).json({
        message: error.message,
        error
      });
    });
  */
//};

//export default { createCase, getAllCases, getCase, updateCase, deleteCase };
//export default { createCase, getAllCases, getCase };
export default { createCase, getAllCases };
