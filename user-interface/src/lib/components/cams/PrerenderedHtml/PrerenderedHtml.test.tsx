import { render, screen } from '@testing-library/react';
import PrerenderedHtml from './PrerenderedHtml';

describe('Tests for PrerenderedHtml component', () => {
  test('should render HTML string correctly', () => {
    const htmlString = '<p>Test paragraph</p>';
    render(<PrerenderedHtml htmlString={htmlString} />);

    const divElement = document.querySelector('div');
    expect(divElement).toBeInTheDocument();
    expect(screen.getByText('Test paragraph')).toBeInTheDocument();
  });

  test('should handle empty HTML string', () => {
    render(<PrerenderedHtml htmlString="" />);

    const divElement = document.querySelector('div');
    expect(divElement).toBeInTheDocument();
    // When an empty string is provided, the div will still be rendered but with no content
    expect(divElement?.textContent).toBe('');
  });

  test('should handle HTML string with special characters', () => {
    const htmlString = '<p>Special &amp; characters: &lt; &gt; &quot;</p>';
    render(<PrerenderedHtml htmlString={htmlString} />);

    const divElement = document.querySelector('div');
    expect(divElement).toBeInTheDocument();
    expect(screen.getByText('Special & characters: < > "')).toBeInTheDocument();
  });

  test('should handle complex HTML structure', () => {
    const htmlString = `
      <div class="container">
        <h1>Title</h1>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    `;
    render(<PrerenderedHtml htmlString={htmlString} />);

    const divElement = document.querySelector('div');
    expect(divElement).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});
