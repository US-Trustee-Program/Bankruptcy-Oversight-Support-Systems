import { render, screen } from '@testing-library/react';
import { Banner } from './Banner';
import { BrowserRouter } from 'react-router-dom';
import { mockConfiguration } from '@/lib/testing/mock-configuration';

describe('Test Banner Environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test('Should not have a css class based on launchDarklyEnvironment env var', () => {
    const expectedEnv = 'production';
    mockConfiguration({ launchDarklyEnv: 'production' });
    render(
      <BrowserRouter>
        <Banner />
      </BrowserRouter>,
    );
    const header = screen.getByTestId('banner-header');
    expect(header).not.toHaveClass(expectedEnv);
  });
  test('Should have a css class based on launchDarklyEnvironment env var', () => {
    const expectedEnv = 'staging';
    mockConfiguration({ launchDarklyEnv: expectedEnv });
    render(
      <BrowserRouter>
        <Banner />
      </BrowserRouter>,
    );
    const header = screen.getByTestId('banner-header');
    expect(header).toHaveClass(expectedEnv);
  });
});
