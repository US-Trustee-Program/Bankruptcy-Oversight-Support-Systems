import log from "../logging.service";
import { httpError, httpSuccess } from "../utils/http";
import useCase from '../../use-cases/index.js';
import { UserPersistenceGateway } from "../types/persistence-gateway";
import proxyData from "../data-access.proxy";

const NAMESPACE = 'USERS-CONTROLLER';

const usersDb: UserPersistenceGateway = (await proxyData('users')) as UserPersistenceGateway;

const login = async (httpRequest: Request) => {
  log('info', NAMESPACE, 'Fetching a user id.');

  try {
    console.log(httpRequest.body);
    if (httpRequest.body && 'firstName' in httpRequest.body && 'lastName' in httpRequest.body) {
      const firstName = httpRequest.body.firstName as string;
      const lastName = httpRequest.body.lastName as string;
      const user = await useCase.login(usersDb, { firstName, lastName });

      // success
      return httpSuccess(user);
    }
    else {
      return httpError(new Error('Required parameters absent: firstName and lastName.'), 400);
    }
  } catch (e: any) {
    // 404 Not Found Error
    return httpError(e, 404);
  }
}

export default { login }