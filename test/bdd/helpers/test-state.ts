/**
 * Mutable State Graph for BDD Stateful Testing
 *
 * This class provides a mutable state container for BDD tests that need to test
 * interactive workflows involving both reads and writes.
 *
 * Key Capabilities:
 * - Stores test data (cases, transfers, consolidations, notes, etc.)
 * - Provides read operations for gateway spies
 * - Provides write operations to simulate persistence
 * - Includes assertion helpers for test verification
 * - Supports search operations
 *
 * Usage:
 * ```typescript
 * const state = await TestSetup
 *   .forUser(session)
 *   .withCase(testCase)
 *   .renderAt('/case-detail/123');
 *
 * // State tracks all data
 * expect(state.getCase('123')).toBeDefined();
 *
 * // Write operations update state
 * await createNoteViaUI();
 * state.expectNoteExists('123', 'My note content');
 *
 * // Subsequent reads reflect writes
 * expect(state.getNotes('123')).toHaveLength(1);
 * ```
 */

import type { CaseDetail, CaseNote } from '@common/cams/cases';
import type { CaseAssignment } from '@common/cams/assignments';
import type {
  TransferFrom,
  TransferTo,
  ConsolidationFrom,
  ConsolidationTo,
} from '@common/cams/events';

type Transfer = TransferFrom | TransferTo;
type Consolidation = ConsolidationFrom | ConsolidationTo;

// Note: Adjust this type based on your actual docket entry structure
interface DocketEntry {
  caseId: string;
  sequenceNumber?: number;
  dateFiled?: string;
  [key: string]: unknown;
}

// Search predicate interface
interface CasePredicate {
  caseNumber?: string;
  chapter?: string;
  divisionCode?: string;
  [key: string]: unknown;
}

export class TestState {
  // Core data stores
  private cases: Map<string, CaseDetail> = new Map();
  private transfers: Map<string, Transfer[]> = new Map();
  private consolidations: Map<string, Consolidation[]> = new Map();
  private assignments: Map<string, CaseAssignment[]> = new Map();
  private notes: Map<string, CaseNote[]> = new Map();
  private dockets: Map<string, DocketEntry[]> = new Map();

  // ============ CASE OPERATIONS ============

  setCase(caseDetail: CaseDetail): void {
    this.cases.set(caseDetail.caseId, caseDetail);
  }

  getCase(caseId: string): CaseDetail | undefined {
    return this.cases.get(caseId);
  }

  getAllCases(): CaseDetail[] {
    return Array.from(this.cases.values());
  }

  updateCase(caseId: string, updates: Partial<CaseDetail>): void {
    const existing = this.cases.get(caseId);
    if (!existing) throw new Error(`Case ${caseId} not found in test state`);

    this.cases.set(caseId, { ...existing, ...updates });
  }

  deleteCase(caseId: string): void {
    this.cases.delete(caseId);
    // Cascade delete related data
    this.transfers.delete(caseId);
    this.consolidations.delete(caseId);
    this.assignments.delete(caseId);
    this.notes.delete(caseId);
    this.dockets.delete(caseId);
  }

  // ============ TRANSFER OPERATIONS ============

  setTransfers(caseId: string, transfers: Transfer[]): void {
    this.transfers.set(caseId, transfers);
  }

  getTransfers(caseId: string): Transfer[] {
    return this.transfers.get(caseId) || [];
  }

  addTransfer(transfer: Transfer): void {
    const caseId = transfer.caseId;
    const existing = this.transfers.get(caseId) || [];
    this.transfers.set(caseId, [...existing, transfer]);
  }

  updateTransfer(transferId: string, updates: Partial<Transfer>): void {
    // Find and update transfer across all cases
    for (const [caseId, transfers] of this.transfers.entries()) {
      const index = transfers.findIndex((t) => t.id === transferId);
      if (index !== -1) {
        transfers[index] = { ...transfers[index], ...updates };
        this.transfers.set(caseId, transfers);
        return;
      }
    }
    throw new Error(`Transfer ${transferId} not found in test state`);
  }

  // ============ CONSOLIDATION OPERATIONS ============

  setConsolidations(caseId: string, consolidations: Consolidation[]): void {
    this.consolidations.set(caseId, consolidations);
  }

  getConsolidations(caseId: string): Consolidation[] {
    return this.consolidations.get(caseId) || [];
  }

  addConsolidation(consolidation: Consolidation): void {
    // Add to lead case or case ID depending on consolidation type
    const caseId = 'leadCase' in consolidation ? consolidation.leadCase : consolidation.caseId;
    const existing = this.consolidations.get(caseId) || [];
    this.consolidations.set(caseId, [...existing, consolidation]);
  }

  // ============ NOTES OPERATIONS ============

  setNotes(caseId: string, notes: CaseNote[]): void {
    this.notes.set(caseId, notes);
  }

  getNotes(caseId: string): CaseNote[] {
    return this.notes.get(caseId) || [];
  }

  addNote(note: CaseNote): void {
    const existing = this.notes.get(note.caseId) || [];
    const noteWithId = {
      ...note,
      id: note.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdOn: note.createdOn || new Date().toISOString(),
    };
    this.notes.set(note.caseId, [...existing, noteWithId]);
  }

