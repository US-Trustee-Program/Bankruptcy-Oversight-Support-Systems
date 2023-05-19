import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { UsersController } from '../lib/adapters/controllers/users.controller';
import { httpError, httpSuccess } from "../lib/adapters/utils/http";
import log from '../lib/adapters/services/logger.service';

const NAMESPACE = 'USERS-FUNCTION';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const firstName = (req.query.first_name || (req.body && req.body.first_name));
    const lastName = (req.query.last_name || (req.body && req.body.last_name));
    const usersController = new UsersController(context);

    try {
        if (firstName && lastName) {
            log.info(context, NAMESPACE, 'User name was defined.  Calling getUser()');
            const user = await usersController.getUser({ firstName, lastName });
            context.res = httpSuccess(context, user);
        } else {
            log.warn(context, NAMESPACE, 'User first and last name was not defined');
            context.res = httpError(context, new Error('Required parameters absent: first_name and last_name.'), 400);
        }
    } catch (e) {
        log.error(context, NAMESPACE, 'caught error. ', e);
        context.res = httpError(context, e, 404);
    }
};

export default httpTrigger;
