import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { UsersController } from '../adapters/controllers/users.controller';
import { httpError, httpSuccess } from "../adapters/utils/http.js";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const firstName = (req.query.first_name || (req.body && req.body.first_name));
    const lastName = (req.query.last_name || (req.body && req.body.last_name));
    const usersController = new UsersController();

    try {
        if (firstName && lastName) {
            const user = await usersController.getUser({ firstName, lastName });
            context.res = httpSuccess(user);
        } else {
            context.res = httpError(new Error('Required parameters absent: firstName and lastName.'), 400);
        }
    } catch (e) {
        context.res = httpError(e, 404);
    }
};

export default httpTrigger;
