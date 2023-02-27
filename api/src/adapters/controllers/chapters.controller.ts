import { Request } from 'express';
import log from '../logging.service';
import useCase from '../../use-cases';
import { httpSuccess, httpError } from '../utils/http';

const NAMESPACE = 'CHAPTERS-CONTROLLER';

const getAllChapters = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Getting all chapters.');

  try {
    const chapterList = await useCase.listChapters();

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
