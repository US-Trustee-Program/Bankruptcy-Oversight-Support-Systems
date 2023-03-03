import { Request } from 'express';
import log from '../logging.service';
import useCase from '../../use-cases';
import { httpSuccess, httpError } from '../utils/http';
import proxyData from '../data-access.proxy';
import { ChaptersPersistenceGateway } from '../types/persistence-gateway';

const NAMESPACE = 'CHAPTERS-CONTROLLER';

const chapterDb: ChaptersPersistenceGateway = (await proxyData('chapters')) as ChaptersPersistenceGateway;

const getAllChapters = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Getting all chapters.');

  try {
    const chapterList = await useCase.listChapters(chapterDb);

    // success
    if (chapterList.success === true) {
      return httpSuccess(chapterList);
    } else {
      return httpError(chapterList, 404);
    }
  } catch (e: any) {
    // 404 Not Found Error
    return httpError(e, 404);
  }
};

export default { getAllChapters };
