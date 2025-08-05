import { render, screen } from '@testing-library/react';
import Tag, { UswdsTagStyle, TAG_BASE_CLASS } from './Tag';

describe('Tag', () => {
  test('should render basic tag with default props', () => {
    render(<Tag>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent('Test Tag');
    expect(tag.tagName).toBe('SPAN');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveAttribute('tabIndex', '0');
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
    expect(id).toMatch(/^tag-id-\d+$/);
  });

  test('should apply UswdsTagStyle.Default correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Default}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    // Default style is empty string, so no additional class should be added
    expect(tag.className).toBe(`${TAG_BASE_CLASS} ${TAG_BASE_CLASS}`);
  });

  test('should apply UswdsTagStyle.Unstyled correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Unstyled}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--unstyled');
  });

  test('should apply UswdsTagStyle.Secondary correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Secondary}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--secondary');
  });

  test('should apply UswdsTagStyle.Cool correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Cool}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--accent-cool');
  });

  test('should apply UswdsTagStyle.Warm correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Warm}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--accent-warm');
  });

  test('should apply UswdsTagStyle.Base correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Base}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--base');
  });

  test('should apply UswdsTagStyle.Outline correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Outline}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--outline');
  });

  test('should apply UswdsTagStyle.Inverse correctly', () => {
    render(<Tag uswdsStyle={UswdsTagStyle.Inverse}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--outline');
    expect(tag).toHaveClass('usa-button--inverse');
  });

  test('should apply big size correctly', () => {
    render(<Tag size="big">Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-tag--big');
  });

  test('should not apply big class for default size', () => {
    render(<Tag size="default">Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).not.toHaveClass('usa-tag--big');
  });

  test('should apply custom className in addition to base classes', () => {
    render(<Tag className="custom-class">Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('custom-class');
  });

  test('should combine all classes correctly', () => {
    render(
      <Tag uswdsStyle={UswdsTagStyle.Cool} size="big" className="custom-class">
        Test Tag
      </Tag>,
    );

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--accent-cool');
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('custom-class');
  });

  test('should apply title attribute when provided', () => {
    render(<Tag title="Custom Title">Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveAttribute('title', 'Custom Title');
  });

  test('should apply custom tabIndex when provided', () => {
    render(<Tag tabIndex={-1}>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveAttribute('tabIndex', '-1');
  });

  test('should apply tabIndex 0 by default when not provided', () => {
    render(<Tag>Test Tag</Tag>);

    const tag = screen.getByTestId('tag-test');
    expect(tag).toHaveAttribute('tabIndex', '0');
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

  test('should handle complex styling combinations with inverse style', () => {
    render(
      <Tag
        id="complex-tag"
        uswdsStyle={UswdsTagStyle.Inverse}
        size="big"
        className="extra-custom-class another-class"
        title="Complex Tag"
        tabIndex={0}
      >
        Complex Content
      </Tag>,
    );

    const tag = screen.getByTestId('tag-complex-tag');
    expect(tag).toHaveAttribute('id', 'complex-tag');
    expect(tag).toHaveClass(TAG_BASE_CLASS);
    expect(tag).toHaveClass('usa-button--outline');
    expect(tag).toHaveClass('usa-button--inverse');
    expect(tag).toHaveClass('usa-tag--big');
    expect(tag).toHaveClass('extra-custom-class');
    expect(tag).toHaveClass('another-class');
    expect(tag).toHaveAttribute('title', 'Complex Tag');
    expect(tag).toHaveAttribute('tabIndex', '0');
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

    expect(id1).toMatch(/^tag-id-\d+$/);
    expect(id2).toMatch(/^tag-id-\d+$/);
    expect(id1).not.toBe(id2);
  });
});
