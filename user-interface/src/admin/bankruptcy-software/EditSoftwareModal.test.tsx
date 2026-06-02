import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EditSoftwareModal, EditSoftwareModalRef } from './EditSoftwareModal';
import Api2 from '@/lib/models/api2';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import TestingUtilities from '@/lib/testing/testing-utilities';

const software: BankruptcySoftwareProfile = {
  id: 'sw-1',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'Axos',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

const updatedSoftware: BankruptcySoftwareProfile = {
  ...software,
  name: 'Axos Renamed',
  status: 'inactive',
};

const modalRef = createRef<EditSoftwareModalRef>();

function renderModal(onSuccess: (updated: BankruptcySoftwareProfile) => void = vi.fn()) {
  render(
    <BrowserRouter>
      <EditSoftwareModal
        ref={modalRef}
        modalId="edit-software-modal"
        software={software}
        onSuccess={onSuccess}
      />
    </BrowserRouter>,
  );
}

describe('EditSoftwareModal', () => {
  let successSpy: (updated: BankruptcySoftwareProfile) => void;
  let alertHook: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  beforeEach(() => {
    successSpy = vi.fn();
    alertHook = TestingUtilities.spyOnGlobalAlert();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should open modal and pre-fill with current software values', async () => {
    renderModal(successSpy);
    act(() => {
      modalRef.current?.show();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Axos')).toBeInTheDocument();
      expect(screen.getByTestId('radio-edit-software-modal-status-active')).toBeChecked();
    });
  });

  test('should show validation error when name is blank', async () => {
    renderModal(successSpy);
    act(() => {
      modalRef.current?.show();
    });

    const nameInput = await screen.findByDisplayValue('Axos');
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Software Name is required')).toBeInTheDocument();
    });
    expect(successSpy).not.toHaveBeenCalled();
  });

  test('should call updateSoftware, invoke onSuccess, and show success alert on valid submit', async () => {
    vi.spyOn(Api2, 'updateSoftware').mockResolvedValue({ data: updatedSoftware });

    renderModal(successSpy);
    act(() => {
      modalRef.current?.show();
    });

    await screen.findByDisplayValue('Axos');
    const nameInput = screen.getByDisplayValue('Axos');
    fireEvent.change(nameInput, { target: { value: 'Axos Renamed' } });
    fireEvent.click(
      screen.getByTestId('button-radio-edit-software-modal-status-inactive-click-target'),
    );
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(Api2.updateSoftware).toHaveBeenCalledWith('sw-1', {
        name: 'Axos Renamed',
        status: 'inactive',
      });
      expect(successSpy).toHaveBeenCalledWith(updatedSoftware);
      expect(alertHook.success).toHaveBeenCalledWith('Bankruptcy software updated successfully.');
    });
  });

  test('should show error alert and keep modal open on API failure', async () => {
    vi.spyOn(Api2, 'updateSoftware').mockRejectedValue(new Error('server error'));

    renderModal(successSpy);
    act(() => {
      modalRef.current?.show();
    });

    const nameInput = await screen.findByDisplayValue('Axos');
    fireEvent.change(nameInput, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(alertHook.error).toHaveBeenCalledWith(
        'Failed to update bankruptcy software. Please try again.',
      );
      expect(successSpy).not.toHaveBeenCalled();
    });
  });

  test('should call hide on the modal ref', async () => {
    renderModal(successSpy);
    act(() => {
      modalRef.current?.show();
    });
    await screen.findByDisplayValue('Axos');
    act(() => {
      modalRef.current?.hide();
    });
    expect(successSpy).not.toHaveBeenCalled();
  });

  test('should set status to active when active radio is clicked', async () => {
    renderModal(successSpy);
    act(() => {
      modalRef.current?.show();
    });

    await screen.findByDisplayValue('Axos');
    fireEvent.click(
      screen.getByTestId('button-radio-edit-software-modal-status-inactive-click-target'),
    );
    fireEvent.click(
      screen.getByTestId('button-radio-edit-software-modal-status-active-click-target'),
    );

    expect(screen.getByTestId('radio-edit-software-modal-status-active')).toBeChecked();
  });

  test('should reset form and close modal on cancel', async () => {
    renderModal(successSpy);
    act(() => {
      modalRef.current?.show();
    });

    await screen.findByDisplayValue('Axos');
    const nameInput = screen.getByDisplayValue('Axos');
    fireEvent.change(nameInput, { target: { value: 'Modified' } });
    fireEvent.click(screen.getByText('Cancel'));

    expect(successSpy).not.toHaveBeenCalled();
  });
});
