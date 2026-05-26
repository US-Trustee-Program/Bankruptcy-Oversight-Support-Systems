import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SeedContext } from '../../runner.js';

// Mock mssql module
let mockQuery = vi.fn();
let mockInput = vi.fn();
let mockConnect = vi.fn();
let mockClose = vi.fn();

vi.mock('mssql', () => {
  return {
    default: {
      ConnectionPool: class MockConnectionPool {
        async connect() {
          mockConnect();
          return {
            request: () => ({ input: mockInput, query: mockQuery }),
            close: mockClose,
          };
        }
      },
      VarChar: 'VarChar',
    },
  };
});

import { ensureDxtrCase } from './ensure-dxtr-case.js';

describe('ensureDxtrCase', () => {
  let mockCtx: SeedContext;

  beforeEach(() => {
    mockQuery = vi.fn();
    mockInput = vi.fn().mockReturnThis();
    mockConnect = vi.fn();
    mockClose = vi.fn().mockResolvedValue(undefined);

    // Mock context with generateCaseId
    mockCtx = {
      generateCaseId: vi.fn().mockResolvedValue({
        caseId: '081-26-90001',
        caseNumber: '26-90001',
        csCaseId: 'SEED90001',
      }),
    };

    // Set minimal env vars
    process.env.MSSQL_HOST = 'localhost';
    process.env.MSSQL_USER = 'sa';
    process.env.MSSQL_PASS = 'pass';
    process.env.MSSQL_DATABASE_DXTR = 'DXTR';
  });

  test('returns empty operations when case exists in DXTR', async () => {
    // Mock: case exists
    mockQuery.mockResolvedValue({ recordset: [{ CS_CASEID: 'SEED90001' }] });

    const result = await ensureDxtrCase(mockCtx, {
      divisionCode: '081',
      chapter: '7',
      debtorName: 'Test Debtor',
      courtId: '0208',
      groupDesignator: 'NY',
    });

    expect(result.existed).toBe(true);
    expect(result.operations).toHaveLength(0);
    expect(result.caseInfo).toEqual({
      caseId: '081-26-90001',
      caseNumber: '26-90001',
      csCaseId: 'SEED90001',
    });

    // Verify DXTR was queried
    expect(mockConnect).toHaveBeenCalled();
    expect(mockInput).toHaveBeenCalledWith('csCaseId', 'VarChar', 'SEED90001');
    expect(mockInput).toHaveBeenCalledWith('courtId', 'VarChar', '0208');
    expect(mockClose).toHaveBeenCalled();
  });

  test('returns DXTR seed operations when case does not exist', async () => {
    // Mock: case does not exist
    mockQuery.mockResolvedValue({ recordset: [] });

    const result = await ensureDxtrCase(mockCtx, {
      divisionCode: '081',
      chapter: '7',
      debtorName: 'Test Debtor',
      courtId: '0208',
      groupDesignator: 'NY',
    });

    expect(result.existed).toBe(false);
    expect(result.operations).toHaveLength(2);

    // Verify AO_CS operation
    const csOp = result.operations[0];
    expect(csOp.db).toBe('dxtr');
    expect(csOp.collectionOrTable).toBe('AO_CS');
    expect(csOp.primaryKey).toEqual(['CS_CASEID', 'COURT_ID']);
    expect(csOp.insertOnly).toBe(true);
    expect(csOp.data[0]).toMatchObject({
      CS_CASEID: 'SEED90001',
      COURT_ID: '0208',
      CS_DIV: '081',
      CS_SHORT_TITLE: 'Test Debtor',
      CS_CHAPTER: '7',
      GRP_DES: 'NY',
    });

    // Verify AO_PY operation
    const pyOp = result.operations[1];
    expect(pyOp.db).toBe('dxtr');
    expect(pyOp.collectionOrTable).toBe('AO_PY');
    expect(pyOp.primaryKey).toEqual(['CS_CASEID', 'COURT_ID', 'PY_ROLE']);
    expect(pyOp.insertOnly).toBe(true);
    expect(pyOp.data[0]).toMatchObject({
      CS_CASEID: 'SEED90001',
      COURT_ID: '0208',
      PY_ROLE: 'DB',
      PY_LAST_NAME: 'Test Debtor',
    });
  });

  test('uses provided caseInfo instead of generating', async () => {
    mockQuery.mockResolvedValue({ recordset: [] });

    const result = await ensureDxtrCase(mockCtx, {
      divisionCode: '091',
      chapter: '11',
      debtorName: 'Existing Case',
      courtId: '0209',
      groupDesignator: 'BU',
      caseInfo: {
        caseId: '091-99-87899',
        caseNumber: '99-87899',
        csCaseId: 'SEED87899',
      },
    });

    // Should not call generateCaseId
    expect(mockCtx.generateCaseId).not.toHaveBeenCalled();

    // Should use provided caseInfo
    expect(result.caseInfo).toEqual({
      caseId: '091-99-87899',
      caseNumber: '99-87899',
      csCaseId: 'SEED87899',
    });

    // Operations should use provided IDs
    expect(result.operations[0].data[0].CS_CASEID).toBe('SEED87899');
  });

  test('generates correct case data for all chapters', async () => {
    mockQuery.mockResolvedValue({ recordset: [] });

    const chapters = ['7', '11', '12', '13', '15', '9'];

    for (const chapter of chapters) {
      const result = await ensureDxtrCase(mockCtx, {
        divisionCode: '081',
        chapter,
        debtorName: `Ch${chapter} Test`,
        courtId: '0208',
        groupDesignator: 'NY',
      });

      expect(result.operations[0].data[0].CS_CHAPTER).toBe(chapter);
      expect(result.operations[0].data[0].CS_SHORT_TITLE).toBe(`Ch${chapter} Test`);
    }
  });

  test('closes connection even if query fails', async () => {
    mockQuery.mockRejectedValue(new Error('Database error'));

    await expect(
      ensureDxtrCase(mockCtx, {
        divisionCode: '081',
        chapter: '7',
        debtorName: 'Test',
        courtId: '0208',
        groupDesignator: 'NY',
      }),
    ).rejects.toThrow('Database error');

    // Connection should still be closed
    expect(mockClose).toHaveBeenCalled();
  });
});
