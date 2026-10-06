import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';

export interface UseKeyDatesFormShellArgs<TForm> {
  emptyForm: TForm;
  mapDataToForm: (data: TrusteeUpcomingKeyDates) => TForm;
  buildInput: (
    ids: { trusteeId: string; appointmentId: string },
    original: TrusteeUpcomingKeyDates | null,
    form: TForm,
  ) => TrusteeUpcomingKeyDatesInput;
  /** Used in both the load and save failure messages, e.g. 'bond key dates'. */
  errorLabel: string;
  /** Escape hatch for forms that need extra data alongside the key-dates
   *  document before the loading spinner can drop (e.g. PastKeyDatesForm's
   *  fetch of the appointment used to derive which fields to show). Runs in
   *  the same Promise.all as the key-dates fetch, so a rejection here surfaces
   *  through the same load-failure alert and keeps the spinner up until both
   *  settle, exactly as a form fetching both itself would. */
  extraLoad?: () => Promise<void>;
}

export interface UseKeyDatesFormShellResult<TForm> {
  trusteeId: string;
  appointmentId: string;
  isLoading: boolean;
  isSaving: boolean;
  /** Set when the initial GET fails. `original` stays null in that case, same
   *  as the legitimate "no document yet" case, so callers that skip checking
   *  this would silently wipe every field they don't own on save. */
  loadFailed: boolean;
  canManage: boolean;
  form: TForm;
  setForm: Dispatch<SetStateAction<TForm>>;
  original: TrusteeUpcomingKeyDates | null;
  registerFieldError: (id: string, hasError: boolean) => void;
  hasErrorAmong: (ids: string[]) => boolean;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
}

/**
 * Shared load/save/navigate shell for the trustee "key dates" forms: fetches
 * the TrusteeUpcomingKeyDates document, maps it into form-specific state,
 * and wires up the save/cancel/error-alert plumbing every one of these forms
 * duplicated. Each form supplies only its own field shape, mapping, and
 * input-building logic.
 */
export function useKeyDatesFormShell<TForm>(
  args: UseKeyDatesFormShellArgs<TForm>,
): UseKeyDatesFormShellResult<TForm> {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<TForm>(args.emptyForm);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);

  useEffect(() => {
    Promise.all([
      Api2.getUpcomingKeyDates(trusteeId!, appointmentId!),
      args.extraLoad?.() ?? Promise.resolve(),
    ])
      .then(([response]) => {
        const data = response.data;
        setOriginal(data);
        if (data) {
          setForm(args.mapDataToForm(data));
        }
      })
      .catch((err) => {
        setLoadFailed(true);
        globalAlert?.error(`Failed to load ${args.errorLabel}: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
    // Intentionally refetches only when the route params change, not on every
    // render of a new `args` object or `globalAlert` reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, [trusteeId, appointmentId]);

  async function handleSave() {
    setIsSaving(true);
    const input = args.buildInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );
    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save ${args.errorLabel}: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  return {
    trusteeId: trusteeId!,
    appointmentId: appointmentId!,
    isLoading,
    isSaving,
    loadFailed,
    canManage,
    form,
    setForm,
    original,
    registerFieldError,
    hasErrorAmong,
    handleSave,
    handleCancel,
  };
}
