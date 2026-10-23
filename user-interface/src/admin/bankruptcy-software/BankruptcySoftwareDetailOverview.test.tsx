import { fireEvent, render, screen } from '@testing-library/react';
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
        softwareId="sw-1"
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should call onEditGeneral when the General Information edit button is clicked', () => {
    const onEditGeneral = vi.fn();
    renderOverview(softwareNoContact, onEditGeneral);
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);
    expect(onEditGeneral).toHaveBeenCalledTimes(1);
  });

  test('should call onEditContact when the Vendor Contact Info edit button is clicked', () => {
    const onEditContact = vi.fn();
    renderOverview(softwareNoContact, vi.fn(), onEditContact);
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[1]);
    expect(onEditContact).toHaveBeenCalledTimes(1);
  });

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

  test('should render additional emails when contact has multiple', () => {
    const softwareWithMultipleEmails: BankruptcySoftwareProfile = {
      ...softwareNoContact,
      contact: {
        contactNames: ['Jane Doe'],
        emails: ['jane@axos.com', 'support@axos.com', 'billing@axos.com'],
      },
    };
    renderOverview(softwareWithMultipleEmails);
    expect(screen.getByText('support@axos.com')).toBeInTheDocument();
    expect(screen.getByText('billing@axos.com')).toBeInTheDocument();
  });

  test('should render phone number from contact.phones array', () => {
    const softwareWithPhone: BankruptcySoftwareProfile = {
      ...softwareNoContact,
      contact: {
        phones: [{ number: '212-555-0100', type: 'direct' }],
      },
    };
    renderOverview(softwareWithPhone);
    expect(screen.queryByTestId('no-contact-info')).not.toBeInTheDocument();
    expect(screen.getByText('212-555-0100')).toBeInTheDocument();
  });

  test('should render website when contact has only a website', () => {
    const softwareWebsiteOnly: BankruptcySoftwareProfile = {
      ...softwareNoContact,
      contact: {
        website: 'https://axos.com',
      },
    };
    renderOverview(softwareWebsiteOnly);
    expect(screen.queryByTestId('no-contact-info')).not.toBeInTheDocument();
    expect(screen.getByText('https://axos.com')).toBeInTheDocument();
  });

  describe('phones', () => {
    test('should show all typed phones with type labels', () => {
      const softwareMultiPhone: BankruptcySoftwareProfile = {
        ...softwareNoContact,
        contact: {
          phones: [
            { number: '212-555-0100', type: 'direct' },
            { number: '212-555-0200', type: 'fax' },
          ],
        },
      };
      renderOverview(softwareMultiPhone);
      expect(screen.getByText('212-555-0100')).toBeInTheDocument();
      expect(screen.getByText('212-555-0200')).toBeInTheDocument();
      expect(screen.getByText('(Direct)')).toBeInTheDocument();
      expect(screen.getByText('(Fax)')).toBeInTheDocument();
    });

    test('should display phones sorted by type (direct before fax) when fixture is out of order', () => {
      const softwareOutOfOrder: BankruptcySoftwareProfile = {
        ...softwareNoContact,
        contact: {
          phones: [
            { number: '212-555-0200', type: 'fax' },
            { number: '212-555-0100', type: 'direct' },
          ],
        },
      };
      const { container } = renderOverview(softwareOutOfOrder);
      const phoneEls = container.querySelectorAll('.phone');
      expect(phoneEls[0].textContent).toContain('212-555-0100');
      expect(phoneEls[1].textContent).toContain('212-555-0200');
    });

    test('should show a fax-only contact as contact info', () => {
      const softwareFaxOnly: BankruptcySoftwareProfile = {
        ...softwareNoContact,
        contact: { phones: [{ number: '212-555-0200', type: 'fax' }] },
      };
      renderOverview(softwareFaxOnly);
      expect(screen.getByText('212-555-0200')).toBeInTheDocument();
      expect(screen.getByText('(Fax)')).toBeInTheDocument();
      expect(screen.queryByTestId('no-contact-info')).not.toBeInTheDocument();
    });
  });
});
