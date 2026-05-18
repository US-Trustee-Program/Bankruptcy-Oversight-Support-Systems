import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SoftwareVendorContactInfoForm } from './SoftwareVendorContactInfoForm';
import Api2 from '@/lib/models/api2';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

const software: BankruptcySoftwareProfile = {
  id: 'sw-1',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'Axos',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

const softwareWithContact: BankruptcySoftwareProfile = {
  ...software,
  contact: {
    contactNames: ['Jane Doe'],
    address: {
      address1: '123 Main St',
      city: 'Denver',
      state: 'CO',
      zipCode: '80201',
      countryCode: 'US',
    },
    phone: { number: '303-555-1234', extension: '101' },
    emails: ['jane@axos.com'],
    website: 'https://axos.com',
  },
};

const softwareWithInvalidContact: BankruptcySoftwareProfile = {
  ...software,
  contact: {
    emails: ['bad@@email'],
    website: 'not@@avalid.url',
  },
};

const updatedSoftware: BankruptcySoftwareProfile = {
  ...software,
  contact: { emails: ['jane@axos.com'] },
};

function renderForm(sw = software, onSaved = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[`/admin/bankruptcy-software/sw-1/contact-info`]}>
      <Routes>
        <Route
          path="/admin/bankruptcy-software/:softwareId/contact-info"
          element={<SoftwareVendorContactInfoForm software={sw} onSaved={onSaved} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SoftwareVendorContactInfoForm', () => {
  let alertHook: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  beforeEach(() => {
    alertHook = TestingUtilities.spyOnGlobalAlert();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render all expected fields', () => {
    renderForm();
    expect(screen.getByLabelText('Software Contact Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Software Contact Address Line 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Software Contact City')).toBeInTheDocument();
    expect(screen.getByLabelText('Software Contact Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Website')).toBeInTheDocument();
    expect(screen.getByTestId('add-contact-name-button')).toBeInTheDocument();
    expect(screen.getByTestId('add-email-button')).toBeInTheDocument();
  });

  test('should pre-fill fields from existing contact', () => {
    renderForm(softwareWithContact);
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Denver')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@axos.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://axos.com')).toBeInTheDocument();
  });

  test('should add a new contact name input when "+ Add Another Contact Name" is clicked', () => {
    const { container } = renderForm();
    const before = container.querySelectorAll('input[id^="contact-name-"]').length;
    fireEvent.click(screen.getByTestId('add-contact-name-button'));
    const after = container.querySelectorAll('input[id^="contact-name-"]').length;
    expect(after).toBe(before + 1);
  });

  test('should add a new email input when "+ Add Another Email" is clicked', () => {
    const { container } = renderForm();
    const before = container.querySelectorAll('input[id^="email-"]').length;
    fireEvent.click(screen.getByTestId('add-email-button'));
    const after = container.querySelectorAll('input[id^="email-"]').length;
    expect(after).toBe(before + 1);
  });

  test('should call Api2.updateSoftware with contact data and invoke onSaved on save', async () => {
    const onSaved = vi.fn();
    vi.spyOn(Api2, 'updateSoftware').mockResolvedValue({ data: updatedSoftware });

    renderForm(software, onSaved);
    const emailInput = screen.getByLabelText('Software Contact Email');
    fireEvent.change(emailInput, { target: { value: 'jane@axos.com' } });
    fireEvent.click(screen.getByTestId('button-save-contact-info'));

    await waitFor(() => {
      expect(Api2.updateSoftware).toHaveBeenCalledWith(
        'sw-1',
        expect.objectContaining({
          contact: expect.objectContaining({
            emails: ['jane@axos.com'],
          }),
        }),
      );
      expect(onSaved).toHaveBeenCalledWith(updatedSoftware);
    });
  });

  test('should render phone, extension, and address fields', () => {
    renderForm();
    expect(screen.getByLabelText('Software Contact Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Extension')).toBeInTheDocument();
    expect(screen.getByLabelText('Software Contact Address Line 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Software Contact Zip Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Software Contact State')).toBeInTheDocument();
  });

  test('should pre-fill phone and extension from existing contact', () => {
    renderForm(softwareWithContact);
    expect(screen.getByDisplayValue('303-555-1234')).toBeInTheDocument();
    expect(screen.getByDisplayValue('101')).toBeInTheDocument();
  });

  test('should update contact name when typed into', () => {
    const { container } = renderForm();
    const nameInput = container.querySelector('input[id="contact-name-0"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    expect(nameInput.value).toBe('Updated Name');
  });

  test('should update email when typed into additional email field', () => {
    const { container } = renderForm();
    fireEvent.click(screen.getByTestId('add-email-button'));
    const emailInputs = container.querySelectorAll('input[id^="email-"]');
    fireEvent.change(emailInputs[1], { target: { value: 'second@axos.com' } });
    expect((emailInputs[1] as HTMLInputElement).value).toBe('second@axos.com');
  });

  test('should include phone and address in save payload', async () => {
    const onSaved = vi.fn();
    vi.spyOn(Api2, 'updateSoftware').mockResolvedValue({ data: updatedSoftware });

    renderForm(software, onSaved);
    fireEvent.change(screen.getByLabelText('Software Contact Phone'), {
      target: { value: '303-555-0000' },
    });
    fireEvent.change(screen.getByLabelText('Software Contact Address Line 1'), {
      target: { value: '456 Oak Ave' },
    });
    fireEvent.change(screen.getByLabelText('Software Contact City'), {
      target: { value: 'Boulder' },
    });
    fireEvent.click(screen.getByTestId('button-save-contact-info'));

    await waitFor(() => {
      expect(Api2.updateSoftware).toHaveBeenCalledWith(
        'sw-1',
        expect.objectContaining({
          contact: expect.objectContaining({
            phone: expect.objectContaining({ number: '303-555-0000' }),
            address: expect.objectContaining({ address1: '456 Oak Ave', city: 'Boulder' }),
          }),
        }),
      );
    });
  });

  test('should show error alert when save fails', async () => {
    vi.spyOn(Api2, 'updateSoftware').mockRejectedValue(new Error('server error'));

    renderForm();
    fireEvent.click(screen.getByTestId('button-save-contact-info'));

    await waitFor(() => {
      expect(alertHook.error).toHaveBeenCalledWith(
        'Failed to update vendor contact information. Please try again.',
      );
    });
  });

  test('should show success alert on save', async () => {
    vi.spyOn(Api2, 'updateSoftware').mockResolvedValue({ data: updatedSoftware });

    renderForm();
    fireEvent.click(screen.getByTestId('button-save-contact-info'));

    await waitFor(() => {
      expect(alertHook.success).toHaveBeenCalledWith(
        'Vendor contact information updated successfully.',
      );
    });
  });

  test('should update address line 2, zip, extension, and website when typed into', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Software Contact Address Line 2'), {
      target: { value: 'Suite 100' },
    });
    fireEvent.change(screen.getByLabelText('Software Contact Zip Code'), {
      target: { value: '80201' },
    });
    fireEvent.change(screen.getByLabelText('Extension'), {
      target: { value: '123' },
    });
    fireEvent.change(screen.getByLabelText('Website'), {
      target: { value: 'https://example.com' },
    });
    expect(screen.getByDisplayValue('Suite 100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
  });

  test('should show email and website errors on mount when existing contact data is invalid', () => {
    renderForm(softwareWithInvalidContact);
    expect(screen.getByText('Must be a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Website must be a valid URL')).toBeInTheDocument();
    expect(screen.getByTestId('button-save-contact-info')).toBeDisabled();
  });

  test('should strip non-digit characters from extension input', () => {
    renderForm();
    const extensionInput = screen.getByLabelText('Extension') as HTMLInputElement;
    fireEvent.change(extensionInput, { target: { value: 'abc12x3' } });
    expect(extensionInput.value).toBe('123');
  });

  test('should limit extension to 6 digits', () => {
    renderForm();
    const extensionInput = screen.getByLabelText('Extension') as HTMLInputElement;
    fireEvent.change(extensionInput, { target: { value: '1234567890' } });
    expect(extensionInput.value).toBe('123456');
  });

  test('should show email error message on change with invalid value', () => {
    renderForm();
    const emailInput = screen.getByLabelText('Software Contact Email');
    fireEvent.change(emailInput, { target: { value: 'bad@@example' } });
    expect(screen.getByText('Must be a valid email address')).toBeInTheDocument();
  });

  test('should clear email error when email becomes valid', () => {
    renderForm();
    const emailInput = screen.getByLabelText('Software Contact Email');
    fireEvent.change(emailInput, { target: { value: 'bad@@example' } });
    expect(screen.getByText('Must be a valid email address')).toBeInTheDocument();
    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
    expect(screen.queryByText('Must be a valid email address')).not.toBeInTheDocument();
  });

  test('should show website error message on change with invalid URL', () => {
    renderForm();
    const websiteInput = screen.getByLabelText('Website');
    fireEvent.change(websiteInput, { target: { value: 'not@@avalid.url' } });
    expect(screen.getByText('Website must be a valid URL')).toBeInTheDocument();
  });

  test('should clear website error when URL becomes valid', () => {
    renderForm();
    const websiteInput = screen.getByLabelText('Website');
    fireEvent.change(websiteInput, { target: { value: 'not@@avalid.url' } });
    expect(screen.getByText('Website must be a valid URL')).toBeInTheDocument();
    fireEvent.change(websiteInput, { target: { value: 'https://example.com' } });
    expect(screen.queryByText('Website must be a valid URL')).not.toBeInTheDocument();
  });

  test('should disable Save button when email has a validation error', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Software Contact Email'), {
      target: { value: 'notanemail@@' },
    });
    expect(screen.getByTestId('button-save-contact-info')).toBeDisabled();
  });

  test('should disable Save button when website has a validation error', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Website'), {
      target: { value: 'not@@avalidurl' },
    });
    expect(screen.getByTestId('button-save-contact-info')).toBeDisabled();
  });

  test('should re-enable Save button when email error is corrected', () => {
    renderForm();
    const emailInput = screen.getByLabelText('Software Contact Email');
    fireEvent.change(emailInput, { target: { value: 'notanemail@@' } });
    expect(screen.getByTestId('button-save-contact-info')).toBeDisabled();
    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
    expect(screen.getByTestId('button-save-contact-info')).not.toBeDisabled();
  });

  test('should re-enable Save button when website error is corrected', () => {
    renderForm();
    const websiteInput = screen.getByLabelText('Website');
    fireEvent.change(websiteInput, { target: { value: 'not@@avalidurl' } });
    expect(screen.getByTestId('button-save-contact-info')).toBeDisabled();
    fireEvent.change(websiteInput, { target: { value: 'https://example.com' } });
    expect(screen.getByTestId('button-save-contact-info')).not.toBeDisabled();
  });

  test('should not call Api2.updateSoftware when Cancel is clicked', () => {
    const updateSpy = vi.spyOn(Api2, 'updateSoftware');
    renderForm();
    fireEvent.click(screen.getByTestId('cancel-contact-info-link'));
    expect(updateSpy).not.toHaveBeenCalled();
  });

  test('should clear state when state combobox selection is cleared', async () => {
    const userEvent = TestingUtilities.setupUserEvent();
    const updateSpy = vi
      .spyOn(Api2, 'updateSoftware')
      .mockResolvedValue({ data: software } as never);
    renderForm();

    // Fill city so hasAddress is true even after state is cleared
    fireEvent.change(screen.getByLabelText('Software Contact City'), {
      target: { value: 'Denver' },
    });

    const combobox = screen.getByRole('combobox');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'CO');
    await userEvent.click(await screen.findByText('CO - Colorado'));

    await userEvent.click(screen.getByTestId('button-state-clear-all'));

    await userEvent.click(screen.getByTestId('button-save-contact-info'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'sw-1',
        expect.objectContaining({
          contact: expect.objectContaining({
            address: expect.objectContaining({ city: 'Denver', state: undefined }),
          }),
        }),
      );
    });
  });
});
