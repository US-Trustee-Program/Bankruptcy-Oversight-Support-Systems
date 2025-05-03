import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { Banner } from './Banner';

describe('Test Banner Environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test('Should not have a css class based on launchDarklyEnvironment env var', () => {
    const expectedEnv = 'production';
    vi.stubEnv('CAMS_LAUNCH_DARKLY_ENV', 'production');
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
    vi.stubEnv('CAMS_LAUNCH_DARKLY_ENV', 'staging');
    render(
      <BrowserRouter>
        <Banner />
      </BrowserRouter>,
    );
    const header = screen.getByTestId('banner-header');
    expect(header).toHaveClass(expectedEnv);
  });
});
