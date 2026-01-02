import { render, screen } from '@testing-library/react';
import { describe, test } from 'vitest';
import { Card, CardHeading, CardBody, CardFooter } from './Card';

describe('Card', () => {
  test('should render basic card structure with proper content', () => {
    render(
      <Card>
        <CardBody>Basic content</CardBody>
      </Card>,
    );

    expect(screen.getByText('Basic content')).toBeInTheDocument();
    expect(document.querySelector('.usa-card')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__container')).toBeInTheDocument();
  });

  test('should render card with heading only', () => {
    render(
      <Card>
        <CardHeading>Test Heading</CardHeading>
      </Card>,
    );

    expect(screen.getByText('Test Heading')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__header')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__heading')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__body')).not.toBeInTheDocument();
    expect(document.querySelector('.usa-card__footer')).not.toBeInTheDocument();
  });

  test('should render card with body only', () => {
    render(
      <Card>
        <CardBody>Test Body Content</CardBody>
      </Card>,
    );

    expect(screen.getByText('Test Body Content')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__body')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__header')).not.toBeInTheDocument();
    expect(document.querySelector('.usa-card__footer')).not.toBeInTheDocument();
  });

  test('should render card with footer only', () => {
    render(
      <Card>
        <CardFooter>Test Footer Content</CardFooter>
      </Card>,
    );

    expect(screen.getByText('Test Footer Content')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__footer')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__header')).not.toBeInTheDocument();
    expect(document.querySelector('.usa-card__body')).not.toBeInTheDocument();
  });

  test('should render complete card with heading, body, and footer', () => {
    render(
      <Card>
        <CardHeading>Card Title</CardHeading>
        <CardBody>
          <p>This is the card body content.</p>
        </CardBody>
        <CardFooter>
          <button>Action Button</button>
        </CardFooter>
      </Card>,
    );

    // Check all sections are rendered
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('This is the card body content.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();

    // Check CSS classes are applied
    expect(document.querySelector('.usa-card__header')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__body')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__footer')).toBeInTheDocument();
  });

  test('should handle multiple children of the same type (last one wins)', () => {
    render(
      <Card>
        <CardHeading>First Heading</CardHeading>
        <CardHeading>Second Heading</CardHeading>
        <CardBody>Body Content</CardBody>
      </Card>,
    );

    // Should only render the last heading (Second Heading)
    expect(screen.queryByText('First Heading')).not.toBeInTheDocument();
    expect(screen.getByText('Second Heading')).toBeInTheDocument();
    expect(screen.getByText('Body Content')).toBeInTheDocument();
  });

  test('should ignore non-Card component children', () => {
    render(
      <Card>
        <CardHeading>Valid Heading</CardHeading>
        <div>This should be ignored</div>
        <CardBody>Valid Body</CardBody>
        <span>This should also be ignored</span>
      </Card>,
    );

    expect(screen.getByText('Valid Heading')).toBeInTheDocument();
    expect(screen.getByText('Valid Body')).toBeInTheDocument();
    expect(screen.queryByText('This should be ignored')).not.toBeInTheDocument();
    expect(screen.queryByText('This should also be ignored')).not.toBeInTheDocument();
  });

  test('should handle empty card', () => {
    render(<Card>{null}</Card>);

    expect(document.querySelector('.usa-card')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__container')).toBeInTheDocument();
    expect(document.querySelector('.usa-card__header')).not.toBeInTheDocument();
    expect(document.querySelector('.usa-card__body')).not.toBeInTheDocument();
    expect(document.querySelector('.usa-card__footer')).not.toBeInTheDocument();
  });

  test('should handle null and undefined children', () => {
    render(
      <Card>
        {null}
        <CardHeading>Valid Heading</CardHeading>
        {undefined}
        <CardBody>Valid Body</CardBody>
        {false}
      </Card>,
    );

    expect(screen.getByText('Valid Heading')).toBeInTheDocument();
    expect(screen.getByText('Valid Body')).toBeInTheDocument();
  });

  test('should ignore raw text content (only structured content is rendered)', () => {
    render(
      <Card>
        <CardHeading>Heading</CardHeading>
        Some text content
        <CardBody>Body content</CardBody>
      </Card>,
    );

    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    // Text content should be ignored since it's not a valid React element with proper Card type
    expect(screen.queryByText('Some text content')).not.toBeInTheDocument();
  });

  test('should use default h4 heading when no headingLevel is specified', () => {
    render(
      <Card>
        <CardHeading>Default Heading</CardHeading>
      </Card>,
    );

    const heading = screen.getByText('Default Heading');
    expect(heading.tagName.toLowerCase()).toBe('h4');
    expect(heading).toHaveClass('usa-card__heading');
  });

  test('should render h1 when headingLevel is h1', () => {
    render(
      <Card headingLevel="h1">
        <CardHeading>H1 Heading</CardHeading>
      </Card>,
    );

    const heading = screen.getByText('H1 Heading');
    expect(heading.tagName.toLowerCase()).toBe('h1');
    expect(heading).toHaveClass('usa-card__heading');
  });

  test('should render h2 when headingLevel is h2', () => {
    render(
      <Card headingLevel="h2">
        <CardHeading>H2 Heading</CardHeading>
      </Card>,
    );

    const heading = screen.getByText('H2 Heading');
    expect(heading.tagName.toLowerCase()).toBe('h2');
    expect(heading).toHaveClass('usa-card__heading');
  });

  test('should render h3 when headingLevel is h3', () => {
    render(
      <Card headingLevel="h3">
        <CardHeading>H3 Heading</CardHeading>
      </Card>,
    );

    const heading = screen.getByText('H3 Heading');
    expect(heading.tagName.toLowerCase()).toBe('h3');
    expect(heading).toHaveClass('usa-card__heading');
  });

  test('should render h5 when headingLevel is h5', () => {
    render(
      <Card headingLevel="h5">
        <CardHeading>H5 Heading</CardHeading>
      </Card>,
    );

    const heading = screen.getByText('H5 Heading');
    expect(heading.tagName.toLowerCase()).toBe('h5');
    expect(heading).toHaveClass('usa-card__heading');
  });

  test('should render h6 when headingLevel is h6', () => {
    render(
      <Card headingLevel="h6">
        <CardHeading>H6 Heading</CardHeading>
      </Card>,
    );

    const heading = screen.getByText('H6 Heading');
    expect(heading.tagName.toLowerCase()).toBe('h6');
    expect(heading).toHaveClass('usa-card__heading');
  });

  test('should pass through additional props to the card div', () => {
    render(
      <Card data-testid="custom-card" aria-label="Custom card">
        <CardHeading>Test Heading</CardHeading>
      </Card>,
    );

    const cardElement = screen.getByTestId('custom-card');
    expect(cardElement).toHaveClass('usa-card');
    expect(cardElement).toHaveAttribute('aria-label', 'Custom card');
  });

  test('should not render heading element when no CardHeading is provided', () => {
    render(
      <Card headingLevel="h1">
        <CardBody>Just body content</CardBody>
      </Card>,
    );

    expect(document.querySelector('h1')).not.toBeInTheDocument();
    expect(document.querySelector('.usa-card__header')).not.toBeInTheDocument();
  });

  describe('Accessibility (WCAG 2.1)', () => {
    test('should add aria-labelledby when heading is present', () => {
      render(
        <Card>
          <CardHeading>Accessible Heading</CardHeading>
          <CardBody>Content</CardBody>
        </Card>,
      );

      const section = document.querySelector('.usa-card');
      const heading = screen.getByText('Accessible Heading');

      expect(section).toHaveAttribute('aria-labelledby');
      expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
    });

    test('should NOT add aria-labelledby when heading is absent', () => {
      render(
        <Card>
          <CardBody>Just body content</CardBody>
        </Card>,
      );

      const section = document.querySelector('.usa-card');
      expect(section).not.toHaveAttribute('aria-labelledby');
    });

    test('should generate unique heading ID with -heading suffix', () => {
      render(
        <Card>
          <CardHeading>Test Heading</CardHeading>
        </Card>,
      );

      const heading = screen.getByText('Test Heading');
      expect(heading.id).toMatch(/-heading$/);
    });

    test('should use custom id prop for section and append -heading for heading ID', () => {
      render(
        <Card id="custom-card-id">
          <CardHeading>Custom ID Test</CardHeading>
        </Card>,
      );

      const section = document.querySelector('.usa-card');
      const heading = screen.getByText('Custom ID Test');

      expect(section).toHaveAttribute('id', 'custom-card-id');
      expect(heading).toHaveAttribute('id', 'custom-card-id-heading');
      expect(section).toHaveAttribute('aria-labelledby', 'custom-card-id-heading');
    });

    test('should ensure no duplicate IDs between section and heading', () => {
      render(
        <Card id="my-card">
          <CardHeading>Heading Text</CardHeading>
        </Card>,
      );

      const section = document.querySelector('.usa-card');
      const heading = screen.getByText('Heading Text');

      expect(section?.id).toBe('my-card');
      expect(heading.id).toBe('my-card-heading');
      expect(section?.id).not.toBe(heading.id);
    });

    test('should maintain unique IDs across multiple cards without custom id', () => {
      render(
        <>
          <Card>
            <CardHeading>First Card</CardHeading>
          </Card>
          <Card>
            <CardHeading>Second Card</CardHeading>
          </Card>
        </>,
      );

      const firstHeading = screen.getByText('First Card');
      const secondHeading = screen.getByText('Second Card');

      expect(firstHeading.id).not.toBe(secondHeading.id);
      expect(firstHeading.id).toBeTruthy();
      expect(secondHeading.id).toBeTruthy();
    });
  });
});

describe('CardHeading', () => {
  test('should render children as fragment', () => {
    render(<CardHeading>Test Heading Text</CardHeading>);
    expect(screen.getByText('Test Heading Text')).toBeInTheDocument();
  });
});

describe('CardBody', () => {
  test('should render children as fragment', () => {
    render(<CardBody>Test Body Text</CardBody>);
    expect(screen.getByText('Test Body Text')).toBeInTheDocument();
  });
});

describe('CardFooter', () => {
  test('should render children as fragment', () => {
    render(<CardFooter>Test Footer Text</CardFooter>);
    expect(screen.getByText('Test Footer Text')).toBeInTheDocument();
  });
});
