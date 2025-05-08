import { render, screen } from '@testing-library/react';
import { Banner } from './Banner';
import { BrowserRouter } from 'react-router-dom';

const originalCamsConfiguration = window.CAMS_CONFIGURATION;
beforeAll(() => {
  window.CAMS_CONFIGURATION = {
    ...originalCamsConfiguration,
  };
});

afterAll(() => {
  window.CAMS_CONFIGURATION = originalCamsConfiguration;
});

describe('Test Banner Environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test('Should not have a css class based on launchDarklyEnvironment env var', () => {
    const expectedEnv = 'production';
    window.CAMS_CONFIGURATION.CAMS_LAUNCH_DARKLY_ENV = 'production';
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
    window.CAMS_CONFIGURATION.CAMS_LAUNCH_DARKLY_ENV = 'staging';
    render(
      <BrowserRouter>
        <Banner />
      </BrowserRouter>,
    );
    const header = screen.getByTestId('banner-header');
    expect(header).toHaveClass(expectedEnv);
  });
});
