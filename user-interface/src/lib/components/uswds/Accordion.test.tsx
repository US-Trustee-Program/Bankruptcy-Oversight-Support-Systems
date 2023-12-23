import React from 'react';
import { Accordion, AccordionGroup } from './Accordion';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
});
