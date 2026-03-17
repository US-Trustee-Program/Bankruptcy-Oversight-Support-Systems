import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseReloadActions } from './CaseReloadActions';
import { ValidatedCaseDisplay } from './ValidatedCaseDisplay';
import { PollingStatusDisplay } from './PollingStatusDisplay';
import { ErrorDisplay } from './ErrorDisplay';
import { PollStatus } from './case-reload-types';
import MockData from '@common/cams/test-utilities/mock-data';

describe('ErrorDisplay', () => {
  test('renders nothing when both errors are null', () => {
    const { container } = render(<ErrorDisplay validationError={null} reloadError={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders validation error with "Case Not Found" title when error is "Case Not Found"', () => {
    render(<ErrorDisplay validationError="Case Not Found" reloadError={null} />);
    expect(screen.getByTestId('validation-error-container')).toBeInTheDocument();
    expect(screen.getByText('Case Not Found')).toBeInTheDocument();
  });

  test('renders validation error with "Error" title and message for generic errors', () => {
    render(<ErrorDisplay validationError="Something went wrong" reloadError={null} />);
    expect(screen.getByTestId('validation-error-container')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('renders reload error container when reloadError is set', () => {
    render(<ErrorDisplay validationError={null} reloadError="Failed to queue reload" />);
    expect(screen.getByTestId('reload-error-container')).toBeInTheDocument();
    expect(screen.getByText('Failed to queue reload')).toBeInTheDocument();
  });

  test('renders both errors when both are set', () => {
    render(<ErrorDisplay validationError="Validation failed" reloadError="Reload failed" />);
    expect(screen.getByTestId('validation-error-container')).toBeInTheDocument();
    expect(screen.getByTestId('reload-error-container')).toBeInTheDocument();
  });
});

describe('CaseReloadActions', () => {
  const defaultProps = {
    pollStatus: 'idle' as PollStatus,
    isReloadable: false,
    isReloading: false,
    onReload: vi.fn(),
    onReset: vi.fn(),
  };

  test('renders Reload Case button when pollStatus is not "success"', () => {
    render(<CaseReloadActions {...defaultProps} />);
    expect(screen.getByTestId('button-reload-button')).toBeInTheDocument();
  });

  test('does not render Reload Case button when pollStatus is "success"', () => {
    render(<CaseReloadActions {...defaultProps} pollStatus="success" />);
    expect(screen.queryByTestId('button-reload-button')).not.toBeInTheDocument();
  });

  test('Reload Case button is disabled when not reloadable', () => {
    render(<CaseReloadActions {...defaultProps} isReloadable={false} />);
    expect(screen.getByTestId('button-reload-button')).toBeDisabled();
  });

  test('Reload Case button is enabled when reloadable and not polling or reloading', () => {
    render(<CaseReloadActions {...defaultProps} isReloadable={true} />);
    expect(screen.getByTestId('button-reload-button')).not.toBeDisabled();
  });

  test('Reload Case button is disabled when pollStatus is "polling"', () => {
    render(<CaseReloadActions {...defaultProps} isReloadable={true} pollStatus="polling" />);
    expect(screen.getByTestId('button-reload-button')).toBeDisabled();
  });

  test('Reload Case button is disabled when isReloading is true', () => {
    render(<CaseReloadActions {...defaultProps} isReloadable={true} isReloading={true} />);
    expect(screen.getByTestId('button-reload-button')).toBeDisabled();
  });

  test('Reset button is always rendered', () => {
    render(<CaseReloadActions {...defaultProps} pollStatus="success" />);
    expect(screen.getByTestId('button-reset-button')).toBeInTheDocument();
  });

  test('calls onReload when Reload Case button is clicked', async () => {
    const onReload = vi.fn();
    render(<CaseReloadActions {...defaultProps} isReloadable={true} onReload={onReload} />);
    await userEvent.click(screen.getByTestId('button-reload-button'));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  test('calls onReset when Reset button is clicked', async () => {
    const onReset = vi.fn();
    render(<CaseReloadActions {...defaultProps} onReset={onReset} />);
    await userEvent.click(screen.getByTestId('button-reset-button'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('ValidatedCaseDisplay', () => {
  const caseDetail = MockData.getCaseDetail();
  const defaultProps = {
    divisionName: 'Manhattan',
    caseNumber: '23-12345',
    validatedCase: caseDetail,
    cosmosCase: null,
  };

  test('shows "Not yet synced" when cosmosCase is null', () => {
    render(<ValidatedCaseDisplay {...defaultProps} cosmosCase={null} />);
    expect(screen.getByText('Not yet synced')).toBeInTheDocument();
  });

  test('shows last synced date when cosmosCase is provided', () => {
    const cosmosCase = MockData.getSyncedCase({ override: { updatedOn: '2024-01-15T10:00:00Z' } });
    render(<ValidatedCaseDisplay {...defaultProps} cosmosCase={cosmosCase} />);
    expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
  });

  test('displays division name and case number', () => {
    render(<ValidatedCaseDisplay {...defaultProps} />);
    expect(screen.getByText('Manhattan')).toBeInTheDocument();
    expect(screen.getByText('23-12345')).toBeInTheDocument();
  });

  test('displays case title from validatedCase', () => {
    render(<ValidatedCaseDisplay {...defaultProps} />);
    expect(screen.getByText(caseDetail.caseTitle)).toBeInTheDocument();
  });
});

describe('PollingStatusDisplay', () => {
  test('renders nothing when pollStatus is "idle" and not reloading', () => {
    const { container } = render(<PollingStatusDisplay pollStatus="idle" isReloading={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows success alert when pollStatus is "success"', () => {
    render(<PollingStatusDisplay pollStatus="success" isReloading={false} />);
    expect(screen.getByTestId('polling-success-container')).toBeInTheDocument();
    expect(screen.getByText('Sync Completed')).toBeInTheDocument();
  });

  test('shows loading spinner when isReloading is true', () => {
    render(<PollingStatusDisplay pollStatus="idle" isReloading={true} />);
    expect(screen.getByText('Queueing reload...')).toBeInTheDocument();
  });

  test('shows polling spinner when pollStatus is "polling"', () => {
    render(<PollingStatusDisplay pollStatus="polling" isReloading={false} />);
    expect(screen.getByTestId('polling-status-container')).toBeInTheDocument();
    expect(screen.getByText('Waiting for the reload to complete...')).toBeInTheDocument();
  });

  test('shows timeout warning when pollStatus is "timeout"', () => {
    render(<PollingStatusDisplay pollStatus="timeout" isReloading={false} />);
    expect(screen.getByTestId('polling-timeout-container')).toBeInTheDocument();
    expect(screen.getByText('Case reload is taking longer than expected')).toBeInTheDocument();
  });
});
