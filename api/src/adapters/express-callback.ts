import { Request, Response } from 'express';
import { HttpResponse } from './types/http';
import log from './logging.service';

const NAMESPACE = 'EXPRESS-CALLBACK';

export default function makeExpressCallback(controller: Function) {
  return (req: Request, res: Response) => {
    log('info', NAMESPACE, 'Calling express callback');
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
    };

    controller(httpRequest)
      .then(async (httpResponse: HttpResponse) => {
        res.type('json');
        if (httpResponse.headers) {
          await res.set(httpResponse.headers);
        }
        await res.status(httpResponse.statusCode);
        await res.send(httpResponse.body);
      })
      .catch((e: Error) => res.status(500).send({ error: 'An unknown error occurred.' }));
  };
}
