import{ Context, HttpRequest }from'@azure/functions';
import httpTrigger from'./cases.function';
import log from'../lib/adapters/services/logger.service';

describe('Integration Test for the cases Azure Function to call Chapter15 cases',()=>{

  let context: Context;
  let request: HttpRequest;

  beforeEach(()=>{
    jest.setTimeout(300000);
    context={ log:()=>{} }as unknown as Context;
    request={ query:{} }as unknown as HttpRequest;
  });

  test('cases azure function should return success when called with caseChapter 15 and a professionalId',async()=>{
    jest.setTimeout(300000);
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
