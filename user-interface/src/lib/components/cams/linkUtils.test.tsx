import LinkUtils from './linkUtils';
import { render } from '@testing-library/react';

describe('Test link utilities', () => {
  test('executeLinkClick should execute onClick on the given link', async () => {
    const testFunction = vi.fn();
    render(
      <a href="/" onClick={testFunction}>
        {' '}
      </a>,
    );

    const link = document.querySelector('a') as HTMLAnchorElement;
    if (link) {
      LinkUtils.executeLinkClick(link);
      expect(testFunction).toHaveBeenCalledTimes(1);
    } else {
      throw new Error('Link element not found');
    }
  });
});
