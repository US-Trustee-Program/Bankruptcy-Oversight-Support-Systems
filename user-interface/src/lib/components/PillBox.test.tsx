import { fireEvent, render } from '@testing-library/react';
import PillBox, { PillBoxRef } from './PillBox';
import { ComboOption } from './combobox/ComboBox';
import React from 'react';

describe('Tests for Pill Box', () => {
  let testSelections: ComboOption[] = [];
  beforeEach(() => {
    testSelections = [
      {
        label: 'pill 0',
        value: 'p0',
        selected: false,
        hidden: false,
      },
      {
        label: 'pill 1',
        value: 'p1',
        selected: false,
        hidden: false,
      },
      {
        label: 'pill 2',
        value: 'p2',
        selected: false,
        hidden: false,
      },
    ];
  });

  test('Should return true if using ref.contains() and Pill Box contains the given DOM element', async () => {
    const selectionChange = vi.fn((_foo: ComboOption[]) => {});
    const pillBoxRef = React.createRef<PillBoxRef>();

    render(
      <PillBox
        id={'test-pillbox'}
        selections={testSelections}
        onSelectionChange={selectionChange}
        ref={pillBoxRef}
      ></PillBox>,
    );

    const pill = document.querySelector('#pill-test-pillbox-1 svg');

    expect(pill).toBeInTheDocument();

    const isContained = pillBoxRef.current?.contains(pill as HTMLElement);

    expect(isContained).toBe(true);
  });

  test('Should disable pills when disabled property is set', async () => {
    render(
      <PillBox
        id={'test-pillbox'}
        selections={testSelections}
        onSelectionChange={() => {}}
        disabled={true}
      ></PillBox>,
    );

    const buttons = document.querySelectorAll('button');
    buttons.forEach((button) => {
      expect(button.disabled).toBeTruthy();
    });
  });

  test('Should set aria labels properly on pills', async () => {
    render(
      <PillBox
        id={'test-pillbox'}
        selections={testSelections}
        onSelectionChange={() => {}}
        ariaLabelPrefix="test-prefix"
      ></PillBox>,
    );

    const buttons = document.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
      expect(buttons[i]).toHaveAttribute(
        'aria-label',
        `test-prefix - ${testSelections[i].label} is currently selected.`,
      );
    }
  });

  test('Should focus on previous pill if last pill is deleted', async () => {
    const selectionChange = vi.fn((_foo: ComboOption[]) => {});
    const resultSelections = [
      {
        label: 'pill 0',
        value: 'p0',
        selected: false,
        hidden: false,
      },
      {
        label: 'pill 1',
        value: 'p1',
        selected: false,
        hidden: false,
      },
    ];

    render(
      <PillBox
        id={'test-pillbox'}
        selections={testSelections}
        onSelectionChange={selectionChange}
      ></PillBox>,
    );

    const pill1 = document.querySelector('#pill-test-pillbox-1');
    const pill2 = document.querySelector('#pill-test-pillbox-2');

    expect(pill1).toBeInTheDocument();
    expect(pill2).toBeInTheDocument();

    fireEvent.click(pill2 as HTMLElement);
    expect(pill1).toHaveFocus();
    expect(selectionChange).toHaveBeenCalledWith(resultSelections);
  });

  test('Should focus on next pill if previous pill is deleted', async () => {
    let selections = [...testSelections];
    const selectionChange = vi.fn((newSelections: ComboOption[]) => {
      selections = [...newSelections];
    });

    render(
      <PillBox
        id={'test-pillbox'}
        selections={selections}
        onSelectionChange={selectionChange}
      ></PillBox>,
    );

    const pill0 = document.querySelector('#pill-test-pillbox-0');
    let pill1 = document.querySelector('#pill-test-pillbox-1');
    let pill2 = document.querySelector('#pill-test-pillbox-2');

    expect(pill0).toBeInTheDocument();
    expect(pill1).toBeInTheDocument();
    expect(pill2).toBeInTheDocument();

    fireEvent.click(pill0 as HTMLElement);

    await vi.waitFor(() => {
      expect(selectionChange).toHaveBeenCalledWith([
        {
          label: 'pill 1',
          value: 'p1',
          selected: false,
          hidden: false,
        },
        {
          label: 'pill 2',
          value: 'p2',
          selected: false,
          hidden: false,
        },
      ]);

      expect(selections.length).toBe(2);
    });

    await vi.waitFor(() => {
      pill1 = document.querySelector('#pill-test-pillbox-0');
      pill2 = document.querySelector('#pill-test-pillbox-1');

      expect(pill1).toHaveFocus();

      expect(pill1).toHaveTextContent('pill 1');
      expect(pill2).toHaveTextContent('pill 2');
    });

    fireEvent.click(pill1 as HTMLElement);

    await vi.waitFor(() => {
      pill2 = document.querySelector('#pill-test-pillbox-0');
      expect(pill2).toHaveFocus();
      expect(selectionChange).toHaveBeenCalledWith([
        {
          label: 'pill 2',
          value: 'p2',
          selected: false,
          hidden: false,
        },
      ]);
      expect(pill2).toHaveTextContent('pill 2');
    });
  });
});
