import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeDataReportMongoRepository } from './trustee-data-report.mongo.repository';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsError } from '../../../common-errors/cams-error';
import { TrusteeDataDifference, TrusteeDataReportRun } from '@common/cams/trustee-data-report';

function buildRun(override: Partial<TrusteeDataReportRun> = {}): TrusteeDataReportRun {
  return {
    runId: 'run-1',
    status: 'completed',
    startedBy: { id: 'user-1', name: 'Test SuperUser' },
    queuedAt: '2026-11-17T10:00:00.000Z',
    finishedAt: '2026-11-17T10:05:00.000Z',
    ...override,
  };
}

function buildDifference(index: number): TrusteeDataDifference {
  return {
    kind: 'field',
    camsTrusteeId: `trustee-${index}`,
    todIds: [`${index}`],
    trusteeName: `Trustee ${index}`,
    field: 'email',
    camsValue: `cams${index}@example.com`,
    todValue: `tod${index}@example.com`,
  };
}

describe('TrusteeDataReportMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeDataReportMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext({
      env: {
        MONGO_CONNECTION_STRING: 'mongodb://localhost:27017',
        COSMOS_DATABASE_NAME: 'test-database',
      },
    });
    repository = TrusteeDataReportMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    TrusteeDataReportMongoRepository.dropInstance();
  });

  // Each test leaves the reference count where beforeEach/afterEach expect it: one acquire, one release.
  describe('instance lifecycle', () => {
    test('should share one instance until every reference is released', () => {
      const second = TrusteeDataReportMongoRepository.getInstance(context);
      expect(second).toBe(repository);

      second.release();

      expect(TrusteeDataReportMongoRepository.getInstance(context)).toBe(repository);
      repository.release();
    });

    test('should create a fresh instance after the last reference is released', () => {
      repository.release();

      const fresh = TrusteeDataReportMongoRepository.getInstance(context);

      expect(fresh).not.toBe(repository);
      repository = fresh;
    });
  });

  describe('upsertRun', () => {
    test('should replace the run document for its runId, inserting it if missing', async () => {
      const replaceSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: 'doc-1', modifiedCount: 0, upsertedCount: 1 });
      const run = buildRun();

      await repository.upsertRun(run);

      expect(replaceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conjunction: 'AND',
          values: expect.arrayContaining([
            expect.objectContaining({
              leftOperand: { name: 'documentType' },
              rightOperand: 'TRUSTEE_DATA_REPORT_RUN',
            }),
            expect.objectContaining({ leftOperand: { name: 'runId' }, rightOperand: 'run-1' }),
          ]),
        }),
        { ...run, documentType: 'TRUSTEE_DATA_REPORT_RUN' },
        true,
      );
    });

    test('should wrap database errors as CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(new Error('boom'));

      await expect(repository.upsertRun(buildRun())).rejects.toBeInstanceOf(CamsError);
    });
  });

  describe('readRun', () => {
    test('should return the run without its documentType', async () => {
      const run = buildRun();
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue({
        ...run,
        documentType: 'TRUSTEE_DATA_REPORT_RUN',
      });

      expect(await repository.readRun('run-1')).toEqual(run);
    });

    test('should return null when the run does not exist', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new NotFoundError('TEST'),
      );

      expect(await repository.readRun('missing')).toBeNull();
    });

    test('should wrap other database errors as CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(new Error('boom'));

      await expect(repository.readRun('run-1')).rejects.toBeInstanceOf(CamsError);
    });
  });

  describe.each([
    { method: 'readLatestCompletedRun', status: 'completed' },
    { method: 'readLatestFailedRun', status: 'failed' },
  ] as const)('$method', ({ method, status }) => {
    test.each(['oldest first', 'newest first'])(
      `should return the ${status} run that finished most recently when found %s`,
      async (order) => {
        const older = buildRun({
          runId: 'run-old',
          status,
          finishedAt: '2026-11-16T10:00:00.000Z',
        });
        const newer = buildRun({
          runId: 'run-new',
          status,
          finishedAt: '2026-11-17T10:00:00.000Z',
        });
        const found = [older, newer].map((run) => ({
          ...run,
          documentType: 'TRUSTEE_DATA_REPORT_RUN' as const,
        }));
        const findSpy = vi
          .spyOn(MongoCollectionAdapter.prototype, 'find')
          .mockResolvedValue(order === 'newest first' ? found.reverse() : found);

        expect(await repository[method]()).toEqual(newer);
        expect(findSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            values: expect.arrayContaining([
              expect.objectContaining({ leftOperand: { name: 'status' }, rightOperand: status }),
            ]),
          }),
        );
      },
    );

    test(`should return null when no run is ${status}`, async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      expect(await repository[method]()).toBeNull();
    });

    test('should wrap database errors as CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('boom'));

      await expect(repository[method]()).rejects.toBeInstanceOf(CamsError);
    });
  });

  describe('replacePageResults', () => {
    const SUMMARY = {
      trusteesCompared: 3,
      todOnly: 1,
      todOnlyStatusMissing: 0,
      camsOnly: 0,
      fieldDifferences: 2,
      fieldDifferencesByField: {
        name: 0,
        companyName: 0,
        publicAddress: 0,
        internalAddress: 0,
        phone: 2,
        email: 0,
      },
    };

    test('should delete the page before writing its rows in batches of 100 and its counts', async () => {
      const calls: string[] = [];
      const deleteSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockImplementation(async () => {
          calls.push('delete');
          return 0;
        });
      const insertManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertMany')
        .mockImplementation(async () => {
          calls.push('insertMany');
          return [];
        });
      const insertOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockImplementation(async () => {
          calls.push('insertOne');
          return 'id';
        });
      const differences = Array.from({ length: 250 }, (_, i) => buildDifference(i));

      await repository.replacePageResults('run-1', 'page-100', differences, SUMMARY);

      expect(calls[0]).toBe('delete');
      expect(deleteSpy).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          { condition: 'EQUALS', leftOperand: { name: 'runId' }, rightOperand: 'run-1' },
          { condition: 'EQUALS', leftOperand: { name: 'pageKey' }, rightOperand: 'page-100' },
        ],
      });
      expect(insertManySpy.mock.calls.map(([items]) => items.length)).toEqual([100, 100, 50]);
      expect(insertManySpy.mock.calls[0][0][0]).toEqual({
        ...differences[0],
        runId: 'run-1',
        pageKey: 'page-100',
        documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE',
      });
      expect(insertOneSpy).toHaveBeenCalledWith({
        runId: 'run-1',
        pageKey: 'page-100',
        documentType: 'TRUSTEE_DATA_REPORT_PAGE',
        summary: SUMMARY,
      });
    });

    test('should still write the page counts when the page has no differences', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany').mockResolvedValue(0);
      const insertManySpy = vi.spyOn(MongoCollectionAdapter.prototype, 'insertMany');
      const insertOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('id');

      await repository.replacePageResults('run-1', 'page-start', [], SUMMARY);

      expect(insertManySpy).not.toHaveBeenCalled();
      expect(insertOneSpy).toHaveBeenCalledTimes(1);
    });

    test('should wrap database errors as CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany').mockRejectedValue(new Error('boom'));

      await expect(
        repository.replacePageResults('run-1', 'page-start', [buildDifference(1)], SUMMARY),
      ).rejects.toBeInstanceOf(CamsError);
    });
  });

  describe('readPageSummaries', () => {
    test('should return the counts of every page of the run', async () => {
      const summary = { trusteesCompared: 1 };
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
        {
          runId: 'run-1',
          pageKey: 'page-start',
          documentType: 'TRUSTEE_DATA_REPORT_PAGE',
          summary,
        },
      ]);

      expect(await repository.readPageSummaries('run-1')).toEqual([summary]);
      expect(findSpy).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'EQUALS',
            leftOperand: { name: 'documentType' },
            rightOperand: 'TRUSTEE_DATA_REPORT_PAGE',
          },
          { condition: 'EQUALS', leftOperand: { name: 'runId' }, rightOperand: 'run-1' },
        ],
      });
    });

    test('should wrap database errors as CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('boom'));

      await expect(repository.readPageSummaries('run-1')).rejects.toBeInstanceOf(CamsError);
    });
  });

  describe('deleteRunResults', () => {
    test("should delete the run's difference rows and page counts but not the run document", async () => {
      const deleteSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValue(3);

      await repository.deleteRunResults('run-1');

      expect(deleteSpy).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          { condition: 'EQUALS', leftOperand: { name: 'runId' }, rightOperand: 'run-1' },
          {
            condition: 'CONTAINS',
            leftOperand: { name: 'documentType' },
            rightOperand: ['TRUSTEE_DATA_REPORT_DIFFERENCE', 'TRUSTEE_DATA_REPORT_PAGE'],
          },
        ],
      });
    });

    test('should wrap database errors as CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany').mockRejectedValue(new Error('boom'));

      await expect(repository.deleteRunResults('run-1')).rejects.toBeInstanceOf(CamsError);
    });
  });

  describe('deleteRun', () => {
    test('should delete every document for the runId', async () => {
      const deleteSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValue(3);

      await repository.deleteRun('run-1');

      expect(deleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ leftOperand: { name: 'runId' }, rightOperand: 'run-1' }),
      );
    });

    test('should wrap database errors as CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany').mockRejectedValue(new Error('boom'));

      await expect(repository.deleteRun('run-1')).rejects.toBeInstanceOf(CamsError);
    });
  });
});
