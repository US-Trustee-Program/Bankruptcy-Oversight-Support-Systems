import Factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AcmsGateway } from '../gateways.types';
import AcmsOrders, { AcmsConsolidation, Predicate, PredicateAndPage } from './acms-orders';

const mockAcmsGateway: AcmsGateway = {
  getPageCount: function (..._ignore): Promise<number> {
    throw new Error('Function not implemented.');
  },
  getConsolidationOrders: function (..._ignore): Promise<AcmsConsolidation[]> {
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
      dateRange: ['2020-01-01', '2021-01-01'],
    };
    const useCase = new AcmsOrders();
    const actual = await useCase.getPageCount(context, predicate);

    expect(getPageCount).toHaveBeenCalledWith(context, predicate);
    expect(actual).toEqual(expected);
  });

  test('should return a page of consolidation orders', async () => {
    const expected: AcmsConsolidation[] = [{ caseId: '00-00000', orderId: '' }];
    const getConsolidationOrders = jest
      .spyOn(mockAcmsGateway, 'getConsolidationOrders')
      .mockResolvedValue(expected);
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);

    const predicateAndPage: PredicateAndPage = {
      divisionCode: '000',
      chapter: '00',
      dateRange: ['2020-01-01', '2021-01-01'],
      pageNumber: 1,
    };

    const useCase = new AcmsOrders();
    const actual = await useCase.getConsolidationOrders(context, predicateAndPage);

    expect(getConsolidationOrders).toHaveBeenCalledWith(context, predicateAndPage);
    expect(actual).toEqual(expected);
  });

  test('should handle exceptions', async () => {
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
    const useCase = new AcmsOrders();

    const predicate: Predicate = {
      divisionCode: '000',
      chapter: '00',
      dateRange: ['2020-01-01', '2021-01-01'],
    };

    const predicateAndPage: PredicateAndPage = {
      ...predicate,
      pageNumber: 1,
    };

    await expect(useCase.getPageCount(context, predicate)).rejects.toThrow();
    await expect(useCase.getConsolidationOrders(context, predicateAndPage)).rejects.toThrow();
  });
});
