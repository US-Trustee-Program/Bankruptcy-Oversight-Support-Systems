import Factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AcmsGateway } from '../gateways.types';
import AcmsOrders, { AcmsConsolidation, Predicate, PredicateAndPage } from './acms-orders';

const mockAcmsGateway: AcmsGateway = {
  getPageCount: function (..._ignore): Promise<number> {
    throw new Error('Function not implemented.');
  },
  getLeadCaseIds: function (..._ignore): Promise<string[]> {
    throw new Error('Function not implemented.');
  },
  getConsolidationDetails: function (..._ignore): Promise<AcmsConsolidation> {
    throw new Error('Function not implemented.');
  },
};

describe('ACMS Orders', () => {
  let context;

  beforeAll(async () => {
    context = createMockApplicationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return a page count', async () => {
    const expected = 5;
    const getPageCount = jest.spyOn(mockAcmsGateway, 'getPageCount').mockResolvedValue(expected);
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);

    const predicate: Predicate = {
      divisionCode: '000',
      chapter: '00',
    };
    const useCase = new AcmsOrders();
    const actual = await useCase.getPageCount(context, predicate);

    expect(getPageCount).toHaveBeenCalledWith(context, predicate);
    expect(actual).toEqual(expected);
  });

  test('should return a page of consolidation orders', async () => {
    const expected: string[] = ['811100000', '1231111111'];
    const getConsolidationOrders = jest
      .spyOn(mockAcmsGateway, 'getLeadCaseIds')
      .mockResolvedValue(expected);
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);

    const predicateAndPage: PredicateAndPage = {
      divisionCode: '000',
      chapter: '00',
      pageNumber: 1,
    };

    const useCase = new AcmsOrders();
    const actual = await useCase.getLeadCaseIds(context, predicateAndPage);

    expect(getConsolidationOrders).toHaveBeenCalledWith(context, predicateAndPage);
    expect(actual).toEqual(expected);
  });

  test('should write case references for consolidations to the cases repo', async () => {
    const createConsolidationFrom = jest.fn();
    const createConsolidationTo = jest.fn();
    jest.spyOn(Factory, 'getCasesRepository').mockImplementation(() => {
      createConsolidationFrom,
      createConsolidationTo,
      
    });
  });

  test('should handle exceptions', async () => {
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
    const useCase = new AcmsOrders();

    const predicate: Predicate = {
      divisionCode: '000',
      chapter: '00',
    };

    const predicateAndPage: PredicateAndPage = {
      ...predicate,
      pageNumber: 1,
    };

    await expect(useCase.getPageCount(context, predicate)).rejects.toThrow();
    await expect(useCase.getLeadCaseIds(context, predicateAndPage)).rejects.toThrow();
  });
});
