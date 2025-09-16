import UsStatesComboBox from './UsStatesComboBox';
import ComboBox from './ComboBox';
import { render } from '@testing-library/react';
import { usStates } from '@common/cams/us-states';

// Mock the ComboBox component to verify it's called with correct props
vi.mock('./ComboBox', () => ({
  default: vi.fn(() => <div data-testid="mocked-combobox">Mocked ComboBox</div>),
}));

const MockedComboBox = vi.mocked(ComboBox);

describe('UsStatesComboBox', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render ComboBox with USPS states options and correct labels', () => {
    const props = {
      id: 'test-states',
      label: 'Select States',
      onUpdateSelection: vi.fn(),
      selections: [],
    };

    render(<UsStatesComboBox {...props} />);

    // Verify ComboBox was called
    expect(MockedComboBox).toHaveBeenCalledTimes(1);

    // Get the props passed to ComboBox
    const comboBoxProps = MockedComboBox.mock.calls[0][0];

    // Verify all original props are passed through
    expect(comboBoxProps.id).toBe(props.id);
    expect(comboBoxProps.label).toBe(props.label);
    expect(comboBoxProps.onUpdateSelection).toBe(props.onUpdateSelection);

    // Verify USPS states-specific props
    expect(comboBoxProps.singularLabel).toBe('state');
    expect(comboBoxProps.pluralLabel).toBe('states');

    // Verify options are correctly formatted USPS states
    expect(comboBoxProps.options).toHaveLength(usStates.length);

    // Check first few options have correct format
    const firstState = usStates[0];
    expect(comboBoxProps.options[0]).toEqual({
      label: `${firstState.code} - ${firstState.name}`,
      value: firstState.code,
    });

    // Verify a specific known state (California)
    const californiaOption = comboBoxProps.options.find((option) => option.value === 'CA');
    expect(californiaOption).toEqual({
      label: 'CA - California',
      value: 'CA',
    });
  });
});
