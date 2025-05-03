import { render } from '@testing-library/react';
import { BrowserRouter, useNavigate } from 'react-router-dom';

import useCamsNavigator, { redirectTo } from './UseCamsNavigator';

function MyComponent() {
  const navigator = useCamsNavigator();
  navigator.navigateTo('/small/mouse');
  return <></>;
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe('tests for UseCamsNavigator module', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: {
        assign: vi.fn(),
        pathname: '/foo/bar',
        search: '/foo/bar?someparam=something_we_dont_want&x-ms-routing-name=true',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should redirect with window.location to given URL and include x-ms-routing-name when present.', async () => {
    redirectTo('/big/buffalo');

    expect(window.location.assign).toHaveBeenCalledWith('/big/buffalo?x-ms-routing-name=true');
  });

  test('should navigate to given URL and include x-ms-routing-name when useCamsNavigator is used.', async () => {
    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);
    render(
      <BrowserRouter>
        <MyComponent></MyComponent>
      </BrowserRouter>,
    );

    expect(navigateMock).toHaveBeenCalledWith('/small/mouse?x-ms-routing-name=true');
  });
});
