import { render, screen } from '@testing-library/react';
import { describe } from 'vitest';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';

describe('AuthorizedUseOnly', () => {
  test('should render alert', () => {
    render(<AuthorizedUseOnly></AuthorizedUseOnly>);
    expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
  });
});
