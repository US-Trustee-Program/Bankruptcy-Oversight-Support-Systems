import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import { CaseAssignment } from '../CaseAssignment';

describe('Region and Office tests', () => {
  test('Case Assignment should display Region and Office of the AUST who logs in', async () => {
    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseAssignment />
        </Provider>
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const subtitle = await screen.getByTestId('case-list-subtitle');
        expect(subtitle.textContent).toBe('Region 2 (Manhattan Office)');
      },
      { timeout: 3000 },
    );
  });
});
