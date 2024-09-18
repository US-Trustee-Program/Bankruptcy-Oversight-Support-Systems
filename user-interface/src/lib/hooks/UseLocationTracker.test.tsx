import { vi, Mock } from 'vitest';
import { render } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { isValidPath } from './UseLocationTracker';
import TestComponent from './UseLocationTracker.mock';

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

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: vi.fn(),
}));

describe('useLocationTracker tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.name = '';
    localStorage.setItem('homeTab', '');
    localStorage.setItem('previousLocation', '');
  });

  test('should return expected default previousLocation and homeTab values when no window.name is set and no previous URL is set', () => {
    render(<TestComponent />);

    const link = document.querySelector('.back-button');

    expect(link).toHaveAttribute('data-href', '/my-cases');
    expect(link).toHaveAttribute('data-target', '_self');
  });

  test('should return expected default previousLocation and homeTab values when window.name is set to an invalid name and no previous URL is set', () => {
    const newTarget = 'foobar';
    window.name = newTarget;

    render(<TestComponent target={newTarget} />);

    const link = document.querySelector('.back-button');

    expect(link).toHaveAttribute('data-href', '/my-cases');
    expect(link).toHaveAttribute('data-target', '');
  });

  test('should return expected default previousLocation and homeTab values when an invalid path is supplied is set to an invalid name and no previous URL is set', () => {
    const path = 'foobar';
    (useLocation as Mock).mockReturnValue({ pathname: undefined });

    render(<TestComponent location={path} />);

    const link = document.querySelector('.back-button');

    expect(link).toHaveAttribute('data-href', '/my-cases');
    expect(link).toHaveAttribute('data-target', '');
  });

  test('should reset previousLocation and homeTab to values from localStorage after forced refresh of browser tab', () => {
    const path = '/foobar';
    const target = 'CAMS_WINDOW_012';
    window.name = target;
    (useLocation as Mock).mockReturnValue({ pathname: undefined });

    render(<TestComponent location={path} target={target} />);

    let link = document.querySelector('.back-button');

    expect(link).toHaveAttribute('data-href', path);
    expect(link).toHaveAttribute('data-target', target);

    render(<TestComponent />);

    link = document.querySelector('.back-button');

    expect(link).toHaveAttribute('data-href', path);
    expect(link).toHaveAttribute('data-target', target);
  });

  test('should return expected given previousLocation and homeTab values when a valid path was previously visited', () => {
    (useLocation as Mock).mockReturnValue({ pathname: '/some/valid/path' });

    render(<TestComponent updateLocation={true} />);

    const link = document.querySelector('.back-button');

    expect(link).toHaveAttribute('data-href', '/some/valid/path');
    expect(link).toHaveAttribute('data-target', '');
  });

  test('should call updateLocation and return given previousLocation and homeTab values when window.name is set to a valid name and previous URL is supplied to useLocationTracker', () => {
    const path = '/supplied/path';
    const newTarget = 'CAMS_WINDOW_012';
    window.name = newTarget;

    render(<TestComponent location={path} />);

    const link = document.querySelector('.back-button');

    expect(link).toHaveAttribute('data-href', path);
    expect(link).toHaveAttribute('data-target', newTarget);
  });
});
