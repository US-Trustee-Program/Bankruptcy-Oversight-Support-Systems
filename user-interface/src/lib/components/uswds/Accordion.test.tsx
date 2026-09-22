import React from 'react';
import { Accordion, AccordionGroup } from './Accordion';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

describe('Accordion tests', () => {
  test('Should expand accordion when clicking on expand button and collapse when clicking again and when accordion is used without an accordion group', async () => {
    const accordionId = 'accordion1';
    render(
      <React.StrictMode>
        <Accordion id={accordionId}>
          <span>Title of accordion</span>
          <span>Content of accordion</span>
        </Accordion>
      </React.StrictMode>,
    );

    const content = screen.getByTestId(`accordion-content-${accordionId}`);
    const button = screen.getByTestId(`accordion-button-${accordionId}`);
    expect(button).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        expanded: false,
      }),
    ).toBeInTheDocument();
    expect(content).toBeInTheDocument();
    expect(content).not.toBeVisible();

    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          expanded: true,
        }),
      ).toBeInTheDocument();
      expect(content).toBeVisible();
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          expanded: false,
        }),
      ).toBeInTheDocument();
      expect(content).not.toBeVisible();
    });
  });

  test('Should call onExpand when opened and onCollapse when closed, never both on the same click', async () => {
    const accordionId = 'accordion1';
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    render(
      <React.StrictMode>
        <Accordion id={accordionId} onExpand={onExpand} onCollapse={onCollapse}>
          <span>Title of accordion</span>
          <span>Content of accordion</span>
        </Accordion>
      </React.StrictMode>,
    );

    const button = screen.getByTestId(`accordion-button-${accordionId}`);

    fireEvent.click(button);
    await waitFor(() => {
      expect(onExpand).toHaveBeenCalledWith(accordionId);
      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(onCollapse).not.toHaveBeenCalled();
    });

    fireEvent.click(button);
    await waitFor(() => {
      expect(onCollapse).toHaveBeenCalledWith(accordionId);
      expect(onCollapse).toHaveBeenCalledTimes(1);
      expect(onExpand).toHaveBeenCalledTimes(1);
    });
  });

  test('Should toggle standalone accordion instances independently when not grouped in an accordion group', async () => {
    const onExpandA = vi.fn();
    const onCollapseA = vi.fn();
    const onExpandB = vi.fn();

    render(
      <React.StrictMode>
        <Accordion id="standalone-a" onExpand={onExpandA} onCollapse={onCollapseA}>
          <span>Title A</span>
          <span>Content A</span>
        </Accordion>
        <Accordion id="standalone-b" onExpand={onExpandB}>
          <span>Title B</span>
          <span>Content B</span>
        </Accordion>
      </React.StrictMode>,
    );

    const buttonA = screen.getByTestId('accordion-button-standalone-a');
    const contentA = screen.getByTestId('accordion-content-standalone-a');
    const contentB = screen.getByTestId('accordion-content-standalone-b');

    expect(contentA).not.toBeVisible();
    expect(contentB).not.toBeVisible();

    fireEvent.click(buttonA);

    expect(contentA).toBeVisible();
    expect(onExpandA).toHaveBeenCalledWith('standalone-a');
    expect(onExpandB).not.toHaveBeenCalled();
    expect(contentB).not.toBeVisible();

    fireEvent.click(buttonA);

    expect(contentA).not.toBeVisible();
    expect(onCollapseA).toHaveBeenCalledWith('standalone-a');
  });

  test('Should hide heading and content regardless of expanded state when hidden is true', () => {
    render(
      <Accordion id="hidden-accordion" expandedId="hidden-accordion" hidden>
        <span>Title</span>
        <span>Content</span>
      </Accordion>,
    );

    const heading = screen.getByTestId('accordion-hidden-accordion');
    const content = screen.getByTestId('accordion-content-hidden-accordion');

    expect(heading).not.toBeVisible();
    expect(content).not.toBeVisible();

    fireEvent.click(screen.getByTestId('accordion-button-hidden-accordion'));

    expect(heading).not.toBeVisible();
    expect(content).not.toBeVisible();
  });

  test('AccordionGroup renders an empty container when given no children', () => {
    render(<AccordionGroup />);

    expect(screen.getByTestId('accordion-group')).toBeEmptyDOMElement();
  });

  test('AccordionGroup composes a child accordion onExpand with its own mutual-exclusion tracking', () => {
    const childOnExpand = vi.fn();

    render(
      <AccordionGroup>
        <Accordion id="composed-a" onExpand={childOnExpand}>
          <span>Title composed-a</span>
          <span>Content composed-a</span>
        </Accordion>
        <Accordion id="composed-b">
          <span>Title composed-b</span>
          <span>Content composed-b</span>
        </Accordion>
      </AccordionGroup>,
    );

    fireEvent.click(screen.getByTestId('accordion-button-composed-a'));

    expect(childOnExpand).toHaveBeenCalledWith('composed-a');
    expect(screen.getByTestId('accordion-content-composed-a')).toBeVisible();
  });

  test('Should expand accordions 1 at a time, such that 1 closes when another is opened, when grouped together in an accordion group', async () => {
    render(
      <React.StrictMode>
        <AccordionGroup>
          <Accordion id="a1">
            <span>Title of accordion a1</span>
            <span>Content of accordion a1</span>
          </Accordion>
          <Accordion id="a2">
            <span>Title of accordion a2</span>
            <span>Content of accordion a2</span>
          </Accordion>
          <Accordion id="a3">
            <span>Title of accordion a3</span>
            <span>Content of accordion a3</span>
          </Accordion>
          <Accordion id="a4">
            <span>Title of accordion a4</span>
            <span>Content of accordion a4</span>
          </Accordion>
        </AccordionGroup>
      </React.StrictMode>,
    );

    // it should be sufficient to test with 3 of the 4 accordions
    const contentA1 = screen.getByTestId(`accordion-content-a1`);
    const buttonA1 = screen.getByTestId(`accordion-button-a1`);
    const contentA2 = screen.getByTestId(`accordion-content-a2`);
    const buttonA2 = screen.getByTestId(`accordion-button-a2`);
    const contentA4 = screen.getByTestId(`accordion-content-a4`);
    const buttonA4 = screen.getByTestId(`accordion-button-a4`);

    expect(buttonA1).toBeInTheDocument();
    expect(buttonA2).toBeInTheDocument();
    expect(buttonA4).toBeInTheDocument();

    expect(contentA1).not.toBeVisible();
    expect(contentA2).not.toBeVisible();
    expect(contentA4).not.toBeVisible();

    fireEvent.click(buttonA2);

    expect(contentA1).not.toBeVisible();
    expect(contentA2).toBeVisible();
    expect(contentA4).not.toBeVisible();

    fireEvent.click(buttonA1);

    expect(contentA1).toBeVisible();
    expect(contentA2).not.toBeVisible();
    expect(contentA4).not.toBeVisible();

    fireEvent.click(buttonA4);

    expect(contentA1).not.toBeVisible();
    expect(contentA2).not.toBeVisible();
    expect(contentA4).toBeVisible();

    fireEvent.click(buttonA4);

    expect(contentA1).not.toBeVisible();
    expect(contentA2).not.toBeVisible();
    expect(contentA4).not.toBeVisible();
  });

  test('Should expand the accordion matching initialExpandedId on first render', () => {
    render(
      <React.StrictMode>
        <AccordionGroup initialExpandedId="a2">
          <Accordion id="a1">
            <span>Title of accordion a1</span>
            <span>Content of accordion a1</span>
          </Accordion>
          <Accordion id="a2">
            <span>Title of accordion a2</span>
            <span>Content of accordion a2</span>
          </Accordion>
        </AccordionGroup>
      </React.StrictMode>,
    );

    expect(screen.getByTestId('accordion-content-a1')).not.toBeVisible();
    expect(screen.getByTestId('accordion-content-a2')).toBeVisible();
  });

  test('Without initialExpandedId, no accordion is expanded by default (regression check)', () => {
    render(
      <React.StrictMode>
        <AccordionGroup>
          <Accordion id="a1">
            <span>Title of accordion a1</span>
            <span>Content of accordion a1</span>
          </Accordion>
        </AccordionGroup>
      </React.StrictMode>,
    );

    expect(screen.getByTestId('accordion-content-a1')).not.toBeVisible();
  });
});
