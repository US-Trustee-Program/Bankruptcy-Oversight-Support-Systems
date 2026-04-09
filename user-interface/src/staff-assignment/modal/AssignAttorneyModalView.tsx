import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert from '@/lib/components/uswds/Alert';
import Checkbox from '@/lib/components/uswds/Checkbox';
import Modal from '@/lib/components/uswds/modal/Modal';
import { AttorneyUser } from '@common/cams/users';
import { AssignAttorneyModalViewProps } from './assignAttorneyModal.types';

export function AssignAttorneyModalView(props: AssignAttorneyModalViewProps) {
  const { viewModel } = props;

  return (
    <Modal
      ref={viewModel.modalRef}
      modalId={viewModel.modalId}
      className="assign-attorney-modal"
      onOpen={viewModel.onOpen}
      onClose={viewModel.cancelModal}
      onTabKey={(ev, isVisible) => viewModel.handleTab(ev, isVisible, viewModel.modalId)}
      heading={viewModel.modalHeading}
      content={
        <>
          <fieldset className="attorney-selection-fieldset">
            <legend className="attorney-name-legend">Attorney Name</legend>
            <div
              className="attorney-list"
              data-testid="case-load-table-body"
              ref={viewModel.tableContainerRef}
            >
              {viewModel.attorneyList.length > 0 &&
                viewModel.attorneyList
                  .sort(viewModel.sortAttorneys)
                  .map((attorney: AttorneyUser) => {
                    return (
                      <Checkbox
                        key={attorney.id}
                        id={`attorney-${attorney.id}-checkbox`}
                        value={attorney.id}
                        onFocus={viewModel.handleFocus}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          viewModel.updateCheckList(event, attorney)
                        }
                        checked={viewModel.attorneyIsInCheckList(attorney)}
                        className="attorney-list-checkbox"
                        label={attorney.name}
                      />
                    );
                  })}
            </div>
          </fieldset>
          <div className="usa-form-group">
            <label className="usa-label" htmlFor="lead-trial-attorney-select">
              Select Lead Trial Attorney
            </label>
            <select
              className="usa-select"
              id="lead-trial-attorney-select"
              value={viewModel.leadTrialAttorney?.id ?? ''}
              onChange={(e) => {
                const selected = viewModel.checkedAttorneys.find((a) => a.id === e.target.value);
                viewModel.updateLeadTrialAttorney(
                  selected ? { id: selected.id, name: selected.name } : null,
                );
              }}
            >
              <option value="">- Select -</option>
              {[...viewModel.checkedAttorneys]
                .sort((a, b) => viewModel.sortAttorneys(a as AttorneyUser, b as AttorneyUser))
                .map((attorney) => (
                  <option key={attorney.id} value={attorney.id}>
                    {attorney.name}
                  </option>
                ))}
            </select>
          </div>
          {viewModel.alertMessage && (
            <Alert {...viewModel.alertMessage} show={true} inline={true} />
          )}
          {viewModel.isUpdatingAssignment && (
            <LoadingSpinner caption="Updating assignment..." height="40px" />
          )}
        </>
      }
      actionButtonGroup={viewModel.actionButtonGroup}
    ></Modal>
  );
}
