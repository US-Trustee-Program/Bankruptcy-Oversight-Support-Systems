/**
 * Basic Routes is a catchall for routes not caught by more specifically defined routes.
 * This will be used for miscelaneous routes.
 */

import express, { NextFunction, Request, Response } from 'express';
import makeCallback from './../adapters/express-callback';

const router = express.Router();

router.get('/', makeCallback((req: Request, res: Response, next: NextFunction) => {
  console.log('Hello World');
  res.sendStatus(200);
}));

router.get('/healthcheck', (req: Request, res: Response, next: NextFunction) => {
  console.log('Health check OK');
  res.sendStatus(200);
});

export default router;
