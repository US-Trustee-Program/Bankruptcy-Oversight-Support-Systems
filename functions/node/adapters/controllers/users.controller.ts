import log from '../services/logger.service';
import useCase from '../../use-cases/index.js';
import { UserPersistenceGateway } from "../types/persistence-gateway.js";
import proxyData from "../data-access.proxy";

const NAMESPACE = "USERS-CONTROLLER";

export class UsersController {
  private usersDb: UserPersistenceGateway;

  constructor() {}

  public async getUser(userName: {firstName: string, lastName: string}) {
    log.info(NAMESPACE, 'getUser - fetching a user id, given a first and last name.');

    const usersDb: UserPersistenceGateway = (await proxyData('users')) as UserPersistenceGateway;

    return await useCase.login(usersDb, userName );
  }
}
