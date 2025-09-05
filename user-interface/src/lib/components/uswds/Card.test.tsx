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
