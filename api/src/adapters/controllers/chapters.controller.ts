import { Request } from 'express';
import log from '../logging.service';
import { listChapters } from '../../use-cases';

const NAMESPACE = 'CHAPTERS-CONTROLLER';

const getAllChapters = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Getting all chapters.');

  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    const chapterList = await listChapters();

    return {
      headers: headers,
      statusCode: 200,
      body: chapterList
    };
  } catch(e: any) {
    // TODO: Error logging
    log('error', NAMESPACE, e.message, e);
    return {
      headers,
      statusCode: 404,
      body: {
        error: e.message
      }
    }
  }
};

export default { getAllChapters };
