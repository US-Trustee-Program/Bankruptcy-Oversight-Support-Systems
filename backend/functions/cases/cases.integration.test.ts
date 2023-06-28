import { CasesController } from'../lib/adapters/controllers/cases.controller';
import{ Context, HttpRequest }from'@azure/functions';
import httpTrigger from'./cases.function';
import log from'../lib/adapters/services/logger.service';

describe('IntegrationTestforChapter15cases',()=>{

//Arrange
  let context: Context;
  let request: HttpRequest;

  beforeEach(()=>{
    context={ log:()=>{} }as unknown as Context;
    request={ query:{} }as unknown as HttpRequest;
  });


  test('getCaseListshouldfetchchapter15caseswhencalledwithcaseChapter15',async()=>{

    const _caseChapter='15';
    const _professionalId='8182';

    request.query={ caseChaper:_caseChapter,professionalId:_professionalId };

//Act
    const casesController= new CasesController(context);

    try{

      const caseList = await httpTrigger(context,request);
    }catch(exception){

      log.error(context,'CasesIntegrationTest',exception);
    }
//Assert
    expect(context.res.body).toBeTruthy();
  });
});
