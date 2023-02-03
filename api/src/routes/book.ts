import express, { NextFunction, Request, Response } from 'express';
import controller from '../controllers/book';
import logging from '../config/logging';

const router = express.Router();

router.post('/create/book', (req: Request, res: Response, next: NextFunction) => {
  logging.info('BOOK CONTROLLER', 'request: ', req);
  controller.createBook(req, res, next);
});
router.get('/get/books', controller.getAllBooks);

export = router;
