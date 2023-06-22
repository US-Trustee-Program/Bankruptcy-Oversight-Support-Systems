import log from '../services/logger.service';
import useCase from '../../use-cases/index';
import { UserPersistenceGateway } from "../types/persistence-gateway";
import proxyData from "../data-access.proxy";
import { Context } from '../types/basic';
import {User} from '../../../Domain/Entities/User';
import { DbResult } from "../types/database";

const NAMESPACE = "USERS-CONTROLLER";

export class UsersController {
  private functionContext: Context;

  constructor(context: Context) {
    this.functionContext = context;
  }

  public async getUser(userName: {firstName: string, lastName: string}) {
    log.info(this.functionContext, NAMESPACE, 'getUser - fetching a user id, given a first and last name.');

    const usersDb: UserPersistenceGateway = (await proxyData(this.functionContext, 'users')) as UserPersistenceGateway;

    return await useCase.login(this.functionContext, usersDb, userName );
  }

  public getUserLogin = async (user: User): Promise<DbResult> => {
    log.info(this.functionContext, NAMESPACE, 'getUser - fetching a user id, given a User.');

    const usersDb: UserPersistenceGateway = (await proxyData(this.functionContext, 'users')) as UserPersistenceGateway;

    const userName = {
      firstName : user.firstName,
      lastName : user.lastName
    };
    return await useCase.login(this.functionContext, usersDb, userName );

  };
}
