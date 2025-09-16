import { Request, Response } from 'express';
import { expressToCamsHttpRequest, toExpressSuccess, toExpressError } from './functions';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { CamsError } from '../../lib/common-errors/cams-error';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

// Helper to create mock Express request
function createMockExpressRequest(overrides?: Partial<Request>): Request {
  return {
    method: 'GET',
    url: '/test',
    originalUrl: '/test',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'test-agent',
    },
    query: {
      param1: 'value1',
      param2: ['value2a', 'value2b'],
    },
    params: {
      id: '123',
    },
    body: { test: 'data' },
    ...overrides,
  } as Request;
}

// Helper to create mock Express response
function createMockExpressResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
}

describe('Express Functions Module', () => {
  describe('expressToCamsHttpRequest', () => {
    test('should convert Express request to CAMS request format', () => {
      const expressRequest = createMockExpressRequest();
      const camsRequest = expressToCamsHttpRequest(expressRequest);

      expect(camsRequest).toEqual({
        method: 'GET',
        url: '/test',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent',
        },
        query: {
          param1: 'value1',
          param2: 'value2a,value2b', // Arrays should be joined
        },
        params: {
          id: '123',
        },
        body: { test: 'data' },
      });
    });

    test('should handle undefined body', () => {
      const expressRequest = createMockExpressRequest({ body: undefined });
      const camsRequest = expressToCamsHttpRequest(expressRequest);

      expect(camsRequest.body).toBeUndefined();
    });

    test('should handle empty query and headers', () => {
      const expressRequest = createMockExpressRequest({
        query: {},
        headers: {},
      });
      const camsRequest = expressToCamsHttpRequest(expressRequest);

      expect(camsRequest.query).toEqual({});
      expect(camsRequest.headers).toEqual({});
    });
  });

  describe('toExpressSuccess', () => {
    let mockResponse: Response;

    beforeEach(() => {
      mockResponse = createMockExpressResponse();
    });

    test('should set status and send JSON response', () => {
      const responseData = {
        statusCode: 201,
        body: { data: { success: true, count: 42 } },
        headers: { 'custom-header': 'custom-value' },
      };

      toExpressSuccess(mockResponse, responseData);

      expect(mockResponse.set).toHaveBeenCalledWith('custom-header', 'custom-value');
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({ data: { success: true, count: 42 } });
    });

    test('should default to status 200 when no statusCode provided', () => {
      toExpressSuccess(mockResponse, {});

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    test('should send empty response when no body provided', () => {
      toExpressSuccess(mockResponse, { statusCode: 204 });

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalledWith();
    });
  });

  describe('toExpressError', () => {
    let mockResponse: Response;
    let mockLogger: LoggerImpl;

    beforeEach(() => {
      mockResponse = createMockExpressResponse();
      mockLogger = new LoggerImpl('test-id', jest.fn());
      jest.spyOn(mockLogger, 'camsError').mockImplementation();
    });

    test('should handle CamsError properly', () => {
      const originalError = new CamsError('TEST_MODULE', {
        message: 'Test error',
        status: HttpStatusCodes.BAD_REQUEST,
      });

      toExpressError(mockResponse, mockLogger, 'TEST_MODULE', originalError);

      expect(mockLogger.camsError).toHaveBeenCalledWith(originalError);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCodes.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith('Test error');
    });

    test('should handle generic Error and convert to CamsError', () => {
      const originalError = new Error('Generic error');

      toExpressError(mockResponse, mockLogger, 'TEST_MODULE', originalError);

      expect(mockLogger.camsError).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    test('should accept ApplicationContext as logger source', () => {
      const mockContext = {
        logger: mockLogger,
        config: new ApplicationConfiguration(),
        featureFlags: {},
        invocationId: 'test-id',
        closables: [],
        releasables: [],
        extraOutputs: undefined,
        session: undefined,
        request: undefined,
      };

      const originalError = new Error('Test error');

      toExpressError(mockResponse, mockContext, 'TEST_MODULE', originalError);

      expect(mockLogger.camsError).toHaveBeenCalled();
    });
  });
});
