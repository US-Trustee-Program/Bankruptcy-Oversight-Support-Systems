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
