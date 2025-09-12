import TrusteeForm, { SubmissionResult } from '@/trustees/TrusteeForm';
import { useLocation } from 'react-router-dom';
import { TrusteeFormData } from '@/trustees/UseTrusteeFormValidation.types';

export default function TrusteeEditInternal() {
  const location = useLocation();

  const submit = async (_formData: TrusteeFormData): Promise<SubmissionResult> => {
    return { success: false, message: 'Not implemented.' };
  };

  return (
    <TrusteeForm
      trustee={location.state.trustee}
      cancelTo={location.state.cancelTo}
      action="edit"
      contactInformation="internal"
      onSubmit={submit}
    ></TrusteeForm>
  );
}
