import { CasesController } from'../lib/adapters/controllers/cases.controller';
import{ Context, HttpRequest }from'@azure/functions';
import httpTrigger from'./cases.function';
import log from'../lib/adapters/services/logger.service';

describe('IntegrationTestforChapter15cases',()=>{

  let context: Context;
  let request: HttpRequest;

  beforeEach(()=>{
    jest.setTimeout(60000);
    context={ log:()=>{} }as unknown as Context;
    request={ query:{} }as unknown as HttpRequest;
  });

  test('getCaseListshouldfetchchapter15caseswhencalledwithcaseChapter15',async()=>{

    const _caseChapter='15';
    const _professionalId='8182';

    request.query={ chapter:_caseChapter,professional_id:_professionalId };

    try{

      const caseList = await httpTrigger(context,request);
    }catch(exception){

      log.error(context,'CasesIntegrationTest',exception);
    }

    log.info(context, 'CasesIntegrationTest', context.res.toString());

    expect(context.res.body.success).toBeTruthy();

  });
});