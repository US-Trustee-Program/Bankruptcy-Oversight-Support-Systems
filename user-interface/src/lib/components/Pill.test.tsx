import { fireEvent, render, screen } from '@testing-library/react';
import { Pill } from './Pill';

describe('Test pill', () => {
  test('should call onclick event when pill is clicked', async () => {
    const clickFn = vi.fn((_value: string) => {});

    render(<Pill id="test" label={'Test pill'} value={'test-value'} onClick={clickFn}></Pill>);

    const pill = screen.getByTestId('pill-test');
    fireEvent.click(pill);

    expect(clickFn).toHaveBeenCalledWith('test-value');
  });

  test('should call onclick event when Enter or Space key is typed', async () => {
    const clickFn = vi.fn((_value: string) => {});

    render(<Pill id="test" label={'Test pill'} value={'test-value'} onClick={clickFn}></Pill>);

    const pill = screen.getByTestId('pill-test');
    fireEvent.keyDown(pill, { key: 'Enter' });

    expect(clickFn).toHaveBeenCalledWith('test-value');

    fireEvent.keyDown(pill, { key: ' ' });

    expect(clickFn).toHaveBeenCalledWith('test-value');
  });
});
