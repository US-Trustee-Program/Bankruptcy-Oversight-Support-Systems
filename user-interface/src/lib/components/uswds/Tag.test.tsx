import { render, screen } from '@testing-library/react';
import Tag, { UswdsTagStyle } from './Tag';

// Define constants for base classes
const TAG_BASE_CLASS = 'usa-tag';

describe('Tag', () => {
  test('should render basic tag with default props', () => {
    render(<Tag>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent('Test Tag');
    expect(tag.tagName).toBe('SPAN');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-tag--big');
  });

  test('should use custom id when provided', () => {
    render(<Tag id="custom-tag">Test Tag</Tag>);

    const tag = screen.getByTestId('tag-custom-tag');
    expect(tag).toHaveAttribute('id', 'custom-tag');
  });

  test('should generate random id when not provided', () => {
    render(<Tag>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    const id = tag.getAttribute('id');
    expect(id).toMatch(/^tag-id-.+$/);
  });

  test('should apply UswdsTagStyle.Default correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Default}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('bg-base');
  });

  test('should apply UswdsTagStyle.Cool correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Cool}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('bg-accent-cool');
  });

  test('should apply UswdsTagStyle.Primary correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Primary}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('bg-primary');
  });

  test('should always apply usa-tag--big class', () => {
    render(<Tag>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-tag--big');
  });

  test('should apply custom className in addition to base classes', () => {
    render(<Tag className="custom-class">Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('custom-class');
  });

  test('should combine all classes correctly', () => {
    render(
      <Tag uswdsStyle={UswdsTagStyle.Cool} className="custom-class">
        Test Tag
      </Tag>,
    );

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('bg-accent-cool');
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('custom-class');
  });

  test('should apply title attribute when provided', () => {
    render(<Tag title="Custom Title">Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveAttribute('title', 'Custom Title');
  });

  test('should pass through other HTML span props', () => {
    render(
      <Tag role="button" aria-label="Custom Label" data-custom="custom-value">
        Test Tag
      </Tag>,
    );

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveAttribute('role', 'button');
    expect(tag).toHaveAttribute('aria-label', 'Custom Label');
    expect(tag).toHaveAttribute('data-custom', 'custom-value');
  });

  test('should render children correctly', () => {
    render(
      <Tag>
        <span>Child Element</span>
        Text Content
      </Tag>,
    );

    const tag = screen.getByTestId('tag-test');
    expect(tag).toContainHTML('<span>Child Element</span>');
    expect(tag).toHaveTextContent('Child ElementText Content');
  });

  test('should handle empty children', () => {
    render(<Tag></Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toBeInTheDocument();
    expect(tag).toBeEmptyDOMElement();
  });

  test('should handle null/undefined children', () => {
    render(<Tag>{null}</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toBeInTheDocument();
    expect(tag).toBeEmptyDOMElement();
  });

  test('should handle complex styling combinations with primary style', () => {
    render(
      <Tag
        id="complex-tag"
        uswdsStyle={UswdsTagStyle.Primary}
        className="extra-custom-class another-class"
        title="Complex Tag"
      >
        Complex Content
      </Tag>,
    );

    const tag = screen.getByTestId('tag-complex-tag');
    expect(tag).toHaveAttribute('id', 'complex-tag');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('bg-primary');
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('extra-custom-class');
    expect(tag).toHaveClass('another-class');
    expect(tag).toHaveAttribute('title', 'Complex Tag');
    expect(tag).toHaveTextContent('Complex Content');
  });

  test('should generate different random IDs for multiple instances', () => {
    render(
      <div>
        <Tag>Tag 1</Tag>
        <Tag>Tag 2</Tag>
      </div>,
    );

    const tags = screen.getAllByTestId('tag-test');
    expect(tags).toHaveLength(2);

    const id1 = tags[0].getAttribute('id');
    const id2 = tags[1].getAttribute('id');

    expect(id1).toMatch(/^tag-id-.+$/);
    expect(id2).toMatch(/^tag-id-.+$/);
    expect(id1).not.toBe(id2);
  });
});
