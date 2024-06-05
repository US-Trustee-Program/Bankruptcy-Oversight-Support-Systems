import { render, screen } from '@testing-library/react';
import { describe } from 'vitest';
import { BadConfiguration } from './BadConfiguration';

describe('BadConfiguration', () => {
  test('should render alert', () => {
    const expectedMessage = 'test message';
    render(<BadConfiguration message={expectedMessage}></BadConfiguration>);
    const alert = screen.queryByTestId('alert-container');
    expect(alert).toBeInTheDocument();
  });
});
