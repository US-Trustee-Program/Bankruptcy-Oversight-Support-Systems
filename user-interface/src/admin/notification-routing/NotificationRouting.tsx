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

function validateAllEmails(emails: Record<string, string[]>): {
  errors: Record<string, (string | null)[]>;
  hasErrors: boolean;
} {
  const errors: Record<string, (string | null)[]> = {};
  let hasErrors = false;

  for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
    const addrs = emails[def.id] ?? [''];
    const defErrors: (string | null)[] = addrs.map((addr) => {
      const trimmed = addr.trim();
      if (trimmed && !EMAIL_REGEX.test(trimmed)) {
        return 'Must be a valid email address';
      }
      return null;
    });

    errors[def.id] = defErrors;
    if (defErrors.some((e) => e !== null)) hasErrors = true;
  }

  return { errors, hasErrors };
}

export function NotificationRouting() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [records, setRecords] = useState<NotificationRoutingRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emails, setEmails] = useState<Record<string, string[]>>({});
  const [emailKeys, setEmailKeys] = useState<Record<string, string[]>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, (string | null)[]>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function loadData(): Promise<boolean> {
    try {
      const routingResponse = await Api2.getNotificationRouting();
      const loadedRecords = routingResponse.data as NotificationRoutingRecord[];
      setRecords(loadedRecords);

      const emailMap: Record<string, string[]> = {};
      const keyMap: Record<string, string[]> = {};
      for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
        const record = loadedRecords.find((r) => r.id === def.id);
        const addrs = record?.recipientAddresses?.length ? record.recipientAddresses : [''];
        emailMap[def.id] = addrs;
        keyMap[def.id] = addrs.map(() => crypto.randomUUID());
      }
      setEmails(emailMap);
      setEmailKeys(keyMap);
      setEmailErrors({});
      setLoadError(null);
      return true;
    } catch (error) {
      setLoadError((error as Error).message);
      return false;
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    loadData().then(() => setIsLoaded(true));
  }, []);

  function clearEmailError(defId: string, index: number) {
    setEmailErrors((prev) => {
      const defErrors = [...(prev[defId] ?? [])];
      defErrors[index] = null;
      return { ...prev, [defId]: defErrors };
    });
  }

  function handleEmailChange(defId: string, index: number, value: string) {
    setEmails((prev) => {
      const updated = [...(prev[defId] ?? [''])];
      updated[index] = value;
      return { ...prev, [defId]: updated };
    });
    clearEmailError(defId, index);
    setSaveSuccess(false);
  }

  function handleAddEmail(defId: string) {
    setEmails((prev) => ({ ...prev, [defId]: [...(prev[defId] ?? ['']), ''] }));
    setEmailKeys((prev) => ({ ...prev, [defId]: [...(prev[defId] ?? []), crypto.randomUUID()] }));
    setEmailErrors((prev) => ({ ...prev, [defId]: [...(prev[defId] ?? []), null] }));
    setSaveSuccess(false);
  }

  async function handleSave() {
    const { errors, hasErrors } = validateAllEmails(emails);
    setEmailErrors(errors);

    if (hasErrors) {
      setSaveSuccess(false);
      return;
    }
    setApiError(null);

    try {
      for (const def of NOTIFICATION_ROUTING_DEFINITIONS) {
        const addrs = (emails[def.id] ?? ['']).map((a) => a.trim()).filter(Boolean);
        const existingRecord = records.find((r) => r.id === def.id);
        const existingAddrs = existingRecord?.recipientAddresses ?? [];
        const unchanged =
          addrs.length === existingAddrs.length && addrs.every((a, i) => a === existingAddrs[i]);
        if (!unchanged) {
          await Api2.updateNotificationRouting(def.id, {
            recipientAddresses: addrs,
          });
        }
      }
      const reloadSucceeded = await loadData();
      setSaveSuccess(reloadSucceeded);
    } catch (error) {
      setApiError((error as Error).message);
    }
  }

  return (
    <div className="notification-routing-admin-panel" data-testid="notification-routing-panel">
      <h2>Notification Routing</h2>
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
          {apiError && (
            <div className="usa-error-message margin-bottom-2" data-testid="routing-form-errors">
              <p>{apiError}</p>
            </div>
          )}
          {saveSuccess && (
            <Alert
              id="routing-save-success"
              message="Notification routing saved successfully."
              type={UswdsAlertStyle.Success}
              show={true}
              timeout={5}
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
              {(emails[def.id] ?? ['']).map((addr, index) => {
                const inputId =
                  index === 0 ? `routing-email-${def.id}` : `routing-email-${def.id}-${index}`;
                const errorId = `routing-email-error-${def.id}-${index}`;
                const hasError = !!emailErrors[def.id]?.[index];
                return (
                  <div key={emailKeys[def.id]?.[index] ?? index}>
                    <input
                      className={`usa-input${index > 0 ? ' routing-email-additional' : ''}${hasError ? ' usa-input--error' : ''}`}
                      id={inputId}
                      data-testid={inputId}
                      type="email"
                      value={addr}
                      onChange={(e) => handleEmailChange(def.id, index, e.target.value)}
                      aria-describedby={hasError ? errorId : undefined}
                      aria-invalid={hasError ? true : undefined}
                    />
                    {hasError && (
                      <span
                        className="usa-error-message"
                        id={errorId}
                        data-testid={errorId}
                        role="alert"
                      >
                        {emailErrors[def.id][index]}
                      </span>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className="usa-button usa-button--unstyled routing-add-email-button"
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
