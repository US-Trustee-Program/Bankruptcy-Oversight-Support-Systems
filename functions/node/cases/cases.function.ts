import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { CasesController } from '../lib/adapters/controllers/cases.controller';
import { httpError, httpSuccess } from "../lib/adapters/utils/http";
import log from '../lib/adapters/services/logger.service';

const NAMESPACE = 'CASES-FUNCTION';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    let chapter = (req.query.chapter || (req.body && req.body.chapter)) ?
        (req.query.chapter || (req.body && req.body.chapter)) : '';
    let professionalId = (req.query.professional_id || (req.body && req.body.professional_id)) ?
        (req.query.professional_id || (req.body && req.body.professional_id)) : '';
    const casesController = new CasesController(context);

    log.info(context, NAMESPACE, `chapter ${chapter}, professionalId ${professionalId}`);
    try {
        const caseList = await casesController.getCaseList(context, {chapter, professionalId});
        context.res = httpSuccess(context, caseList);
    } catch (e) {
        log.error(context, NAMESPACE, 'caught error. ', e);
        context.res = httpError(context, e, 404);
    }
};

export default httpTrigger;
