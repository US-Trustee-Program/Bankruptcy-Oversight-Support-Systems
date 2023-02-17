/**
 * Case Routes are routes that begin with /cases as the root path.
 */

import express from 'express';
//import express, { NextFunction, Request, Response } from 'express';
//import controller from '../adapters/controllers/cases.controller';
//import logging from '../adapters/logging.service';

const router = express.Router();

/*
router.post('/create', (req: Request, res: Response, next: NextFunction) => {
  logging.info('CASE API', 'CASE CREATE');
  controller.createCase(req, res, next);
});

router.get('/:caseId', (req: Request, res: Response, next: NextFunction) => {
  logging.info('CASE API', 'GET CASE');
  controller.getCase(req, res, next);
});

router.get('', (req: Request, res: Response, next: NextFunction) => {
  logging.info('CASE API', 'GET ALL CASES');
  controller.getAllCases(req, res, next);
});

router.put('/:caseId', (req: Request, res: Response, next: NextFunction) => {
  logging.info('CASE API', 'CASE UPDATE');
  controller.updateCase(req, res, next);
});

router.delete('/:caseId', (req: Request, res: Response, next: NextFunction) => {
  logging.info('CASE API', 'CASE DELETE');
  controller.deleteCase(req, res, next);
});
*/

export = router;
