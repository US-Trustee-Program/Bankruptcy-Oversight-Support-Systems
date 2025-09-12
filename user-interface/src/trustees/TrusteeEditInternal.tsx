import TrusteeForm, { SubmissionResult } from '@/trustees/TrusteeForm';
import { useLocation } from 'react-router-dom';
import { TrusteeFormData } from '@/trustees/UseTrusteeFormValidation.types';
import { TrusteeInput } from '@common/cams/trustees';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import useApi2 from '@/lib/hooks/UseApi2';

export default function TrusteeEditInternal() {
  const api = useApi2();
  const location = useLocation();
  const navigate = useCamsNavigator();

  const submit = async (formData: TrusteeFormData): Promise<SubmissionResult> => {
    const result: SubmissionResult = { success: true };
    try {
      const payload: Partial<TrusteeInput> = {
        internal: {
          address: {
            address1: formData.address1,
            ...(formData.address2 && { address2: formData.address2 }),
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            countryCode: 'US',
          },
          phone: { number: formData.phone, extension: formData.extension },
          email: formData.email,
        },
      };

      const response = await api.patchTrustee(location.state.trustee.id, payload);
      const createdId = (response as { data?: { id?: string } })?.data?.id;

      navigate.navigateTo(`/trustees/${createdId}`);
    } catch (e) {
      result.success = false;
      result.message = e instanceof Error ? e.message : 'Could not edit trustee.';
    }
    return result;
  };

  return (
    <TrusteeForm
      trustee={location.state.trustee}
      cancelTo={location.state.cancelTo}
      action="edit"
      contactInformation="internal"
      onSubmit={submit}
      disabledFields={['name']}
      hiddenFields={['districts', 'chapters', 'status']}
    ></TrusteeForm>
  );
}
