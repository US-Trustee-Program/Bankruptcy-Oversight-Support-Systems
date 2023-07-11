import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { CasesController } from '../lib/adapters/controllers/cases.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import log from '../lib/adapters/services/logger.service';

const NAMESPACE = 'CASES-FUNCTION';

const httpTrigger: AzureFunction = async function (functionContext: Context, casesRequest: HttpRequest): Promise<void> {
    let caseChapter = '';
    let professionalId = '';

    if (casesRequest.query.chapter) caseChapter = casesRequest.query.chapter;
    else if (casesRequest.body && casesRequest.body.chapter) caseChapter = casesRequest.body.chapter;

    if (casesRequest.query.professional_id) professionalId = casesRequest.query.professional_id;
    else if (casesRequest.body && casesRequest.body.professional_id) professionalId = casesRequest.body.professional_id;

    const casesController = new CasesController(functionContext);

    log.info(functionContext, NAMESPACE, `chapter ${caseChapter}, professionalId ${professionalId}`);
    try {
        const caseList = await casesController.getCaseList({ caseChapter: caseChapter, professionalId });
        log.info(functionContext, NAMESPACE, caseList.body.caseList.toString());
        functionContext.res = httpSuccess(functionContext, caseList);
    } catch (exception) {
        log.error(functionContext, NAMESPACE, 'caught error. ', exception);
        functionContext.res = httpError(functionContext, exception, 404);
    }
};

export default httpTrigger;
