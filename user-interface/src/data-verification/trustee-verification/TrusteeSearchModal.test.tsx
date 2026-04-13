import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteeSearchModal, { TrusteeSearchModalImperative } from './TrusteeSearchModal';
import Api2 from '@/lib/models/api2';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import { COURT_DIVISIONS } from '@common/cams/test-utilities/courts.mock';
import TestingUtilities from '@/lib/testing/testing-utilities';
import * as UseDebounceModule from '@/lib/hooks/UseDebounce';

const modalId = 'test-search';
const comboBoxId = `trustee-search-combobox-${modalId}`;
const districtComboBoxId = `trustee-district-combobox-${modalId}`;

const sampleResults: TrusteeSearchResult[] = [
  {
    trusteeId: 'trustee-001',
    name: 'John Smith',
    address: {
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
    phone: { number: '(212) 555-0100' },
    email: 'john.smith@example.com',
    appointments: [],
    matchType: 'exact',
  },
  {
    trusteeId: 'trustee-002',
    name: 'Jane Smithson',
    address: {
      address1: '456 Oak Ave',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      countryCode: 'US',
    },
    email: 'jane.smithson@example.com',
    appointments: [],
    matchType: 'phonetic',
  },
];

describe('TrusteeSearchModal', () => {
  const modalRef = React.createRef<TrusteeSearchModalImperative>();
  const userEvent = TestingUtilities.setupUserEvent();

  function renderWithProps(onConfirm = vi.fn(), onCancel = vi.fn()) {
    render(
      <BrowserRouter>
        <TrusteeSearchModal
          ref={modalRef}
          id={modalId}
          dxtrTrusteeName="DOE, JOHN"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </BrowserRouter>,
    );
    return { onConfirm, onCancel };
  }

  async function expandComboBoxAndType(text: string) {
    const expandButton = document.querySelector(`#${comboBoxId}-expand`);
    expect(expandButton).toBeInTheDocument();
    await userEvent.click(expandButton!);

    const inputField = document.querySelector(`#${comboBoxId}-combo-box-input`) as HTMLInputElement;
    expect(inputField).toBeInTheDocument();
    await userEvent.type(inputField, text);
    return inputField;
  }

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: COURT_DIVISIONS });
    vi.spyOn(UseDebounceModule, 'default').mockReturnValue(((cb: () => void) =>
      cb()) as unknown as ReturnType<typeof UseDebounceModule.default>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('modal is not visible before show() is called', () => {
    renderWithProps();
    const wrapper = document.querySelector(`#trustee-search-modal-${modalId}-wrapper`);
    expect(wrapper).toHaveClass('is-hidden');
  });

  test('shows heading after show() is called', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    await waitFor(() => {
      expect(document.querySelector('.usa-modal__heading')).toHaveTextContent('Search for Trustee');
    });
  });

  test('calls searchTrustees API when user types a name with 2+ characters', async () => {
    const searchSpy = vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: sampleResults });

    renderWithProps();
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('sm');

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('sm', undefined);
    });
  });

  test('passes courtId to searchTrustees API when provided', async () => {
    const searchSpy = vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: sampleResults });

    render(
      <BrowserRouter>
        <TrusteeSearchModal
          ref={modalRef}
          id={modalId}
          dxtrTrusteeName="DOE, JOHN"
          courtId="0208"
          onConfirm={vi.fn()}
        />
      </BrowserRouter>,
    );
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('sm');

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('sm', '0208');
    });
  });

  test('normalizes courtDivisionCode to courtId when searching', async () => {
    const searchSpy = vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: sampleResults });

    // courtDivisionCode '061' (Albany) maps to courtId '0206' in COURT_DIVISIONS
    render(
      <BrowserRouter>
        <TrusteeSearchModal
          ref={modalRef}
          id={modalId}
          dxtrTrusteeName="DOE, JOHN"
          courtId="061"
          onConfirm={vi.fn()}
        />
      </BrowserRouter>,
    );
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('sm');

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('sm', '0206');
    });
  });

  test('renders Trustee District dropdown', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    await waitFor(() => {
      const expandButton = document.querySelector(`#${districtComboBoxId}-expand`);
      expect(expandButton).toBeInTheDocument();
    });
  });

  test('pre-selects district matching the courtId prop', async () => {
    render(
      <BrowserRouter>
        <TrusteeSearchModal
          ref={modalRef}
          id={modalId}
          dxtrTrusteeName="DOE, JOHN"
          courtId="0208"
          onConfirm={vi.fn()}
        />
      </BrowserRouter>,
    );
    act(() => modalRef.current?.show());

    // The selection is reflected in the aria-description element (collapsed state)
    await waitFor(() => {
      const description = document.querySelector(`#${districtComboBoxId}-aria-description`);
      expect(description?.textContent).toContain('Southern District of New York');
    });
  });

  test('uses updated courtId from district dropdown for search', async () => {
    const searchSpy = vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: [] });

    renderWithProps();
    act(() => modalRef.current?.show());

    // Change district selection by clicking a court option
    const districtExpandButton = document.querySelector(`#${districtComboBoxId}-expand`);
    await userEvent.click(districtExpandButton!);
    const districtInput = document.querySelector(
      `#${districtComboBoxId}-combo-box-input`,
    ) as HTMLInputElement;
    await userEvent.type(districtInput, 'Alaska');
    await waitFor(() => {
      const firstOption = screen.getByTestId(`${districtComboBoxId}-option-item-0`);
      expect(firstOption).toBeVisible();
    });
    await userEvent.click(screen.getByTestId(`${districtComboBoxId}-option-item-0`));

    // Now search by name
    await expandComboBoxAndType('sm');

    await waitFor(() => {
      const courtId = COURT_DIVISIONS.find((c) => c.courtName === 'District of Alaska')?.courtId;
      expect(searchSpy).toHaveBeenCalledWith('sm', courtId);
    });
  });

  test('does not call searchTrustees when input is less than 2 characters', async () => {
    const searchSpy = vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: [] });

    renderWithProps();
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('a');

    expect(searchSpy).not.toHaveBeenCalled();
  });

  test('shows search results as ComboBox options', async () => {
    vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: sampleResults });

    renderWithProps();
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('smith');

    await waitFor(() => {
      const listItems = document.querySelectorAll(`#${comboBoxId}-item-list li`);
      expect(listItems.length).toBe(2);
    });
  });

  test('shows "similar name" label for phonetic matches in dropdown', async () => {
    vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: sampleResults });

    renderWithProps();
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('smith');

    await waitFor(() => {
      const listItems = document.querySelectorAll(`#${comboBoxId}-item-list li`);
      expect(listItems.length).toBe(2);
      // First result is exact match - no badge
      expect(listItems[0].textContent).toBe('John Smith');
      // Second result is phonetic match - has badge
      expect(listItems[1].textContent).toBe('Jane Smithson (similar name)');
    });
  });

  test('shows trustee details when a result is selected', async () => {
    vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: sampleResults });

    renderWithProps();
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('smith');

    await waitFor(() => {
      const firstItem = screen.getByTestId(`${comboBoxId}-option-item-0`);
      expect(firstItem).toBeVisible();
    });

    const firstItem = screen.getByTestId(`${comboBoxId}-option-item-0`);
    await userEvent.click(firstItem);

    await waitFor(() => {
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('(212) 555-0100')).toBeInTheDocument();
      expect(screen.getByText('john.smith@example.com')).toBeInTheDocument();
    });
  });

  test('calls onConfirm with selected trustee when Confirm is clicked', async () => {
    vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: sampleResults });
    const { onConfirm } = renderWithProps();

    act(() => modalRef.current?.show());

    await expandComboBoxAndType('smith');

    await waitFor(() => {
      const firstItem = screen.getByTestId(`${comboBoxId}-option-item-0`);
      expect(firstItem).toBeVisible();
    });

    const firstItem = screen.getByTestId(`${comboBoxId}-option-item-0`);
    await userEvent.click(firstItem);

    const submitButton = screen.getByTestId(`button-trustee-search-modal-${modalId}-submit-button`);
    await waitFor(() => expect(submitButton).toBeEnabled());
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(sampleResults[0]);
    });
  });

  test('calls onCancel when Cancel is clicked', async () => {
    const { onCancel } = renderWithProps();

    act(() => modalRef.current?.show());

    const cancelButton = screen.getByTestId(`button-trustee-search-modal-${modalId}-cancel-button`);
    await waitFor(() => expect(cancelButton).toBeEnabled());
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  test('clears search results when API call fails', async () => {
    vi.spyOn(Api2, 'searchTrustees').mockRejectedValue(new Error('Network error'));

    renderWithProps();
    act(() => modalRef.current?.show());

    await expandComboBoxAndType('smith');

    await waitFor(() => {
      const listItems = document.querySelectorAll(`#${comboBoxId}-item-list li`);
      expect(listItems.length).toBe(0);
    });
  });

  test('hides modal when hide() is called imperatively', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    const wrapper = document.querySelector(`#trustee-search-modal-${modalId}-wrapper`);
    expect(wrapper).toHaveClass('is-visible');

    act(() => modalRef.current?.hide());

    await waitFor(() => {
      expect(wrapper).toHaveClass('is-hidden');
    });
  });

  test('disables Confirm button when no trustee is selected', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    await waitFor(() => {
      const submitButton = screen.getByTestId(
        `button-trustee-search-modal-${modalId}-submit-button`,
      );
      expect(submitButton).toBeDisabled();
    });
  });
});
