import { render } from '@testing-library/react';
import Home from './Home';

describe('Home', () => {
  test('should redirect to my-cases', () => {
    const priorLocation = window.location;
    window.location = { assign: vi.fn() } as unknown as Location;
    render(<Home></Home>);
    expect(window.location.assign).toHaveBeenCalledWith('/my-cases');
    window.location = priorLocation;
  });
});
