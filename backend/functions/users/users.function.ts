import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { UsersController } from '../lib/adapters/controllers/users.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';

const NAMESPACE = 'USERS-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  userRequest: HttpRequest,
): Promise<void> {
  const firstName =
    userRequest.query.first_name || (userRequest.body && userRequest.body.first_name);
  const lastName = userRequest.query.last_name || (userRequest.body && userRequest.body.last_name);
  const usersController = new UsersController(functionContext);

  try {
    if (firstName && lastName) {
      const user = await usersController.getUser({ firstName, lastName });
      functionContext.res = httpSuccess(functionContext, user);
    } else {
      functionContext.res = httpError(
        functionContext,
        new Error('Required parameters absent: first_name and last_name.'),
        400,
      );
    }
  } catch (exception) {
    functionContext.res = httpError(functionContext, exception, 404);
  }
};

export default httpTrigger;
