import './TrusteeOtherInfoForm.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import Input from '@/lib/components/uswds/Input';
import useApi2 from '@/lib/hooks/UseApi2';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { useState } from 'react';

type TrusteeOtherInfoFormProps = {
  trusteeId: string;
  banks?: string[];
};

function TrusteeOtherInfoForm(props: Readonly<TrusteeOtherInfoFormProps>) {
  const api = useApi2();
  const globalAlert = useGlobalAlert();
  const { trusteeId } = props;
  const initialBanks = props.banks?.filter((b) => b.trim() !== '') ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState<string[]>(initialBanks.length > 0 ? initialBanks : ['']);

  const navigate = useCamsNavigator();

  const handleBankChange = (index: number, value: string) => {
    const newBanks = [...banks];
    if (index < newBanks.length) {
      newBanks[index] = value;
      setBanks(newBanks);
    }
  };

  const handleBankRemove = (index: number) => {
    return (_: React.MouseEvent<HTMLButtonElement>) => {
      setBanks((current) => {
        const updated = [...current];
        updated.splice(index, 1);
        return updated;
      });
    };
  };

  const handleBankAdd = () => {
    setBanks((current) => {
      return [...current, ''];
    });
  };

  async function handleSubmit(event?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (event) {
      event.preventDefault();
    }
    setIsSubmitting(true);
    try {
      const response = await api.patchTrustee(trusteeId || '', {
        banks: banks.filter((bank) => bank.trim() !== ''),
      });
      if (response?.data) {
        navigate.navigateTo(`/trustees/${trusteeId}`, { trustee: response.data });
      }
    } catch (e) {
      globalAlert?.error(`Failed to update trustee banks: ${(e as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel(_event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }

  return (
    <div className="trustee-other-info-form-screen">
      <div className="form-header">
        <h1 className="text-no-wrap display-inline-block margin-right-1">Edit Other Information</h1>
      </div>
      <form data-testid="trustee-other-info-form">
        <div className="form-container">
          <div className="form-column">
            {banks.map((bank, index) => {
              return (
                <div className="field-group" key={`bank-${index}`}>
                  <Input
                    id={`trustee-banks-${index}`}
                    className="trustee-bank-input"
                    name={`bank-${index}`}
                    value={bank}
                    label="Bank"
                    onChange={(e) => handleBankChange(index, e.target.value)}
                    autoComplete="off"
                  />
                  {index > 0 && (
                    <Button
                      className="remove-bank-button"
                      uswdsStyle={UswdsButtonStyle.Unstyled}
                      onClick={handleBankRemove(index)}
                    >
                      <Icon name="cancel" />
                      Remove Bank
                    </Button>
                  )}
                </div>
              );
            })}
            <Button
              className="add-bank-button"
              onClick={handleBankAdd}
              uswdsStyle={UswdsButtonStyle.Unstyled}
            >
              <Icon name="add_circle" />
              Add another bank
            </Button>
          </div>
        </div>
        <div className="usa-button-group">
          <Button id="submit-button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            className="unstyled-button"
            type="button"
            onClick={handleCancel}
            uswdsStyle={UswdsButtonStyle.Unstyled}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default TrusteeOtherInfoForm;
