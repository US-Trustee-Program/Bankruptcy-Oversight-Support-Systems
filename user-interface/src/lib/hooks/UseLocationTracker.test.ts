import testingUtilities from '../testing/testing-utilities';
import { isValidPath } from './UseLocationTracker';
import useLocationTracker from './UseLocationTracker';

describe('isValidPath utility tests', () => {
  test('should determine that a path is valid', () => {
    expect(isValidPath('/f00')).toBe(true);
    expect(isValidPath('/foo/bar')).toBe(true);
    expect(isValidPath('/foo/bar/baz?query=something.or:something&also=this,or,that')).toBe(true);
    expect(isValidPath('/_f00')).toBe(true);
  });

  test('should determine that a path is invalid', () => {
    expect(isValidPath('/')).toBe(false);
    expect(isValidPath('foobar')).toBe(false);
    expect(isValidPath('//foobar')).toBe(false);
    expect(isValidPath('0foo')).toBe(false);
    expect(isValidPath('/0foo')).toBe(false);
  });
});

describe('useLocationTracker tests', () => {
  test('should update local storage on call to updateLocation and return the new values when referencing previousLocation and homeTab', () => {
    vi.mock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useLocation: () => ({
        pathname: '/test/path',
      }),
    }));
    testingUtilities.spyOnUseState();

    const { previousLocation, homeTab } = useLocationTracker();

    expect(previousLocation).toEqual('/my-cases');
    expect(homeTab).toEqual('');

    window.name = 'foobar';

    expect(homeTab).toEqual('');

    window.name = 'CAMS_WINDOW_012';

    expect(homeTab).toEqual('');
  });
});
