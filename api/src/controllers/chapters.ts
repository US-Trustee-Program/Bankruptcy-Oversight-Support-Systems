import { NextFunction, Request, Response } from 'express';
import logging from '../config/logging';
//import { Connect, Query } from '../config/mssql';
import { Connect } from '../config/mssql';

const NAMESPACE = 'Chapters';

const createChapterTable = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Inserting Chapters');

  /*
  return res.status(200).json({
    message: 'created chapters table...'
  });
  */

  let query = `
    CREATE TABLE Chapters (
      ChapterId int NOT NULL AUTO_INCRIMENT,
      Title varchar(10),
      PRIMARY KEY (ChapterId)
    );
    `;

  /*
    INSERT INTO Chapters (ChapterId, Title)
    VALUES
      (7, 'Chapter 7'),
      (9, 'Chapter 9'),
      (11, 'Chapter 11'),
      (15, 'Chapter 17'),
      (19, 'Chapter 19');
  */
  Connect()
    .then((connection) => {
      console.log('Yay we connected');
      console.log(connection);
      /*
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
      */
    })
    .catch((error) => {
      logging.error(NAMESPACE, error.message, error);

      // 503 service unavailable
      return res.status(503).json({
        message: error.message,
        error
      });
    });
};

const getAllChapters = async (req: Request, res: Response, next: NextFunction) => {
  logging.info(NAMESPACE, 'Getting all chapters.');

  return res.status(200).json({
    message: 'chapters list',
    count: '6',
    body: {
      7: 'Chapter 7',
      9: 'Chapter 9',
      11: 'Chapter 11',
      15: 'Chapter 15',
      17: 'Chapter 17',
      19: 'Chapter 19'
    }
  });

  /*
  let query = 'SELECT * FROM Chapters';

  Connect()
    .then((connection) => {
      Query(connection, query)
        .then((results) => {
          logging.info(NAMESPACE, 'Retrieved chapters: ', results);

          return res.status(200).json({
            results
          });
        })
        .catch((error) => {
          logging.error(NAMESPACE, error.message, error);

          return res.status(200).json({
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

      return res.status(200).json({
        message: error.message,
        error
      });
    });
  */
};

export default { getAllChapters, createChapterTable };
