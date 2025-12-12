import './BankruptcySoftware.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Input from '@/lib/components/uswds/Input';
import createApi2 from '@/lib/Api2Factory';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { BankruptcySoftwareList, BankruptcySoftwareListItem } from '@common/cams/lists';
import React, { useEffect, useRef, useState } from 'react';
import { Creatable } from '@common/cams/creatable';

export function BankruptcySoftware() {
  const api = createApi2();
  const alert = useGlobalAlert();

  const [isLoaded, setIsLoaded] = useState(false);
  const [softwareList, setSoftwareList] = useState<BankruptcySoftwareList>([]);
  const [newSoftwareName, setNewSoftwareName] = useState<string>('');

  const softwareInputRef = useRef<InputRef>(null);
  const saveButtonRef = useRef<ButtonRef>(null);

  function handleSoftwareNameChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setNewSoftwareName(ev.target.value);
  }

  async function handleSave() {
    const trimmedName = newSoftwareName.trim();

    if (trimmedName.length === 0) {
      alert?.warning('Software name cannot be empty.');
      return;
    }

    const payload: Creatable<BankruptcySoftwareListItem> = {
      list: 'bankruptcy-software' as const,
      key: trimmedName,
      value: trimmedName,
    };

    try {
      await api.postBankruptcySoftware(payload);
      alert?.success('Bankruptcy software added successfully.');
      setNewSoftwareName('');
      loadSoftwareList();
    } catch (error) {
      alert?.warning(`Failed to add bankruptcy software. ${(error as Error).message}`);
    }
  }

  function isSavable() {
    return newSoftwareName.trim().length > 0;
  }

  async function handleDelete(software: BankruptcySoftwareListItem) {
    const confirmed = window.confirm(`Are you sure you want to delete ${software.value}?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.deleteBankruptcySoftware(software._id);
      alert?.success('Bankruptcy software deleted successfully.');
      loadSoftwareList();
    } catch (error) {
      alert?.warning(`Failed to delete bankruptcy software. ${(error as Error).message}`);
    }
  }

  async function loadSoftwareList() {
    try {
      const response = await api.getBankruptcySoftwareList();
      setSoftwareList(response.data as BankruptcySoftwareList);
    } catch (error) {
      alert?.warning(`Failed to load bankruptcy software list. ${(error as Error).message}`);
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    loadSoftwareList().then(() => {
      setIsLoaded(true);
    });
  }, []);

  return (
    <div className="bankruptcy-software-admin-panel" data-testid="bankruptcy-software-panel">
      <h2>Bankruptcy Software</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..."></LoadingSpinner>}
      {isLoaded && (
        <div className="bankruptcy-software-form">
          <div className="grid-row">
            <div className="grid-col-12">
              <h3>Current Software Options</h3>
              {softwareList.length === 0 ? (
                <p>No bankruptcy software options are currently configured.</p>
              ) : (
                <ul className="software-list" data-testid="software-list">
                  {softwareList.map((software) => (
                    <li key={software._id} data-testid={`software-item-${software._id}`}>
                      <span>{software.value}</span>
                      <Button
                        id={`delete-button-${software._id}`}
                        data-testid={`delete-button-${software._id}`}
                        uswdsStyle={UswdsButtonStyle.Outline}
                        onClick={() => handleDelete(software)}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="grid-row">
            <div className="grid-col-6">
              <Input
                id="new-software-name"
                label="Add New Software"
                value={newSoftwareName}
                onChange={handleSoftwareNameChange}
                autoComplete="off"
                ref={softwareInputRef}
              ></Input>
            </div>
          </div>
          <div className="grid-row">
            <div className="button-bar grid-col-6">
              <div className="save-button button-container">
                <Button
                  id="save-button"
                  uswdsStyle={UswdsButtonStyle.Default}
                  onClick={handleSave}
                  disabled={!isSavable()}
                  ref={saveButtonRef}
                >
                  Add Software
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
