import * as dotenv from 'dotenv';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { AnyCondition, buildFunctionHandler } from '../azure/buildFunctionHandler';
import { app } from '@azure/functions';

dotenv.config();

const MODULE_NAME = 'CASE-SUMMARY-FUNCTION' as const;

initializeApplicationInsights();

const handler = buildFunctionHandler(MODULE_NAME, [
  {
    if: AnyCondition,
    then: async (context) => {
      const controller = new CaseSummaryController(context);
      const response = await controller.getCaseSummary(context, {
        caseId: context.request.params.caseId,
      });
      return response;
    },
  },
]);

app.http('case-summary', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}/summary',
});
