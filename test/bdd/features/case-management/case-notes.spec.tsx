import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad, expectPageToContain } from '../../helpers/fluent-test-setup';
import MockData from '@common/cams/test-utilities/mock-data';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: Case Notes Management (Full Stack - Stateful)
 *
 * As a USTP user
 * I want to add and view case notes
 * So that I can track important information about bankruptcy cases
 *
 * This test suite demonstrates STATEFUL testing:
 * - User navigates to case detail screen
 * - User navigates to case notes tab
 * - User adds a new note (WRITE operation)
 * - State is updated to reflect the new note
 * - User can see the newly created note in the list (READ operation reflects write)
 *
 * Code Coverage:
 * - user-interface/src/case-detail/panels/case-notes/
 * - backend/lib/controllers/case-notes/
 * - backend/lib/use-cases/case-notes/
 */
describe.skip('Feature: Case Notes Management', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  afterEach(() => {
    clearAllRepositorySpies();
  });

  /**
   * Scenario: Add a case note and verify it appears in the list
   *
   * GIVEN a case with no notes
   * WHEN user navigates to case notes tab
   * AND adds a new note
   * THEN the note should be saved to state
   * AND appear in the notes list
   * AND state should reflect the new note count
   */
  it('should add a new case note and display it in the notes list', async () => {
    const user = userEvent.setup();

    // GIVEN: A case with no notes initially
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-12345',
        caseTitle: 'Test Corporation',
        chapter: '11',
        officeName: 'Manhattan',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      },
    });

    const view = await TestSetup.forUser(TestSessions.trialAttorney())
      .withCase(testCase)
      .withTransfers(testCase.caseId, [])
      .withConsolidations(testCase.caseId, [])
      .withCaseNotes(testCase.caseId, []) // Start with no notes
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // Verify case detail page loaded
    await expectPageToContain(testCase.caseTitle);

    // Verify we start with no notes in state
    view.expectNoteCount(testCase.caseId, 0);

    // WHEN: User navigates to case notes tab
    const notesLink = await screen.findByRole('link', { name: /notes/i });
    await user.click(notesLink);

    // Wait for navigation to complete
    await expectPageToContain('No case notes');

    // AND: User clicks "Add Note" button
    const addNoteButton = await screen.findByRole('button', { name: /add note/i });
    await user.click(addNoteButton);

    // Wait for modal to appear
    await waitFor(
      () => {
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Fill in the note content
    const noteContent = 'Initial case review completed. All documentation is in order.';
    const noteTextarea = await screen.findByLabelText(/note/i);
    await user.clear(noteTextarea);
    await user.type(noteTextarea, noteContent);

    // Submit the note
    const saveButton = await screen.findByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Wait for modal to close
    await waitFor(
      () => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // THEN: State should reflect the new note
    view.expectNoteCount(testCase.caseId, 1);
    view.expectNoteExists(testCase.caseId, noteContent);

    // Verify state contains the note
    const notes = view.getNotes(testCase.caseId);
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain(noteContent);
    expect(notes[0].caseId).toBe(testCase.caseId);

    // AND: Note should appear in the UI
    await waitFor(
      () => {
        expect(screen.getByText(noteContent)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    console.log('[TEST] ✓ Case note added successfully and appears in list');
  }, 30000);

  /**
   * Scenario: View existing case notes
   *
   * GIVEN a case with existing notes
   * WHEN user navigates to case notes tab
   * THEN all notes should be displayed
   */
  it('should display existing case notes', async () => {
    const user = userEvent.setup();

    // GIVEN: A case with existing notes
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-67890',
        caseTitle: 'Test Case with Notes',
        chapter: '7',
        officeName: 'Manhattan',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      },
    });

    const existingNotes = [
      {
        id: 'note-1',
        caseId: testCase.caseId,
        title: 'First Note',
        content: 'First note about this case',
        documentType: 'NOTE' as const,
        createdBy: { name: 'John Doe', id: 'john-doe-id' },
        createdOn: '2024-01-15T10:00:00.000Z',
        updatedBy: { name: 'John Doe', id: 'john-doe-id' },
        updatedOn: '2024-01-15T10:00:00.000Z',
      },
      {
        id: 'note-2',
        caseId: testCase.caseId,
        title: 'Second Note',
        content: 'Second note with additional details',
        documentType: 'NOTE' as const,
        createdBy: { name: 'Jane Smith', id: 'jane-smith-id' },
        createdOn: '2024-01-16T14:30:00.000Z',
        updatedBy: { name: 'Jane Smith', id: 'jane-smith-id' },
        updatedOn: '2024-01-16T14:30:00.000Z',
      },
    ];

    const view = await TestSetup.forUser(TestSessions.trialAttorney())
      .withCase(testCase)
      .withTransfers(testCase.caseId, [])
      .withConsolidations(testCase.caseId, [])
      .withCaseNotes(testCase.caseId, existingNotes)
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // Verify case detail page loaded
    await expectPageToContain(testCase.caseTitle);

    // Verify initial state
    view.expectNoteCount(testCase.caseId, 2);

    // WHEN: User navigates to case notes tab
    const notesLink = await screen.findByRole('link', { name: /notes/i });
    await user.click(notesLink);

    // THEN: All notes should be displayed
    await expectPageToContain('First note about this case');
    await expectPageToContain('Second note with additional details');

    console.log('[TEST] ✓ Existing case notes displayed successfully');
  }, 30000);

  /**
   * Scenario: Add multiple notes in sequence
   *
   * GIVEN a case with one existing note
   * WHEN user adds two more notes
   * THEN all three notes should be visible
   * AND state should track all notes correctly
   */
  it('should handle adding multiple notes in sequence', async () => {
    const user = userEvent.setup();

    // GIVEN: A case with one existing note
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-11111',
        caseTitle: 'Multi-Note Test Case',
        chapter: '11',
        officeName: 'Manhattan',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      },
    });

    const existingNote = {
      id: 'note-1',
      caseId: testCase.caseId,
      title: 'Initial Note',
      content: 'Initial note',
      documentType: 'NOTE' as const,
      createdBy: { name: 'John Doe', id: 'john-doe-id' },
      createdOn: '2024-01-01T10:00:00.000Z',
      updatedBy: { name: 'John Doe', id: 'john-doe-id' },
      updatedOn: '2024-01-01T10:00:00.000Z',
    };

    const view = await TestSetup.forUser(TestSessions.trialAttorney())
      .withCase(testCase)
      .withTransfers(testCase.caseId, [])
      .withConsolidations(testCase.caseId, [])
      .withCaseNotes(testCase.caseId, [existingNote])
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // Verify case detail page loaded
    await expectPageToContain(testCase.caseTitle);

    // Verify starting state
    view.expectNoteCount(testCase.caseId, 1);

    // Navigate to notes tab
    const notesLink = await screen.findByRole('link', { name: /notes/i });
    await user.click(notesLink);

    // Verify existing note is displayed
    await expectPageToContain('Initial note');

    // WHEN: User adds first new note
    const addNoteButton = await screen.findByRole('button', { name: /add note/i });
    await user.click(addNoteButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const noteContent1 = 'Second note added during test';
    const noteTextarea1 = await screen.findByLabelText(/note/i);
    await user.clear(noteTextarea1);
    await user.type(noteTextarea1, noteContent1);

    const saveButton1 = await screen.findByRole('button', { name: /save/i });
    await user.click(saveButton1);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify state updated
    view.expectNoteCount(testCase.caseId, 2);

    // AND: User adds second new note
    const addNoteButton2 = await screen.findByRole('button', { name: /add note/i });
    await user.click(addNoteButton2);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const noteContent2 = 'Third note completing the sequence';
    const noteTextarea2 = await screen.findByLabelText(/note/i);
    await user.clear(noteTextarea2);
    await user.type(noteTextarea2, noteContent2);

    const saveButton2 = await screen.findByRole('button', { name: /save/i });
    await user.click(saveButton2);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // THEN: State should have all three notes
    view.expectNoteCount(testCase.caseId, 3);
    view.expectNoteExists(testCase.caseId, 'Initial note');
    view.expectNoteExists(testCase.caseId, noteContent1);
    view.expectNoteExists(testCase.caseId, noteContent2);

    // Verify all notes in UI
    await waitFor(() => {
      expect(screen.getByText('Initial note')).toBeInTheDocument();
      expect(screen.getByText(noteContent1)).toBeInTheDocument();
      expect(screen.getByText(noteContent2)).toBeInTheDocument();
    });

    // Final state verification
    const allNotes = view.getNotes(testCase.caseId);
    expect(allNotes).toHaveLength(3);

    console.log('[TEST] ✓ Multiple notes added and tracked in state successfully');
  }, 45000);
});
