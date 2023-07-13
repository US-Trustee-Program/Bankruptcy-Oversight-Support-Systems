import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { CaseAssignmentsController } from './caseAssignments.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import log from '../lib/adapters/services/logger.service';

const NAMESPACE = 'CASE-ASSIGNMENTS-FUNCTION';

const httpTrigger: AzureFunction = async function (caseAssignmentCtx: Context, caseAssignmentReq: HttpRequest): Promise<void> {

    const logger = new log(caseAssignmentCtx)

    logger.info(NAMESPACE, "Incoming httpTrigger")

    try {
        let type = caseAssignmentCtx.bindingData.type   // Expected valid values: attorney | case
        let id = caseAssignmentCtx.bindingData.id       // Identifier for target type

        logger.debug(NAMESPACE, `Request inputs:: type:${type} id:${id}`)

        let respBody = {
            targetType: type,
            targetTypeId: id
        }

        let caseAssignments = new CaseAssignmentsController(logger)
        if(type == "attorney") {
            respBody["result"] = await caseAssignments.getAttorney(id)
        }
        else if(type == "case") {
            respBody["result"] = await caseAssignments.getCase(id)
        }

        // TODO ML : suggest refactor httpSuccess to not need to set caseAssignmentCtx.res
        caseAssignmentCtx.res = httpSuccess(caseAssignmentCtx, respBody);
    }
    catch (e) {
        logger.error(NAMESPACE, `${e.name}: ${e.message}`)
        caseAssignmentCtx.res = httpError(caseAssignmentCtx, e, 500);
    }
};

export default httpTrigger;
