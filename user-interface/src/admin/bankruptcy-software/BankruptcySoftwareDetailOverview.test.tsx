import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BankruptcySoftwareDetailOverview } from './BankruptcySoftwareDetailOverview';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

const softwareNoContact: BankruptcySoftwareProfile = {
  id: 'sw-1',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'Axos',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

const softwareWithContact: BankruptcySoftwareProfile = {
  ...softwareNoContact,
  contact: {
    contactNames: ['Jane Doe'],
    emails: ['jane@axos.com'],
    website: 'https://axos.com',
  },
};

function renderOverview(
  software: BankruptcySoftwareProfile,
  onEditGeneral = vi.fn(),
  onEditContact = vi.fn(),
) {
  return render(
    <BrowserRouter>
      <BankruptcySoftwareDetailOverview
        software={software}
        banks={[]}
        onEditGeneral={onEditGeneral}
        onEditContact={onEditContact}
        onAddBank={vi.fn()}
        onEditBankStatus={vi.fn()}
      />
    </BrowserRouter>,
  );
}

describe('BankruptcySoftwareDetailOverview', () => {
  test('should render General Information card with name and status', () => {
    renderOverview(softwareNoContact);
    expect(screen.getByText('General Information')).toBeInTheDocument();
    expect(screen.getByText('Axos')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('should render Inactive status when software is inactive', () => {
    renderOverview({ ...softwareNoContact, status: 'inactive' });
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('should render Vendor Contact Info. card', () => {
    renderOverview(softwareNoContact);
    expect(screen.getByText('Vendor Contact Info.')).toBeInTheDocument();
  });

  test('should show "(none)" when no contact info exists', () => {
    renderOverview(softwareNoContact);
    expect(screen.getByTestId('no-contact-info')).toBeInTheDocument();
  });

  test('should show FormattedContact when contact info exists', () => {
    renderOverview(softwareWithContact);
    expect(screen.queryByTestId('no-contact-info')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  test('should show Contact Address label when address is present', () => {
    const softwareWithAddress: BankruptcySoftwareProfile = {
      ...softwareNoContact,
      contact: {
        contactNames: ['Jane Doe'],
        address: { address1: '123 Main St', city: 'Springfield', state: 'IL', zipCode: '62701' },
      },
    };
    renderOverview(softwareWithAddress);
    expect(screen.getByText('Contact Address:')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });
});
