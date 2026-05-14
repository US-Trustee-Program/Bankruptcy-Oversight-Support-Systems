import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  test('should not call Api2.updateSoftware when Cancel is clicked', () => {
    const updateSpy = vi.spyOn(Api2, 'updateSoftware');
    renderForm();
    fireEvent.click(screen.getByTestId('cancel-contact-info-link'));
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
