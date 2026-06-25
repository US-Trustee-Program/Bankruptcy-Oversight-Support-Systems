import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  NotificationRoutingRecord,
  NOTIFICATION_ROUTING_DEFINITIONS,
} from '@common/cams/notifications';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationRouting() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [records, setRecords] = useState<NotificationRoutingRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function loadData() {
    try {
      const routingResponse = await Api2.getNotificationRouting();
      const loadedRecords = routingResponse.data as NotificationRoutingRecord[];
      setRecords(loadedRecords);

      const emailMap: Record<string, string> = {};
      for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
        const record = loadedRecords.find((r) => r.id === def.id);
        emailMap[def.id] = record?.recipientAddress ?? '';
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

  function handleEmailChange(id: string, value: string) {
    setEmails((prev) => ({ ...prev, [id]: value }));
    setSaveSuccess(false);
  }

  async function handleSave() {
    const errors: string[] = [];
    for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
      const email = emails[def.id]?.trim();
      if (email && !EMAIL_REGEX.test(email)) {
        errors.push(`${def.displayName}: invalid email address.`);
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
        const email = emails[def.id]?.trim();
        const existingRecord = records.find((r) => r.id === def.id);
        if (email && email !== existingRecord?.recipientAddress) {
          const response = await Api2.updateNotificationRouting(def.id, {
            recipientAddress: email,
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
              <label className="usa-label" htmlFor={`routing-email-${def.id}`}>
                {def.displayName}
              </label>
              <span className="usa-hint">Covers: {def.covers.join(', ')}</span>
              <input
                className="usa-input"
                id={`routing-email-${def.id}`}
                data-testid={`routing-email-${def.id}`}
                type="email"
                value={emails[def.id] ?? ''}
                onChange={(e) => handleEmailChange(def.id, e.target.value)}
              />
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
