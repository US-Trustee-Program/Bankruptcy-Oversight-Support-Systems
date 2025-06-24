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

  describe('XSS Protection Tests', () => {
    test('should strip script tags', () => {
      const maliciousHtml = '<p>Safe content</p><script>alert("XSS")</script>';
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const divElement = document.querySelector('div');
      expect(divElement).toBeInTheDocument();
      expect(screen.getByText('Safe content')).toBeInTheDocument();

      // Script tag should be completely removed
      expect(divElement?.innerHTML).not.toContain('<script');
      expect(divElement?.innerHTML).not.toContain('alert');
    });

    test('should strip event handlers from allowed tags', () => {
      const maliciousHtml = '<p onclick="alert(\'XSS\')">Click me</p>';
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const divElement = document.querySelector('div');
      const paragraph = screen.getByText('Click me');

      expect(paragraph).toBeInTheDocument();
      expect(paragraph).not.toHaveAttribute('onclick');
      expect(divElement?.innerHTML).not.toContain('onclick');
      expect(divElement?.innerHTML).not.toContain('alert');
    });

    test('should strip multiple event handlers', () => {
      const maliciousHtml = `
        <span onload="malicious()" onmouseover="attack()" onfocus="xss()">
          Hover me
        </span>
      `;
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const spanElement = screen.getByText('Hover me');
      expect(spanElement).toBeInTheDocument();
      expect(spanElement).not.toHaveAttribute('onload');
      expect(spanElement).not.toHaveAttribute('onmouseover');
      expect(spanElement).not.toHaveAttribute('onfocus');
    });

    test('should strip javascript: URLs from links', () => {
      const maliciousHtml = '<a href="javascript:alert(\'XSS\')">Malicious Link</a>';
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const linkElement = screen.getByText('Malicious Link');
      expect(linkElement).toBeInTheDocument();
      expect(linkElement).not.toHaveAttribute('href', "javascript:alert('XSS')");

      // The href should either be removed or sanitized
      const href = linkElement.getAttribute('href');
      if (href !== null) {
        expect(href).not.toContain('javascript:');
      }
      // If href is null, that's also acceptable as it means the dangerous URL was stripped
    });

    test('should strip forbidden tags like iframe', () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <iframe src="javascript:alert('XSS')"></iframe>
      `;
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const divElement = document.querySelector('div');
      expect(screen.getByText('Safe content')).toBeInTheDocument();
      expect(divElement?.innerHTML).not.toContain('<iframe');
      expect(divElement?.innerHTML).not.toContain('javascript:');
    });

    test('should strip style tags with malicious CSS', () => {
      const maliciousHtml = `
        <p>Content</p>
        <style>
          body { background: url("javascript:alert('XSS')"); }
        </style>
      `;
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const divElement = document.querySelector('div');
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(divElement?.innerHTML).not.toContain('<style');
      expect(divElement?.innerHTML).not.toContain('javascript:');
    });

    test('should strip object and embed tags', () => {
      const maliciousHtml = `
        <p>Content</p>
        <object data="malicious.swf"></object>
        <embed src="malicious.swf">
      `;
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const divElement = document.querySelector('div');
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(divElement?.innerHTML).not.toContain('<object');
      expect(divElement?.innerHTML).not.toContain('<embed');
    });

    test('should strip form elements', () => {
      const maliciousHtml = `
        <p>Content</p>
        <form action="malicious-endpoint">
          <input type="text" name="data">
          <button onclick="steal()">Submit</button>
        </form>
      `;
      render(<PrerenderedHtml htmlString={maliciousHtml} />);

      const divElement = document.querySelector('div');
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(divElement?.innerHTML).not.toContain('<form');
      expect(divElement?.innerHTML).not.toContain('<input');
      expect(divElement?.innerHTML).not.toContain('<button');
    });

    test('should allow safe attributes while stripping dangerous ones', () => {
      const htmlWithMixedAttributes = `
        <a href="https://example.com" class="safe-class" onclick="malicious()">
          Safe Link
        </a>
        <span class="another-class" onmouseover="attack()">Safe Span</span>
      `;
      render(<PrerenderedHtml htmlString={htmlWithMixedAttributes} />);

      const linkElement = screen.getByText('Safe Link');
      const spanElement = screen.getByText('Safe Span');

      // Should keep safe attributes
      expect(linkElement).toHaveAttribute('href', 'https://example.com');
      expect(linkElement).toHaveAttribute('class', 'safe-class');
      expect(spanElement).toHaveAttribute('class', 'another-class');

      // Should strip dangerous attributes
      expect(linkElement).not.toHaveAttribute('onclick');
      expect(spanElement).not.toHaveAttribute('onmouseover');
    });

    test('should handle complex XSS attack vectors', () => {
      const complexMaliciousHtml = `
        <p>Safe paragraph</p>
        <img src="x" onerror="alert('XSS')" />
        <div onclick="malicious()" style="background: url('javascript:alert(1)')">
          <script>document.cookie = 'stolen';</script>
          Click me
        </div>
        <svg><script>alert('SVG XSS')</script></svg>
      `;
      render(<PrerenderedHtml htmlString={complexMaliciousHtml} />);

      const divElement = document.querySelector('div');
      expect(screen.getByText('Safe paragraph')).toBeInTheDocument();

      // All malicious content should be stripped
      expect(divElement?.innerHTML).not.toContain('onerror');
      expect(divElement?.innerHTML).not.toContain('onclick');
      expect(divElement?.innerHTML).not.toContain('style=');
      expect(divElement?.innerHTML).not.toContain('<script');
      expect(divElement?.innerHTML).not.toContain('<svg');
      expect(divElement?.innerHTML).not.toContain('<img');
      expect(divElement?.innerHTML).not.toContain('alert');
      expect(divElement?.innerHTML).not.toContain('javascript:');
      expect(divElement?.innerHTML).not.toContain('document.cookie');
    });
  });
});
