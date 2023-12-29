import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Checkbox from './Checkbox';

describe('Test Checkbox component', async () => {
  test('Should call onChange handler when check box is clicked', async () => {
    const checkboxOnClick = vi.fn();
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Checkbox
            id={'checkbox123'}
            value={'checkbox toggle'}
            checked={false}
            onChange={checkboxOnClick}
          ></Checkbox>
        </BrowserRouter>
      </React.StrictMode>,
    );

    const checkbox = screen.getByTestId('checkbox-checkbox123');
    fireEvent.click(checkbox);
    expect(checkboxOnClick).toHaveBeenCalled();
  });
});
