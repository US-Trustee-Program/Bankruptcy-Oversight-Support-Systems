import express, { NextFunction, Request, Response } from 'express';
import controller from '../controllers/chapters';
import logging from '../config/logging';

const router = express.Router();

router.get('/create-table', (req: Request, res: Response, next: NextFunction) => {
  logging.info('chapter CREATE table', 'request: ', req);
  controller.createChapterTable(req, res, next);
});

router.get('', controller.getAllChapters);

export = router;
