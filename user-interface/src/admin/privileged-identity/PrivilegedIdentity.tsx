import './PrivilegedIdentity.scss';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import DatePicker from '@/lib/components/uswds/DatePicker';
import useApi2 from '@/lib/hooks/UseApi2';
import useFeatureFlags, { PRIVILEGED_IDENTITY_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { ComboBoxRef, InputRef } from '@/lib/type-declarations/input-fields';
import { RoleAndOfficeGroupNames } from '@common/cams/privileged-identity';
import { CamsUserReference } from '@common/cams/users';
import { useEffect, useRef, useState } from 'react';

export default function PrivilegedIdentity() {
  const flags = useFeatureFlags();
  const api = useApi2();

  const [isLoaded, setIsLoaded] = useState(false);
  const [groupNames, setGroupNames] = useState<RoleAndOfficeGroupNames>({
    roles: [],
    offices: [],
  });
  const [userList, setUserList] = useState<CamsUserReference[]>([]);

  const officeListRef = useRef<ComboBoxRef>(null);
  const roleListRef = useRef<ComboBoxRef>(null);
  const datePickerRef = useRef<InputRef>(null);
  const saveButtonRef = useRef<ButtonRef>(null);
  const cancelButtonRef = useRef<ButtonRef>(null);
  const deleteButtonRef = useRef<ButtonRef>(null);

  // Stop if the feature is disabled.
  if (!flags[PRIVILEGED_IDENTITY_MANAGEMENT]) {
    return (
      <Alert type={UswdsAlertStyle.Info} inline={true} show={true} title="Notice">
        Privileged Identity Management is disabled in this environment.
      </Alert>
    );
  }

  function enableForm(enable: boolean = true) {
    officeListRef.current?.disable(!enable);
    roleListRef.current?.disable(!enable);
    datePickerRef.current?.disable(!enable);
    // TODO: remove comments after adding delete user capability
    //deleteButtonRef.current?.disableButton(!enable);
    saveButtonRef.current?.disableButton(!enable);
    cancelButtonRef.current?.disableButton(!enable);
  }

  function handleSelectUser(users: ComboOption[]) {
    if (users.length) enableForm(true);
    else enableForm(false);
  }

  useEffect(() => {
    setIsLoaded(false);
    api
      .getRoleAndOfficeGroupNames()
      .then((groups) => {
        setGroupNames(groups.data);

        // TODO: uncomment after fixing API endpoint
        //api.getPrivilegedIdentityUsers().then((res) => {
        //  setUserList(res.data);
        //});
        setUserList([
          {
            id: '1',
            name: 'jack',
          },
          {
            id: '2',
            name: 'jill',
          },
        ]);
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  return (
    <div className="privileged-identity-admin-panel">
      <h2>Privileged Identity</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..."></LoadingSpinner>}
      {isLoaded && (
        <div className="privileged-identity-form">
          <div className="grid-row">
            <div className="user-list-container grid-col-5">
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
          </div>
          <div className="grid-row">
            <div className="office-list-container grid-col-5">
              <ComboBox
                id="office-list"
                label="Offices"
                options={groupNames.offices.map((office) => {
                  return {
                    value: office,
                    label: office.replace('USTP CAMS ', ''),
                  };
                })}
                disabled={true}
                multiSelect={true}
                ref={officeListRef}
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="role-list-container grid-col-5">
              <ComboBox
                id="role-list"
                label="Roles"
                options={groupNames.roles.map((group) => {
                  return {
                    value: group,
                    label: group.replace('USTP CAMS ', ''),
                  };
                })}
                disabled={true}
                ref={roleListRef}
                multiSelect={true}
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="expiration-container grid-col-5">
              <DatePicker
                id="privileged-expiration-date"
                label="Expires on"
                disabled={true}
                ref={datePickerRef}
              ></DatePicker>
            </div>
          </div>
          <div className="grid-row">
            <div className="button-bar grid-col-5">
              <div className="button-bar-left-side">
                <div className="delete-button button-container">
                  <Button
                    uswdsStyle={UswdsButtonStyle.Secondary}
                    disabled={true}
                    ref={deleteButtonRef}
                  >
                    Delete User
                  </Button>
                </div>
              </div>
              <div className="button-bar-right-side">
                <div className="save-button button-container">
                  <Button uswdsStyle={UswdsButtonStyle.Default} disabled={true} ref={saveButtonRef}>
                    Save
                  </Button>
                </div>
                <div className="cancel-button button-container">
                  <Button
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                    disabled={true}
                    ref={cancelButtonRef}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
