import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import log from './adapters/logging.service.js';
import config from './configs/default.config.js';
import loadRoutes from './routes/index.routes.js';
import { AppConfig } from './adapters/types/basic.js';


const NAMESPACE = 'Server';

// insiration for using this method of extending the Express object came from this article:
// https://stackoverflow.com/questions/37377731/extend-express-request-object-using-typescript
declare global {
  namespace Express {
    interface Request {
      config?: AppConfig;
    }
  }
}

export const app = express();

/** Setup global configuration */
app.use((req: Request, res: Response, next: NextFunction) => {
  req.config = config;
  next();
});

/** Log the request */
app.use((req, res, next) => {
  /** Log the req */
  log('info', NAMESPACE, `METHOD: [${req.method}] - URL: [${req.url}] - REQUEST - IP: [${req.socket.remoteAddress}]`);

  res.on('finish', () => {
    /** Log the res */
    log('info', NAMESPACE, `METHOD: [${req.method}] - URL: [${req.url}] - STATUS: [${res.statusCode}] - IP: [${req.socket.remoteAddress}]`);
  });

  next();
});

/** Parse the body of the request */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/** Rules of our API */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method == 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, PATCH, DELETE');
    return res.status(200).json({});
  }

  next();
});

/** Routes go here */
loadRoutes(app);

/** Error handling */
app.use((req, res, next) => {
  const error = new Error('Not found');

  res.status(404).json({
    message: error.message,
  });
});

/** Create the server */
const httpServer = http.createServer(app);
httpServer.listen(config.server.port, () => log('info', NAMESPACE, `Server is running ${config.server.hostname}:${config.server.port}`));
