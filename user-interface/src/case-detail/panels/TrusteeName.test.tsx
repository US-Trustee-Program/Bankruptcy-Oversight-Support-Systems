import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { TrusteeName } from './TrusteeName';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';

const TRUSTEE_NAME = 'John Doe';
const TRUSTEE_ID = 'trustee-123';

describe('TrusteeName', () => {
  test('renders the name as a link when the user has TrusteeAdmin access', () => {
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    render(
      <BrowserRouter>
        <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} />
      </BrowserRouter>,
    );

    const link = screen.getByTestId('case-detail-trustee-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent(TRUSTEE_NAME);
    expect(link).toHaveAttribute('href', `/trustees/${TRUSTEE_ID}`);
  });

  test('renders the name as plain text when the user does not have TrusteeAdmin access', () => {
    const user = MockData.getCamsUser({ roles: [] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    render(
      <BrowserRouter>
        <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} />
      </BrowserRouter>,
    );

    expect(screen.queryByTestId('case-detail-trustee-link')).not.toBeInTheDocument();
    expect(screen.getByText(TRUSTEE_NAME)).toBeInTheDocument();
  });
});
