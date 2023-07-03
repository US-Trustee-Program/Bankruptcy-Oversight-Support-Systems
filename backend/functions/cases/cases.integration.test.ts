describe('Integration Test for the cases Azure Function to call Chapter15 cases',()=>{
  let functionUrl;
  beforeAll(() => {
    functionUrl = process.env.CASES_FUNCTION_URL;
  });

  beforeEach(()=> {
    jest.setTimeout(300000);
  });

  test('cases azure function should return success when called with caseChapter 15 and a professionalId',async()=>{
    jest.setTimeout(300000);
    const _caseChapter= '15';
    const _professionalId= '8182';

    let caseList;
    try {
      const response = await fetch(`${functionUrl}/cases?chapter=${_caseChapter}&professional_id=${_professionalId}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
      caseList = await response.json();
    } catch(exception) {}

    expect(caseList).toEqual(expect.objectContaining({ success: true, message: '' }));
  });
});
