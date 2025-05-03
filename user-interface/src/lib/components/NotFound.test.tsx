import { render } from '@testing-library/react';

import NotFound from './NotFound';

test('should load Not Found 404 page', () => {
  render(<NotFound />);

  const notFound = document.querySelector('.not-found-404');
  expect(notFound).toBeInTheDocument();
  expect(notFound).toHaveTextContent('404 - Not Found');
});
