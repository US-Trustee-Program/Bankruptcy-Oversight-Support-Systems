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
      actionButtonGroup={viewModel.actionButtonGroup}
      className="assign-attorney-modal"
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
                              checked={viewModel.attorneyIsInCheckList(attorney)}
                              className="attorney-list-checkbox"
                              id={`${idx}-checkbox`}
                              label={attorney.name}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                viewModel.updateCheckList(event, attorney)
                              }
                              onFocus={viewModel.handleFocus}
                              value={attorney.id}
                            />
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {viewModel.alertMessage && (
            <Alert {...viewModel.alertMessage} inline={true} show={true} />
          )}
          {viewModel.isUpdatingAssignment && (
            <LoadingSpinner caption="Updating assignment..." height="40px" />
          )}
        </>
      }
      heading={viewModel.modalHeading}
      modalId={viewModel.modalId}
      onClose={viewModel.cancelModal}
      onOpen={viewModel.onOpen}
      onTabKey={(ev, isVisible) => viewModel.handleTab(ev, isVisible, viewModel.modalId)}
      ref={viewModel.modalRef}
    ></Modal>
  );
}
