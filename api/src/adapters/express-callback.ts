import { Request, Response } from 'express';
import { HttpResponse } from './types/http';

export default function makeExpressCallback (controller: Function) {
  return (req: Request, res: Response) => {
    const httpRequest: Object = {
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip,
      method: req.method,
      path: req.path,
      url: req.url,
      headers: {
        'Content-Type': req.get('Content-Type'),
        Referer: req.get('referer'),
        'User-Agent': req.get('User-Agent'),
      },
    }

    controller(httpRequest)
      .then((httpResponse: HttpResponse) => {
        if (httpResponse.headers) {
          res.set(httpResponse.headers)
        }
        res.type('json');
        res.status(httpResponse.statusCode).send(httpResponse.body);
      })
      .catch((e: Error) => res.status(500).send({ error: 'An unknown error occurred.' }));
  }
}