  updateNote(noteId: string, updates: Partial<CaseNote>): void {
    // Find and update note across all cases
    for (const [caseId, notes] of this.notes.entries()) {
      const index = notes.findIndex((n) => n.id === noteId);
      if (index !== -1) {
        notes[index] = { ...notes[index], ...updates };
        this.notes.set(caseId, notes);
        return;
      }
    }
    throw new Error(`Note ${noteId} not found in test state`);
  }

  deleteNote(noteId: string): void {
    // Find and delete note across all cases
    for (const [caseId, notes] of this.notes.entries()) {
      const filtered = notes.filter((n) => n.id !== noteId);
      if (filtered.length < notes.length) {
        this.notes.set(caseId, filtered);
        return;
      }
    }
    throw new Error(`Note ${noteId} not found in test state`);
  }

  // ============ DOCKET OPERATIONS ============

  setDocketEntries(caseId: string, entries: DocketEntry[]): void {
    this.dockets.set(caseId, entries);
  }

  getDocketEntries(caseId: string): DocketEntry[] {
    return this.dockets.get(caseId) || [];
  }

  addDocketEntry(entry: DocketEntry): void {
    const existing = this.dockets.get(entry.caseId) || [];
    this.dockets.set(entry.caseId, [...existing, entry]);
  }

  // ============ ASSIGNMENT OPERATIONS ============

  setAssignments(caseId: string, assignments: CaseAssignment[]): void {
    this.assignments.set(caseId, assignments);
  }

  getAssignments(caseId: string): CaseAssignment[] {
    return this.assignments.get(caseId) || [];
  }

  assignAttorney(caseId: string, assignment: CaseAssignment): void {
    const existing = this.assignments.get(caseId) || [];
    this.assignments.set(caseId, [...existing, assignment]);
  }

  unassignAttorney(caseId: string, attorneyId: string): void {
    const existing = this.assignments.get(caseId) || [];
    this.assignments.set(
      caseId,
      existing.filter((a) => a.userId !== attorneyId),
    );
  }

  // ============ SEARCH OPERATIONS ============

  searchCases(predicate: CasePredicate): CaseDetail[] {
    let results = this.getAllCases();

    if (predicate.caseNumber) {
      results = results.filter((c) => c.caseId.includes(predicate.caseNumber!));
    }

    if (predicate.chapter) {
      results = results.filter((c) => c.chapter === predicate.chapter);
    }

    if (predicate.divisionCode) {
      results = results.filter((c) => c.courtDivisionCode === predicate.divisionCode);
    }

    return results;
  }

  // ============ ASSERTION HELPERS ============

  expectCaseExists(caseId: string): void {
    if (!this.cases.has(caseId)) {
      throw new Error(`Expected case ${caseId} to exist in test state, but it doesn't`);
    }
  }

  expectCaseNotExists(caseId: string): void {
    if (this.cases.has(caseId)) {
      throw new Error(`Expected case ${caseId} to NOT exist in test state, but it does`);
    }
  }

  expectTransferCount(caseId: string, count: number): void {
    const actual = this.getTransfers(caseId).length;
    if (actual !== count) {
      throw new Error(`Expected ${count} transfers for case ${caseId}, but found ${actual}`);
    }
  }

  expectNoteExists(caseId: string, noteContent: string): void {
    const notes = this.getNotes(caseId);
    const found = notes.some((n) => n.content.includes(noteContent));
    if (!found) {
      throw new Error(
        `Expected note containing "${noteContent}" for case ${caseId}, but not found`,
      );
    }
  }

  expectNoteCount(caseId: string, count: number): void {
    const actual = this.getNotes(caseId).length;
    if (actual !== count) {
      throw new Error(`Expected ${count} notes for case ${caseId}, but found ${actual}`);
    }
  }

  expectAssignmentExists(caseId: string, attorneyId: string): void {
    const assignments = this.getAssignments(caseId);
    const found = assignments.some((a) => a.userId === attorneyId);
    if (!found) {
      throw new Error(
        `Expected assignment for attorney ${attorneyId} on case ${caseId}, but not found`,
      );
    }
  }

  // ============ DEBUGGING HELPERS ============

  dump(): void {
    console.log('[TestState] Current state:');
    console.log('  Cases:', this.cases.size);
    console.log(
      '  Transfers:',
      Array.from(this.transfers.entries()).map(([k, v]) => `${k}: ${v.length}`),
    );
    console.log(
      '  Consolidations:',
      Array.from(this.consolidations.entries()).map(([k, v]) => `${k}: ${v.length}`),
    );
    console.log(
      '  Assignments:',
      Array.from(this.assignments.entries()).map(([k, v]) => `${k}: ${v.length}`),
    );
    console.log(
      '  Notes:',
      Array.from(this.notes.entries()).map(([k, v]) => `${k}: ${v.length}`),
    );
    console.log(
      '  Dockets:',
      Array.from(this.dockets.entries()).map(([k, v]) => `${k}: ${v.length}`),
    );
  }

  dumpCaseDetail(caseId: string): void {
    console.log(`[TestState] Details for case ${caseId}:`);
    console.log('  Case:', this.getCase(caseId));
    console.log('  Transfers:', this.getTransfers(caseId));
    console.log('  Consolidations:', this.getConsolidations(caseId));
    console.log('  Assignments:', this.getAssignments(caseId));
    console.log('  Notes:', this.getNotes(caseId));
    console.log('  Dockets:', this.getDocketEntries(caseId));
  }
}
