import http from 'http';
import express from 'express';
import logging from './config/logging';
import config from './config/config';
import bookRoutes from './routes/book';
import basicRoutes from './routes/basic';

const NAMESPACE = 'Server';
const app = express();

/** Log the request */
app.use((req, res, next) => {
  /** Log the req */
  logging.info(NAMESPACE, `METHOD: [${req.method}] - URL: [${req.url}] - IP: [${req.socket.remoteAddress}]`);

  res.on('finish', () => {
    /** Log the res */
    logging.info(NAMESPACE, `METHOD: [${req.method}] - URL: [${req.url}] - STATUS: [${res.statusCode}] - IP: [${req.socket.remoteAddress}]`);
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
app.use('/', basicRoutes);
app.use('/books', bookRoutes);

/** Error handling */
app.use((req, res, next) => {
  const error = new Error('Not found');

  res.status(404).json({
    message: error.message
  });
});

/** Create the server */
const httpServer = http.createServer(app);
httpServer.listen(config.server.port, () => logging.info(NAMESPACE, `Server is running ${config.server.hostname}:${config.server.port}`));
