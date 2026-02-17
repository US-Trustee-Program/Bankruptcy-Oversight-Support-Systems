import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import StaffContactLinks from './StaffContactLinks';
import { CamsUserReference } from '@common/cams/users';

describe('StaffContactLinks', () => {
  test('should render all contact links when email is provided', () => {
    const user: CamsUserReference = {
      id: 'user-1',
      name: 'John Doe',
      email: 'john.doe@example.com',
    };

    render(<StaffContactLinks user={user} />);

    const container = document.querySelector('.staff-contact-links');
    expect(container).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);

    expect(links[0]).toHaveAttribute('href', 'mailto:john.doe@example.com');
    expect(links[1]).toHaveAttribute(
      'href',
      'msteams://teams.microsoft.com/l/chat/0/0?users=john.doe@example.com',
    );
    expect(links[2]).toHaveAttribute(
      'href',
      'msteams://teams.microsoft.com/l/call/0/0?users=john.doe@example.com',
    );
  });

  test('should not render when email is not provided', () => {
    const user: CamsUserReference = {
      id: 'user-1',
      name: 'John Doe',
    };

    const { container } = render(<StaffContactLinks user={user} />);

    expect(container.firstChild).toBeNull();
  });

  test('should render with correct aria labels', () => {
    const user: CamsUserReference = {
      id: 'user-1',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
    };

    render(<StaffContactLinks user={user} />);

    expect(screen.getByLabelText('Email: jane.smith@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Teams chat with Jane Smith')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Teams call with Jane Smith')).toBeInTheDocument();
  });
});
