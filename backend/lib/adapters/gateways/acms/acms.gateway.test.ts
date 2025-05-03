import { UnknownError } from '../../../common-errors/unknown-error';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import {
  AcmsConsolidation,
  AcmsConsolidationChildCase,
  AcmsPredicate,
} from '../../../use-cases/dataflows/migrate-consolidations';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AcmsGatewayImpl } from './acms.gateway';

describe('ACMS gateway tests', () => {
  const chapters = [
    { chapter: '9', inputVariable: '09' },
    { chapter: '11', inputVariable: '11' },
    { chapter: '12', inputVariable: '12' },
    { chapter: '13', inputVariable: '13' },
    { chapter: '15', inputVariable: '15' },
  ];
  test.each(chapters)('should translate chapter $chapter into query', async (params) => {
    const spy = jest
      .spyOn(AbstractMssqlClient.prototype, 'executeQuery')
      .mockResolvedValueOnce({
        message: '',
        results: [{ leadCaseCount: 0 }],
        success: true,
      })
      .mockResolvedValue({
        message: '',
        results: [],
        success: true,
      });

    const predicate: AcmsPredicate = {
      chapter: params.chapter,
      divisionCode: '081',
    };

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await gateway.getLeadCaseIds(context, predicate);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ name: 'chapter', value: params.inputVariable }),
      ]),
    );
  });

  test('should handle chapter 7 query', async () => {
    const spy = jest
      .spyOn(AbstractMssqlClient.prototype, 'executeQuery')
      .mockResolvedValueOnce({
        message: '',
        results: [{ leadCaseCount: 0 }],
        success: true,
      })
      .mockResolvedValue({
        message: '',
        results: [],
        success: true,
      });

    const predicate: AcmsPredicate = {
      chapter: '7',
      divisionCode: '081',
    };

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await gateway.getLeadCaseIds(context, predicate);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.stringContaining("IN ('7A', '7N')"),
      expect.any(Array),
    );
  });

  test('should get substantive consolidation details from ACMS', async () => {
    const leadCaseId = '0000000000';
    const databaseResult: AcmsConsolidationChildCase[] = [
      {
        caseId: '000-00-11111',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
      {
        caseId: '000-00-22222',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
    ];
    const expectedResult: AcmsConsolidation = {
      childCases: [
        {
          caseId: '000-00-11111',
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
        {
          caseId: '000-00-22222',
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
      ],
      leadCaseId: '000-00-00000',
    };

    const spy = jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      message: '',
      results: databaseResult,
      success: true,
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getConsolidationDetails(context, leadCaseId);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ name: 'leadCaseId', value: leadCaseId })]),
    );
    expect(result).toEqual(expectedResult);
  });

  test('should get administrative consolidation details from ACMS', async () => {
    const leadCaseId = '0000000000';
    const databaseResult: AcmsConsolidationChildCase[] = [
      {
        caseId: '000-00-11111',
        consolidationDate: '20240201',
        consolidationType: 'A',
      },
      {
        caseId: '000-00-22222',
        consolidationDate: '20240201',
        consolidationType: 'A',
      },
    ];
    const expectedResult: AcmsConsolidation = {
      childCases: [
        {
          caseId: '000-00-11111',
          consolidationDate: '2024-02-01',
          consolidationType: 'administrative',
        },
        {
          caseId: '000-00-22222',
          consolidationDate: '2024-02-01',
          consolidationType: 'administrative',
        },
      ],
      leadCaseId: '000-00-00000',
    };

    const spy = jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      message: '',
      results: databaseResult,
      success: true,
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getConsolidationDetails(context, leadCaseId);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ name: 'leadCaseId', value: leadCaseId })]),
    );
    expect(result).toEqual(expectedResult);
  });

  test('should handle exceptions from executeQuery when calling getLeadCaseIds', async () => {
    const mockError = new Error('test error');
    jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getLeadCaseIds(context, {
        chapter: '11',
        divisionCode: '010',
      } as AcmsPredicate);
    }).rejects.toThrow(
      new UnknownError('ACMS_GATEWAY', {
        message: mockError.message,
        originalError: mockError,
        status: 500,
      }),
    );
  });

  test('should handle exceptions from executeQuery when calling getConsolidationDetails', async () => {
    const mockError = new Error('test error');
    jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getConsolidationDetails(context, '000-00-1234');
    }).rejects.toThrow(
      new UnknownError('ACMS_GATEWAY', {
        message: mockError.message,
        originalError: mockError,
        status: 500,
      }),
    );
  });
});
