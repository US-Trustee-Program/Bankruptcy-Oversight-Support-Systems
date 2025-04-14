import { describe, expect, vi } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import { PresenterWithUseState, usePresenter } from './Presenter';
import { Api2 } from '@/lib/models/api2';
import { UstpOfficeDetails } from '@common/cams/offices';

// Mock Api2
vi.mock('@/lib/models/api2', () => ({
  Api2: {
    getOffices: vi.fn(),
  },
}));

// TODO: Move this to test utilities.
function mockUseState() {
  return async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
      ...actual,
      useState: vi.fn((initial: number) => {
        const [state, setState] = actual.useState(initial);
        return [
          state,
          (newState: number | ((prev: number) => number)) => {
            if (typeof newState === 'function') {
              setState((prev: number) => newState(prev));
            } else {
              setState(newState);
            }
          },
        ];
      }),
    };
  };
}

vi.mock('react', mockUseState());

describe('usePresenter', () => {
  const mockOffices: UstpOfficeDetails[] = [
    {
      officeCode: '1',
      officeName: 'Office 1',
      groups: [],
      idpGroupName: 'group1',
      regionId: '1',
      regionName: 'Region 1',
    },
    {
      officeCode: '2',
      officeName: 'Office 2',
      groups: [],
      idpGroupName: 'group2',
      regionId: '2',
      regionName: 'Region 2',
    },
    {
      officeCode: '3',
      officeName: 'Office 3',
      groups: [],
      idpGroupName: 'group3',
      regionId: '3',
      regionName: 'Region 3',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (Api2.getOffices as jest.Mock).mockResolvedValue({ data: mockOffices });
  });

  test('render the component', async () => {
    render(<PresenterWithUseState></PresenterWithUseState>);
    const element = await screen.findByTestId('theCount');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('0');
  });

  test('should initialize with default count of 0 when no initial state provided', () => {
    const { result } = renderHook(() => usePresenter({}));
    expect(result.current.state.count).toEqual(0);
  });

  test('should initialize with provided count', () => {
    const { result } = renderHook(() => usePresenter({ count: 5 }));
    expect(result.current.state.count).toEqual(5);
  });

  test('should increment the count when increment is called', () => {
    const { result } = renderHook(() => usePresenter({ count: 0 }));

    act(() => {
      result.current.actions.increment();
    });

    expect(result.current.state.count).toEqual(1);
  });

  test('should decrement the count when decrement is called', () => {
    const { result } = renderHook(() => usePresenter({ count: 5 }));

    act(() => {
      result.current.actions.decrement();
    });

    expect(result.current.state.count).toEqual(4);
  });

  test('should handle multiple increment and decrement operations', () => {
    const { result } = renderHook(() => usePresenter({ count: 0 }));

    act(() => {
      result.current.actions.increment();
      result.current.actions.increment();
      result.current.actions.decrement();
    });

    expect(result.current.state.count).toEqual(1);
  });

  test('should fetch offices when count is greater than 0', async () => {
    const { result } = renderHook(() => usePresenter({ count: 1 }));

    await act(async () => {
      await result.current.actions.getOffices();
    });

    expect(Api2.getOffices).toHaveBeenCalled();
    expect(result.current.state.offices).toEqual([mockOffices[0]]);
  });

  test('should not fetch offices when count is 0', async () => {
    const { result } = renderHook(() => usePresenter({ count: 0 }));

    await act(async () => {
      await result.current.actions.getOffices();
    });

    expect(Api2.getOffices).toHaveBeenCalled();
    expect(result.current.state.offices).toEqual([]);
  });

  test('should fetch correct number of offices based on count', async () => {
    const { result } = renderHook(() => usePresenter({ count: 2 }));

    await act(async () => {
      await result.current.actions.getOffices();
    });

    expect(Api2.getOffices).toHaveBeenCalled();
    expect(result.current.state.offices).toEqual(mockOffices.slice(0, 2));
  });

  test('should handle doBang state correctly', () => {
    const { result } = renderHook(() => usePresenter({ count: 9 }));

    act(() => {
      result.current.actions.increment();
    });

    expect(result.current.state.doBang).toBe(true);
  });
});
