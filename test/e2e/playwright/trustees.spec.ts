import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';

const timeoutOption = { timeout: 30000 };

test.describe('Trustees', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Navigate to the trustees page and wait for it to load
    await page.goto('/trustees');
    await expect(page.getByTestId('trustees')).toBeVisible(timeoutOption);
  });

  test('should load trustees list page and display the header', async ({ page }) => {
    // Verify the main trustees page loads correctly
    await expect(page.getByTestId('trustees')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Trustees');

    // Verify the "Add New Trustee" button is visible
    await expect(page.getByTestId('trustees-add-link')).toBeVisible();
    await expect(page.getByTestId('trustees-add-link')).toHaveText('Add New Trustee');
  });

  test('should display trustees table when trustees exist', async ({ page }) => {
    // Wait for the trustees table to load
    const trusteesTable = page.getByTestId('trustees-table');
    await expect(trusteesTable).toBeVisible(timeoutOption);

    // Verify table headers are present
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
  });

  test('should navigate to trustee detail page when clicking on a trustee name', async ({
    page,
  }) => {
    // Wait for the trustees table to load
    const trusteesTable = page.getByTestId('trustees-table');
    await expect(trusteesTable).toBeVisible(timeoutOption);

    // Find the first trustee link in the table
    const firstTrusteeLink = page.locator('[data-testid^="trustee-link-"]').first();

    // Only proceed if there are trustees in the table
    if ((await firstTrusteeLink.count()) > 0) {
      await firstTrusteeLink.click();

      // Verify we navigated to the trustee detail page
      await expect(page).toHaveURL(new RegExp('/trustees/[^/]+$'));

      // Verify the trustee detail page loaded
      await expect(page.getByTestId('trustee-detail-screen')).toBeVisible(timeoutOption);
    } else {
      // If no trustees exist, just verify the table structure is correct
      console.log('No trustees found in table - skipping navigation test');
    }
  });

  test('should navigate to create trustee form when clicking "Add New Trustee"', async ({
    page,
  }) => {
    // Click the "Add New Trustee" button
    await page.getByTestId('trustees-add-link').click();

    // Verify we navigated to the create trustee page
    await expect(page).toHaveURL('/trustees/create');

    // Verify the create form is visible
    await expect(page.getByTestId('trustee-public-form')).toBeVisible(timeoutOption);

    // Verify the form title
    await expect(page.locator('h1')).toHaveText('Add Trustee Profile');
  });

  test('should test address fields on create form', async ({ page }) => {
    // Navigate to create trustee form
    await page.getByTestId('trustees-add-link').click();
    await expect(page.getByTestId('trustee-public-form')).toBeVisible(timeoutOption);

    // Test address fields
    const address1Input = page.locator('#trustee-address1');
    await expect(address1Input).toBeVisible();
    await address1Input.fill('123 Main St');

    const address2Input = page.locator('#trustee-address2');
    await expect(address2Input).toBeVisible();
    await address2Input.fill('Suite 100');

    const cityInput = page.locator('#trustee-city');
    await expect(cityInput).toBeVisible();
    await cityInput.fill('Anytown');

    const stateCombobox = page.locator('#trustee-state');
    await expect(stateCombobox).toBeVisible();

    // Click to open the dropdown and verify options are loaded
    await stateCombobox.click();
    const stateOptions = page.locator('#trustee-state [data-testid^="trustee-state-option-item-"]');
    if ((await stateOptions.count()) > 0) {
      // Select the first available state option
      await stateOptions.first().click();
    }

    const selectedOption = page.locator('#trustee-state .selection-label');
    await expect(selectedOption).toBeVisible();

    const zipInput = page.locator('#trustee-zip');
    await expect(zipInput).toBeVisible();
    await zipInput.fill('12345');

    // Verify all fields have the expected values
    await expect(address1Input).toHaveValue('123 Main St');
    await expect(address2Input).toHaveValue('Suite 100');
    await expect(cityInput).toHaveValue('Anytown');
    await expect(zipInput).toHaveValue('12345');
  });

  test.skip('should assign an auditor to a trustee', async ({ page }) => {
    // Navigate to the first trustee's detail page
    const trusteesTable = page.getByTestId('trustees-table');
    await expect(trusteesTable).toBeVisible(timeoutOption);

    const firstTrusteeLink = page.locator('[data-testid^="trustee-link-"]').first();

    // Only proceed if there are trustees
    if ((await firstTrusteeLink.count()) > 0) {
      await firstTrusteeLink.click();

      // Wait for the trustee detail page to load
      await expect(page.getByTestId('trustee-detail-screen')).toBeVisible(timeoutOption);

      // Navigate to the Assigned Staff tab
      const assignedStaffTab = page.getByTestId('trustee-assigned-staff-nav-link');
      await expect(assignedStaffTab).toBeVisible(timeoutOption);
      await assignedStaffTab.click();

      // Verify the auditor assignment section is visible
      const auditorSection = page.getByTestId('auditor-assignment-section');
      await expect(auditorSection).toBeVisible(timeoutOption);

      // Check if there's already an auditor assigned
      const noAuditorAssigned = page.getByTestId('no-auditor-assigned');
      const hasAuditor = (await noAuditorAssigned.count()) === 0;

      if (!hasAuditor) {
        // Click the "Add" button to open the auditor assignment modal
        const addButton = auditorSection.locator('[aria-label="Add assigned auditor to trustee"]');
        await expect(addButton).toBeVisible();
        await addButton.click();

        // Wait for the modal to appear
        const modal = page.getByRole('dialog', { name: 'Add Auditor' });
        await expect(modal).toBeVisible(timeoutOption);

        // Wait for the loading spinner to disappear and staff dropdown to be available
        await page.waitForSelector('[id^="assign-auditor-modal-"] .loading-spinner', {
          state: 'hidden',
          timeout: 10000,
        });

        // Find and select an auditor from the dropdown
        const staffSearchInput = page.locator('#staff-search-input');
        if ((await staffSearchInput.count()) > 0) {
          await staffSearchInput.click();

          // Wait for options to appear and select the first one
          const firstOption = page.locator('[id^="staff-search-option-"]').first();
          if ((await firstOption.count()) > 0) {
            await firstOption.click();

            // Click the submit button
            const submitButton = page.locator('button:has-text("Add Auditor")');
            await expect(submitButton).toBeVisible();
            await expect(submitButton).toBeEnabled();
            await submitButton.click();

            // Wait for the modal to close
            await expect(modal).not.toBeVisible({ timeout: 10000 });

            // Verify the auditor is now displayed in the section
            const auditorDisplay = page.getByTestId('auditor-assignments-display');
            await expect(auditorDisplay).toBeVisible(timeoutOption);
          } else {
            console.log('No auditors available in the system - skipping assignment');
          }
        }
      } else {
        console.log('Auditor already assigned - test verifies display');
        // Verify the auditor display is visible
        const auditorDisplay = page.getByTestId('auditor-assignments-display');
        await expect(auditorDisplay).toBeVisible();
      }
    } else {
      console.log('No trustees found - skipping auditor assignment test');
    }
  });
});
