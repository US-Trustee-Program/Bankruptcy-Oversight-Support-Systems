import { render } from '@testing-library/react';
import Abbreviation from './Abbreviation';

test('renders visible text exactly as TIR with no spacing', () => {
  const { container } = render(<Abbreviation>TIR</Abbreviation>);
  // The visible span should show "TIR" exactly
  const visibleSpan = container.querySelector('[aria-hidden="true"]');
  expect(visibleSpan).toBeInTheDocument();
  expect(visibleSpan).toHaveTextContent('TIR');
  // Verify visible text appears first in DOM order (followed by screen reader text)
  expect(container.textContent).toMatch(/^TIRT I R$/);
});

test('provides spelled-out form in screen-reader-only text', () => {
  const { container } = render(<Abbreviation>TIR</Abbreviation>);
  const srOnlySpan = container.querySelector('.usa-sr-only');
  expect(srOnlySpan).toBeInTheDocument();
  expect(srOnlySpan).toHaveTextContent('T I R');
});

test('preserves visible appearance when used inline with surrounding text', () => {
  const { container } = render(
    <span>
      Last <Abbreviation>TIR</Abbreviation> Letter
    </span>,
  );
  // Visible text should be "Last TIR Letter" with screen reader text "T I R" inserted
  expect(container.textContent).toContain('Last TIR');
  expect(container.textContent).toContain('Letter');
});
