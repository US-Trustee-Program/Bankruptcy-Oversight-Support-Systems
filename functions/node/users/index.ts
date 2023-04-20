import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { UsersController } from '../adapters/controllers/users.controller';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const firstName = (req.query.first_name || (req.body && req.body.first_name));
    const lastName = (req.query.last_name || (req.body && req.body.last_name));

    const HEADERS = {'Content-Type': 'application/json'}

    const responseMessage = name
        ? "Hello, " + name + ". This HTTP triggered function executed successfully."
        : "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.";

    context.res = {
        // status: 200, /* Defaults to 200 */
        body: responseMessage
    };

};

export default httpTrigger;