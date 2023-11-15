import CaseDocketDxtrGateway from './case-docket.dxtr.gateway';

describe('Test DXTR Gateway', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const gateway: CaseDocketDxtrGateway = new CaseDocketDxtrGateway();
  describe('docketQueryCallback', () => {
    test('should return docket entries for an existing case id', async () => {});
    test('should return no docket entries for a case that has no docket', async () => {});
    test('should raise and exception for an invalid case ID', async () => {});
  });
});
