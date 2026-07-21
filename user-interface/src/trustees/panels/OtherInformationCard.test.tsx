import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import OtherInformationCard from './OtherInformationCard';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const softwareProfile: BankruptcySoftwareProfile = {
  id: 'sw-1',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'BestCase Trustee Software',
  status: 'active',
  associatedBanks: [{ bankId: 'bank-1', bankName: 'First National Bank', status: 'active' }],
  updatedOn: '2024-01-01T00:00:00Z',
  updatedBy: SYSTEM_USER_REFERENCE,
};

describe('OtherInformationCard', () => {
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    mockOnEdit.mockClear();
  });

  test('shows "No information added." when there is no software or bank data', () => {
    render(<OtherInformationCard softwareProfiles={[]} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('no-other-information')).toHaveTextContent('No information added.');
  });

  test('resolves the software name from a matching software profile', () => {
    render(
      <OtherInformationCard
        softwareId="sw-1"
        softwareProfiles={[softwareProfile]}
        onEdit={mockOnEdit}
      />,
    );

    expect(screen.getByTestId('trustee-software')).toHaveTextContent(
      'Software: BestCase Trustee Software',
    );
  });

  test('shows "Unknown software" when softwareId has no matching profile', () => {
    render(
      <OtherInformationCard
        softwareId="sw-missing"
        softwareProfiles={[softwareProfile]}
        onEdit={mockOnEdit}
      />,
    );

    expect(screen.getByTestId('trustee-software')).toHaveTextContent('Software: Unknown software');
  });

  test('resolves a bank ID to its name via the selected software profile', () => {
    render(
      <OtherInformationCard
        softwareId="sw-1"
        banks={['bank-1']}
        softwareProfiles={[softwareProfile]}
        onEdit={mockOnEdit}
      />,
    );

    expect(screen.getByTestId('trustee-bank-0')).toHaveTextContent('Bank: First National Bank');
  });

  test('falls back to the raw bank value when it is not in the associated banks map', () => {
    render(
      <OtherInformationCard
        softwareId="sw-1"
        banks={['unmapped-bank']}
        softwareProfiles={[softwareProfile]}
        onEdit={mockOnEdit}
      />,
    );

    expect(screen.getByTestId('trustee-bank-0')).toHaveTextContent('Bank: unmapped-bank');
  });

  test('renders multiple banks', () => {
    render(
      <OtherInformationCard
        softwareId="sw-1"
        banks={['bank-1', 'unmapped-bank']}
        softwareProfiles={[softwareProfile]}
        onEdit={mockOnEdit}
      />,
    );

    expect(screen.getByTestId('trustee-bank-0')).toHaveTextContent('Bank: First National Bank');
    expect(screen.getByTestId('trustee-bank-1')).toHaveTextContent('Bank: unmapped-bank');
  });

  test('calls onEdit when the edit button is clicked', () => {
    render(<OtherInformationCard softwareProfiles={[]} onEdit={mockOnEdit} />);

    screen.getByRole('button', { name: 'Edit other trustee information' }).click();

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });
});
