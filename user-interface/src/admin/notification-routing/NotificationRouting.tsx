import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  CamsTable,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableBody,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import {
  NotificationConfig,
  NotificationRoutingInput,
  NotificationRoutingRecord,
} from '@common/cams/notifications';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationRouting() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [records, setRecords] = useState<NotificationRoutingRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<NotificationConfig>({ enabled: false });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NotificationRoutingRecord | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function loadData() {
    try {
      const [routingResponse, configResponse] = await Promise.all([
        Api2.getNotificationRouting(),
        Api2.getNotificationConfig(),
      ]);
      setRecords(routingResponse.data as NotificationRoutingRecord[]);
      setConfig(configResponse.data as NotificationConfig);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    loadData().then(() => setIsLoaded(true));
  }, []);

  function handleAddClick() {
    setEditingRecord(null);
    setFormKey('');
    setFormEmail('');
    setFormDisplayName('');
    setFormErrors([]);
    setShowForm(true);
  }

  function handleEditClick(record: NotificationRoutingRecord) {
    setEditingRecord(record);
    setFormKey(record.key);
    setFormEmail(record.recipientAddress);
    setFormDisplayName(record.displayName ?? '');
    setFormErrors([]);
    setShowForm(true);
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingRecord(null);
    setFormErrors([]);
  }

  function validateForm(): boolean {
    const errors: string[] = [];
    if (!formKey.trim()) {
      errors.push('Key is required.');
    }
    if (!formEmail.trim() || !EMAIL_REGEX.test(formEmail.trim())) {
      errors.push('A valid email address is required.');
    }
    setFormErrors(errors);
    return errors.length === 0;
  }

  async function handleSaveForm() {
    if (!validateForm()) return;

    const input: NotificationRoutingInput = {
      key: formKey.trim(),
      recipientAddress: formEmail.trim(),
      displayName: formDisplayName.trim() || undefined,
    };

    try {
      if (editingRecord) {
        const response = await Api2.updateNotificationRouting(editingRecord.id, input);
        const updated = (response as { data: NotificationRoutingRecord }).data;
        setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const response = await Api2.createNotificationRouting(input);
        const created = (response as { data: NotificationRoutingRecord }).data;
        setRecords((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditingRecord(null);
    } catch (error) {
      setFormErrors([(error as Error).message]);
    }
  }

  async function handleDeleteClick(routingId: string) {
    try {
      await Api2.deleteNotificationRouting(routingId);
      setRecords((prev) => prev.filter((r) => r.id !== routingId));
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  async function handleToggleConfig() {
    const newConfig = { enabled: !config.enabled };
    try {
      await Api2.updateNotificationConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  return (
    <div className="notification-routing-admin-panel" data-testid="notification-routing-panel">
      <h2 className="screen-reader-only">Notification Routing</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..." />}
      {isLoaded && loadError && (
        <Alert
          id="routing-load-error"
          message={`Failed to load notification routing. ${loadError}`}
          type={UswdsAlertStyle.Error}
          show={true}
        />
      )}
      {isLoaded && !loadError && (
        <>
          <div className="grid-row margin-bottom-2">
            <div className="grid-col-12">
              <span data-testid="notification-config-status">
                Notifications: {config.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <Button
                id="toggle-notifications-button"
                uswdsStyle={UswdsButtonStyle.Outline}
                onClick={handleToggleConfig}
              >
                {config.enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
          <div className="grid-row">
            <div className="grid-col-12">
              <Button
                id="add-routing-button"
                uswdsStyle={UswdsButtonStyle.Default}
                onClick={handleAddClick}
              >
                <Icon name="add" /> Add Routing
              </Button>
            </div>
          </div>
          {showForm && (
            <div className="grid-row margin-top-2" data-testid="routing-form">
              <div className="grid-col-12">
                {formErrors.length > 0 && (
                  <div className="usa-error-message" data-testid="routing-form-errors">
                    {formErrors.map((err) => (
                      <p key={err}>{err}</p>
                    ))}
                  </div>
                )}
                <div className="usa-form-group">
                  <label className="usa-label" htmlFor="routing-key-input">
                    Key
                  </label>
                  <input
                    className="usa-input"
                    id="routing-key-input"
                    data-testid="routing-key-input"
                    type="text"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                  />
                </div>
                <div className="usa-form-group">
                  <label className="usa-label" htmlFor="routing-email-input">
                    Recipient Address
                  </label>
                  <input
                    className="usa-input"
                    id="routing-email-input"
                    data-testid="routing-email-input"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
                <div className="usa-form-group">
                  <label className="usa-label" htmlFor="routing-display-name-input">
                    Display Name
                  </label>
                  <input
                    className="usa-input"
                    id="routing-display-name-input"
                    data-testid="routing-display-name-input"
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                  />
                </div>
                <Button
                  id="save-routing-button"
                  uswdsStyle={UswdsButtonStyle.Default}
                  onClick={handleSaveForm}
                >
                  Save
                </Button>
                <Button
                  id="cancel-routing-button"
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  onClick={handleCancelForm}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <div className="notification-routing-table-container margin-top-2">
            <CamsTable aria-label="Notification Routing" data-testid="notification-routing-table">
              <CamsTableHeader>
                <CamsTableHeaderCell>Key</CamsTableHeaderCell>
                <CamsTableHeaderCell>Recipient Address</CamsTableHeaderCell>
                <CamsTableHeaderCell>Display Name</CamsTableHeaderCell>
                <CamsTableHeaderCell>Actions</CamsTableHeaderCell>
              </CamsTableHeader>
              <CamsTableBody>
                {records.map((record) => (
                  <CamsTableRow key={record.id}>
                    <CamsTableCell>{record.key}</CamsTableCell>
                    <CamsTableCell>{record.recipientAddress}</CamsTableCell>
                    <CamsTableCell>{record.displayName ?? ''}</CamsTableCell>
                    <CamsTableCell>
                      <Button
                        id={`edit-routing-${record.id}`}
                        uswdsStyle={UswdsButtonStyle.Unstyled}
                        onClick={() => handleEditClick(record)}
                      >
                        Edit
                      </Button>
                      <Button
                        id={`delete-routing-${record.id}`}
                        uswdsStyle={UswdsButtonStyle.Unstyled}
                        onClick={() => handleDeleteClick(record.id)}
                      >
                        Delete
                      </Button>
                    </CamsTableCell>
                  </CamsTableRow>
                ))}
              </CamsTableBody>
            </CamsTable>
          </div>
        </>
      )}
    </div>
  );
}
