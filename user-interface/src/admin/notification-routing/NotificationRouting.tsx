import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Icon from '@/lib/components/uswds/Icon';
import {
  NotificationRoutingRecord,
  NOTIFICATION_ROUTING_DEFINITIONS,
} from '@common/cams/notifications';
import { EMAIL_REGEX } from '@common/cams/regex';

export function NotificationRouting() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [records, setRecords] = useState<NotificationRoutingRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emails, setEmails] = useState<Record<string, string[]>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function loadData() {
    try {
      const routingResponse = await Api2.getNotificationRouting();
      const loadedRecords = routingResponse.data as NotificationRoutingRecord[];
      setRecords(loadedRecords);

      const emailMap: Record<string, string[]> = {};
      for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
        const record = loadedRecords.find((r) => r.id === def.id);
        emailMap[def.id] = record?.recipientAddresses?.length ? record.recipientAddresses : [''];
      }
      setEmails(emailMap);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    loadData().then(() => setIsLoaded(true));
  }, []);

  function handleEmailChange(defId: string, index: number, value: string) {
    setEmails((prev) => {
      const updated = [...(prev[defId] ?? [''])];
      updated[index] = value;
      return { ...prev, [defId]: updated };
    });
    setSaveSuccess(false);
  }

  function handleAddEmail(defId: string) {
    setEmails((prev) => ({ ...prev, [defId]: [...(prev[defId] ?? ['']), ''] }));
    setSaveSuccess(false);
  }

  async function handleSave() {
    const errors: string[] = [];
    for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
      const addrs = (emails[def.id] ?? ['']).map((a) => a.trim()).filter(Boolean);
      for (const addr of addrs) {
        if (!EMAIL_REGEX.test(addr)) {
          errors.push(`${def.displayName}: invalid email address "${addr}".`);
        }
      }
    }
    if (errors.length > 0) {
      setFormErrors(errors);
      setSaveSuccess(false);
      return;
    }
    setFormErrors([]);

    try {
      for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
        const addrs = (emails[def.id] ?? ['']).map((a) => a.trim()).filter(Boolean);
        const existingRecord = records.find((r) => r.id === def.id);
        const existingAddrs = existingRecord?.recipientAddresses ?? [];
        const unchanged =
          addrs.length === existingAddrs.length && addrs.every((a, i) => a === existingAddrs[i]);
        if (!unchanged) {
          const response = await Api2.updateNotificationRouting(def.id, {
            recipientAddresses: addrs,
          });
          const updated = (response as { data: NotificationRoutingRecord }).data;
          setRecords((prev) => {
            const exists = prev.some((r) => r.id === updated.id);
            if (exists) return prev.map((r) => (r.id === updated.id ? updated : r));
            return [...prev, updated];
          });
        }
      }
      setSaveSuccess(true);
    } catch (error) {
      setFormErrors([(error as Error).message]);
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
          {formErrors.length > 0 && (
            <div className="usa-error-message margin-bottom-2" data-testid="routing-form-errors">
              {formErrors.map((err) => (
                <p key={err}>{err}</p>
              ))}
            </div>
          )}
          {saveSuccess && (
            <Alert
              id="routing-save-success"
              message="Notification routing saved successfully."
              type={UswdsAlertStyle.Success}
              show={true}
            />
          )}
          {NOTIFICATION_ROUTING_DEFINITIONS.map((def) => (
            <div
              key={def.id}
              className="usa-form-group margin-bottom-3"
              data-testid={`routing-field-${def.id}`}
            >
              <label className="usa-label">{def.displayName}</label>
              <span className="usa-hint">Covers: {def.covers.join(', ')}</span>
              {(emails[def.id] ?? ['']).map((addr, index) => (
                <input
                  key={index}
                  className="usa-input"
                  id={index === 0 ? `routing-email-${def.id}` : `routing-email-${def.id}-${index}`}
                  data-testid={
                    index === 0 ? `routing-email-${def.id}` : `routing-email-${def.id}-${index}`
                  }
                  type="email"
                  value={addr}
                  onChange={(e) => handleEmailChange(def.id, index, e.target.value)}
                />
              ))}
              <button
                type="button"
                className="usa-button usa-button--unstyled margin-top-1"
                onClick={() => handleAddEmail(def.id)}
                data-testid={`add-email-${def.id}`}
              >
                <Icon name="add" /> Add Another Email
              </button>
            </div>
          ))}
          <Button
            id="save-routing-button"
            uswdsStyle={UswdsButtonStyle.Default}
            onClick={handleSave}
          >
            Save
          </Button>
        </>
      )}
    </div>
  );
}
