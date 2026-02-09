import test, { expect, Page } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Assistants (CAMS-686)', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfileLink;
  let trusteeId: string;
  const createdAssistantNames: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Navigate to trustees list
    await page.goto(getUrl('/trustees'));
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

    // Navigate to trustee profile
    trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();
    await trusteeProfileLink.click();

    // Wait for trustee profile to load
    await expect(page.locator('.case-detail-header')).toBeVisible();

    // Capture the trustee ID from the URL
    const url = page.url();
    const match = url.match(/\/trustees\/([^/]+)/);
    if (match) {
      trusteeId = match[1];
    }
  });

  test.afterEach(async ({ page }) => {
    // Clean up any created assistants
    for (const assistantName of createdAssistantNames) {
      await deleteAssistantByName(page, assistantName);
    }
    createdAssistantNames.length = 0; // Clear the array
  });

  /**
   * Helper function to create an assistant with the given data
   */
  async function createAssistant(
    page: Page,
    data: {
      name: string;
      title?: string;
      address1?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      phone?: string;
      extension?: string;
      email?: string;
    },
  ) {
    // Click add assistant button (empty state or add another)
    const addAnotherButton = page.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = page.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for form to load
    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Fill in the form
    await page.locator('#assistant-name').fill(data.name);

    if (data.title) {
      await page.locator('#assistant-title').fill(data.title);
    }

    if (data.address1) {
      await page.locator('#assistant-address1').fill(data.address1);
    }

    if (data.city) {
      await page.locator('#assistant-city').fill(data.city);
    }

    if (data.state) {
      await page.locator('#assistant-state').fill(data.state);
    }

    if (data.zipCode) {
      await page.locator('#assistant-zip').fill(data.zipCode);
    }

    if (data.phone) {
      await page.locator('#assistant-phone').fill(data.phone);
    }

    if (data.extension) {
      await page.locator('#assistant-extension').fill(data.extension);
    }

    if (data.email) {
      await page.locator('#assistant-email').fill(data.email);
    }

    // Submit the form
    await page.locator('#submit-button').click();

    // Wait for save operation
    await page.waitForTimeout(ANALYZE_DELAY * 2);

    // Explicitly navigate back to the trustee profile
    await page.goto(getUrl(`/trustees/${trusteeId}`));

    // Wait for profile page to be visible
    await expect(page.locator('.case-detail-header')).toBeVisible();

    // Wait for assistant section to be present
    await page.waitForSelector('.trustee-assistant-information', {
      state: 'visible',
      timeout: 15000,
    });

    // Wait for data to fully render
    await page.waitForTimeout(ANALYZE_DELAY);

    // Track created assistant for cleanup
    createdAssistantNames.push(data.name);
  }

  /**
   * Helper function to delete an assistant by name
   */
  async function deleteAssistantByName(page: Page, name: string) {
    try {
      // Find the assistant by name
      const assistantNameElement = page.locator(`[data-testid^="assistant-name-"]`, {
        hasText: name,
      });

      if (!(await assistantNameElement.isVisible().catch(() => false))) {
        return; // Assistant doesn't exist, nothing to delete
      }

      // Get the index from the data-testid
      const testId = await assistantNameElement.getAttribute('data-testid');
      const index = testId?.match(/assistant-name-(\d+)/)?.[1];

      if (!index) return;

      // Click the edit button for this assistant
      const editButton = page.getByTestId(`button-edit-assistant-${index}`);
      await editButton.click();

      // Wait for form to load
      await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

      // Click delete button
      await page.locator('#delete-assistant-button').click();

      // Confirm deletion in modal
      await expect(
        page.locator('.remove-assistant-confirmation-modal').locator('[role="dialog"]'),
      ).toBeVisible();

      // Find and click the "Yes, Delete" button
      const deleteButton = page.locator('button', { hasText: 'Yes, Delete' });
      await deleteButton.click();

      // Wait for deletion to complete
      await page.waitForTimeout(ANALYZE_DELAY);
    } catch (error) {
      // Ignore errors during cleanup
      console.warn(`Failed to delete assistant ${name}:`, error);
    }
  }

  test('trustee profile with no assistants should not have accessibility issues', async ({
    page,
  }) => {
    // Wait for assistants section to render (empty state)
    await page.waitForSelector('.trustee-assistant-information', { state: 'visible' });

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add assistant form and save should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Click add assistant button
    const addAnotherButton = page.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = page.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for form to render
    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Verify all form fields are present
    await expect(page.locator('#assistant-name')).toBeVisible();
    await expect(page.locator('#assistant-title')).toBeVisible();
    await expect(page.locator('#assistant-address1')).toBeVisible();
    await expect(page.locator('#assistant-city')).toBeVisible();
    await expect(page.locator('#assistant-state')).toBeVisible();
    await expect(page.locator('#assistant-zip')).toBeVisible();
    await expect(page.locator('#assistant-phone')).toBeVisible();
    await expect(page.locator('#assistant-email')).toBeVisible();

    // Test accessibility of empty form
    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Fill and save the form
    const assistantName = `Test Assistant ${Date.now()}`;
    await page.locator('#assistant-name').fill(assistantName);
    await page.locator('#assistant-title').fill('Test Title');
    await page.locator('#assistant-email').fill('test@example.com');

    // Test accessibility with filled form
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Submit the form
    await page.locator('#submit-button').click();

    // Wait for navigation back to profile
    await page.waitForTimeout(ANALYZE_DELAY);
    await expect(page.locator('.case-detail-header')).toBeVisible();

    // Test accessibility of profile with new assistant
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Track for cleanup
    createdAssistantNames.push(assistantName);
  });

  test('edit assistant form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Mock data now provides assistants - no need to create one
    // Just wait for assistants to be visible
    await page.waitForSelector('[data-testid="assistant-name-0"]', {
      state: 'visible',
      timeout: 15000,
    });

    // Test accessibility of profile with assistants
    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Click edit on first assistant
    const editAssistantButton = page.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible({ timeout: 15000 });
    await editAssistantButton.click();

    // Wait for form to render with data
    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();
    await expect(page.locator('#assistant-name')).toBeVisible();
    await expect(page.locator('#assistant-title')).toBeVisible();

    // Test accessibility of edit form with data
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Make a change to test form in modified state
    await page.locator('#assistant-title').fill('Updated Title');

    // Test accessibility with modified form
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('assistant form with validation errors should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Navigate to add assistant form
    const addAnotherButton = page.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = page.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Trigger validation by submitting empty form (name is required)
    await page.locator('#submit-button').click();

    // Wait for validation errors to appear
    await page.waitForTimeout(ANALYZE_DELAY);

    // Verify error alert is present
    await expect(page.locator('[role="alert"]')).toBeVisible();

    // Test accessibility with validation errors displayed
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Cancel out of the form (no assistant created)
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.case-detail-header')).toBeVisible();
  });

  test('assistant form with partial address validation should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Navigate to add assistant form
    const addAnotherButton = page.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = page.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Fill required name field
    await page.locator('#assistant-name').fill('Test Assistant');

    // Fill partial address to trigger validation
    await page.locator('#assistant-address1').fill('123 Main St');
    // Leave city, state, zip empty to trigger completedAddressRequired validation

    // Submit to trigger validation
    await page.locator('#submit-button').click();

    // Wait for validation errors
    await page.waitForTimeout(ANALYZE_DELAY);

    // Verify error alert is present
    await expect(page.locator('[role="alert"]')).toBeVisible();

    // Test accessibility with partial address validation errors
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Cancel out of the form (no assistant created)
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.case-detail-header')).toBeVisible();
  });

  test('assistant form with extension without phone validation should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Navigate to add assistant form
    const addAnotherButton = page.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = page.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Fill required name field
    await page.locator('#assistant-name').fill('Test Assistant');

    // Fill extension without phone to trigger phoneRequiredWithExtension validation
    await page.locator('#assistant-phone').fill(''); // Make sure phone is empty
    await page.locator('#assistant-extension').fill('1234');

    // Submit to trigger validation
    await page.locator('#submit-button').click();

    // Wait for validation errors
    await page.waitForTimeout(ANALYZE_DELAY);

    // Verify error alert is present
    await expect(page.locator('[role="alert"]')).toBeVisible();

    // Test accessibility with extension validation errors
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Cancel out of the form (no assistant created)
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.case-detail-header')).toBeVisible();
  });

  test('delete assistant confirmation modal and deletion should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // First, create an assistant to delete
    const assistantName = `Delete Test Assistant ${Date.now()}`;
    await createAssistant(page, {
      name: assistantName,
      title: 'To Be Deleted',
      email: 'delete@example.com',
    });

    // Navigate to edit assistant form
    const editAssistantButton = page.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible();
    await editAssistantButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Click delete button to open modal
    await expect(page.locator('#delete-assistant-button')).toBeVisible();
    await page.locator('#delete-assistant-button').click();

    // Wait for modal to appear
    await expect(
      page.locator('.remove-assistant-confirmation-modal').locator('[role="dialog"]'),
    ).toBeVisible();

    // Verify modal content
    await expect(
      page.locator('text=Are you sure you want to delete this assistant?'),
    ).toBeVisible();
    await expect(page.locator("text=This action can't be undone.")).toBeVisible();

    // Test accessibility of modal
    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Confirm deletion
    const deleteButton = page.locator('button', { hasText: 'Yes, Delete' });
    await deleteButton.click();

    // Wait for deletion to complete and return to profile
    await page.waitForTimeout(ANALYZE_DELAY);
    await expect(page.locator('.case-detail-header')).toBeVisible();

    // Test accessibility after deletion
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Verify assistant was deleted (name should not be visible)
    const assistantNameElement = page.locator(`[data-testid^="assistant-name-"]`, {
      hasText: assistantName,
    });
    await expect(assistantNameElement).not.toBeVisible();

    // Remove from cleanup list since we already deleted it
    const index = createdAssistantNames.indexOf(assistantName);
    if (index > -1) {
      createdAssistantNames.splice(index, 1);
    }
  });

  test('assistant contact information display should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Create an assistant with full contact information
    const assistantName = `Contact Test Assistant ${Date.now()}`;
    await createAssistant(page, {
      name: assistantName,
      title: 'Contact Manager',
      address1: '123 Test Street',
      city: 'Test City',
      state: 'NY',
      zipCode: '12345',
      phone: '555-123-4567',
      extension: '123',
      email: 'contact@example.com',
    });

    // Wait for assistants section to render
    await page.waitForSelector('.trustee-assistant-information', { state: 'visible' });

    // Verify assistant contact information is displayed
    await expect(page.locator('[data-testid="assistant-name-0"]')).toHaveText(assistantName);
    await expect(page.locator('[data-testid="assistant-title-0"]')).toHaveText('Contact Manager');
    await expect(page.locator('[data-testid="assistant-0-street-address"]')).toHaveText(
      '123 Test Street',
    );
    await expect(page.locator('[data-testid="assistant-0-city"]')).toHaveText('Test City');
    await expect(page.locator('[data-testid="assistant-0-state"]')).toHaveText(', NY');
    await expect(page.locator('[data-testid="assistant-0-zip-code"]')).toHaveText('12345');
    await expect(page.locator('[data-testid="assistant-0-phone-number"]')).toContainText(
      '555-123-4567',
    );
    await expect(page.locator('[data-testid="assistant-0-email"]')).toContainText(
      'contact@example.com',
    );

    // Test accessibility of contact information display
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('multiple assistants display should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Create multiple assistants
    const assistant1Name = `Multi Assistant 1 ${Date.now()}`;
    const assistant2Name = `Multi Assistant 2 ${Date.now()}`;
    const assistant3Name = `Multi Assistant 3 ${Date.now()}`;

    await createAssistant(page, {
      name: assistant1Name,
      title: 'First Assistant',
      email: 'first@example.com',
    });

    await createAssistant(page, {
      name: assistant2Name,
      title: 'Second Assistant',
      email: 'second@example.com',
    });

    await createAssistant(page, {
      name: assistant3Name,
      title: 'Third Assistant',
      email: 'third@example.com',
    });

    // Verify multiple assistant cards are rendered
    const assistantCards = page.locator('.trustee-assistant-information');
    const count = await assistantCards.count();

    expect(count).toBeGreaterThanOrEqual(3);

    // Verify each assistant has unique identifiable information
    for (let i = 0; i < 3; i++) {
      const assistantName = page.locator(`[data-testid="assistant-name-${i}"]`);
      const editButton = page.getByTestId(`button-edit-assistant-${i}`);

      await expect(assistantName).toBeVisible();
      await expect(editButton).toBeVisible();

      // Verify edit button has proper aria-label
      const ariaLabel = await editButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Edit assistant');
    }

    // Test accessibility with multiple assistants
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee audit history with assistant changes should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Create an assistant to generate audit history
    const assistantName = `Audit Test Assistant ${Date.now()}`;
    await createAssistant(page, {
      name: assistantName,
      title: 'Audit Test',
      email: 'audit@example.com',
    });

    // Edit the assistant to create more history
    const editButton = page.getByTestId('button-edit-assistant-0');
    await editButton.click();
    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();
    await page.locator('#assistant-title').fill('Updated Audit Test');
    await page.locator('#submit-button').click();
    await page.waitForTimeout(ANALYZE_DELAY);
    await expect(page.locator('.case-detail-header')).toBeVisible();

    // Navigate to audit history section (if available)
    const auditHistorySection = page.locator('[data-testid="trustee-history-table"]');

    if (await auditHistorySection.isVisible().catch(() => false)) {
      // Verify audit history table is accessible
      await expect(auditHistorySection).toBeVisible();

      // Check for assistant history rows
      const assistantHistoryRows = page.locator('[data-testid^="change-type-assistant-"]');
      const historyCount = await assistantHistoryRows.count();

      if (historyCount > 0) {
        // Verify first assistant history row
        const firstRow = assistantHistoryRows.first();
        await expect(firstRow).toBeVisible();
      }

      await page.waitForTimeout(ANALYZE_DELAY);
      const accessibilityScanResults = await createAxeBuilder(page).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    } else {
      // Skip test if audit history is not available on this page
      test.skip();
    }
  });
});
