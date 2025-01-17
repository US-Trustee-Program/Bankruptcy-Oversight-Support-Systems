import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import DatePicker from '@/lib/components/uswds/DatePicker';
import useApi2 from '@/lib/hooks/UseApi2';
import useFeatureFlags, { PRIVILEGED_IDENTITY_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { RoleAndOfficeGroupNames } from '@common/cams/privileged-identity';
import { CamsUserReference } from '@common/cams/users';
import { useEffect, useState } from 'react';

export default function PrivilegedIdentity() {
  const flags = useFeatureFlags();
  const api = useApi2();

  const [isLoaded, setIsLoaded] = useState(false);
  const [groupNames, setGroupNames] = useState<RoleAndOfficeGroupNames>({
    roles: [],
    offices: [],
  });
  const [userList, setUserList] = useState<CamsUserReference[]>([]);
  const [buttonDeleteDisabled, _setButtonDeleteDisabled] = useState<boolean>(true);
  const [buttonSaveDisabled, setButtonSaveDisabled] = useState<boolean>(true);
  const [buttonCancelDisabled, setButtonCancelDisabled] = useState<boolean>(true);
  const [formFieldsDisabled, setFormFieldsDisabled] = useState<boolean>(true);

  // Stop if the feature is disabled.
  if (!flags[PRIVILEGED_IDENTITY_MANAGEMENT]) {
    return (
      <Alert type={UswdsAlertStyle.Info} inline={true} show={true} title="Notice">
        Privileged Identity Management is disabled in this environment.
      </Alert>
    );
  }

  function handleSelectUser(users: ComboOption[]) {
    if (users.length) {
      console.log(users[0].label);
      setFormFieldsDisabled(false);
      setButtonSaveDisabled(false);
      setButtonCancelDisabled(false);
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    api
      .getRoleAndOfficeGroupNames()
      .then((groups) => {
        setGroupNames(groups.data);
        api.getPrivilegedIdentityUsers().then((res) => {
          setUserList(res.data);
        });
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  return (
    <div>
      <h2>Privileged Identity</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..."></LoadingSpinner>}
      {isLoaded && (
        <div className="privileged-identity-form">
          <div className="user-list-container">
            <ComboBox
              id="user-list"
              label="User"
              options={userList.map((user) => {
                return {
                  value: user.id,
                  label: user.name,
                };
              })}
              onUpdateSelection={handleSelectUser}
              multiSelect={false}
            ></ComboBox>
          </div>
          <div className="office-list-container">
            <ComboBox
              id="office-list"
              label="Offices"
              options={groupNames.offices.map((office) => {
                return {
                  value: office,
                  label: office.replace('USTP CAMS ', ''),
                };
              })}
              disabled={formFieldsDisabled}
              multiSelect={true}
            ></ComboBox>
          </div>
          <div className="role-list-container">
            <ComboBox
              id="role-list"
              label="Roles"
              options={groupNames.roles.map((group) => {
                return {
                  value: group,
                  label: group.replace('USTP CAMS ', ''),
                };
              })}
              disabled={formFieldsDisabled}
              multiSelect={true}
            ></ComboBox>
          </div>
          <div className="expiration-container">
            <DatePicker
              id="privileged-expiration-date"
              label="Expires on"
              disabled={formFieldsDisabled}
            ></DatePicker>
          </div>
          <div className="button-bar">
            <div className="delete-button">
              <Button uswdsStyle={UswdsButtonStyle.Secondary} disabled={buttonDeleteDisabled}>
                Delete User
              </Button>
            </div>
            <div className="save-button">
              <Button uswdsStyle={UswdsButtonStyle.Default} disabled={buttonSaveDisabled}>
                Save
              </Button>
            </div>
            <div className="cancel-button">
              <Button uswdsStyle={UswdsButtonStyle.Unstyled} disabled={buttonCancelDisabled}>
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
