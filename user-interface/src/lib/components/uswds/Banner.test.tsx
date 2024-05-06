import { render, screen } from '@testing-library/react';
import { Banner } from './Banner';
import React from 'react';

describe('Test Banner Environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test('Should have proper class based on launchDarklyEnvironment', () => {
    //const expectedEnv = 'staging';
    vi.stubEnv('CAMS_LAUNCH_DARKLY_ENV', 'production');
    render(
      <React.StrictMode>
        <Banner></Banner>
      </React.StrictMode>,
    );
  });
  const header = document.querySelector('.usa-banner__header');
  screen.debug;
  expect(header).toHaveClass('staging');
});
