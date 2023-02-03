import express, { NextFunction, Request, Response } from 'express';

const router = express.Router();

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  console.log('Hello World');
  res.sendStatus(200);
});

router.get('/healthcheck', (req: Request, res: Response, next: NextFunction) => {
  console.log('Health check OK');
  res.sendStatus(200);
});

export = router;
