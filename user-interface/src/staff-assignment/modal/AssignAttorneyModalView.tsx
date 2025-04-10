import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert from '@/lib/components/uswds/Alert';
import Checkbox from '@/lib/components/uswds/Checkbox';
import Modal from '@/lib/components/uswds/modal/Modal';
import { AttorneyUser } from '@common/cams/users';
import { AssignAttorneyModalViewProps } from './AssignAttorneyModal.types';

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
          <div className="visible-headings">
            <h2 className="attorney-name">Attorney Name</h2>
          </div>
          <div className="usa-table-container--scrollable" ref={viewModel.tableContainerRef}>
            <table className="attorney-list" role="none">
              <thead>
                <tr>
                  <th>Attorney Name</th>
                </tr>
              </thead>
              <tbody data-testid="case-load-table-body">
                {viewModel.attorneyList.length > 0 &&
                  viewModel.attorneyList
                    .sort(viewModel.sortAttorneys)
                    .map((attorney: AttorneyUser, idx: number) => {
                      return (
                        <tr key={idx}>
                          <td className="assign-attorney-checkbox-column">
                            <Checkbox
                              id={`${idx}-checkbox`}
                              value={attorney.id}
                              onFocus={viewModel.handleFocus}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                viewModel.updateCheckList(event, attorney)
                              }
                              checked={viewModel.attorneyIsInCheckList(attorney)}
                              className="attorney-list-checkbox"
                              label={attorney.name}
                            />
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
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
