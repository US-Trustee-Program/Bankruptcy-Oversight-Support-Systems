import './TrusteeOtherInfoForm.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import Input from '@/lib/components/uswds/Input';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import React, { useState } from 'react';

type TrusteeOtherInfoFormProps = {
  trusteeId: string;
  banks?: string[];
  software?: string;
  softwareOptions: ComboOption[];
};

function TrusteeOtherInfoForm(props: Readonly<TrusteeOtherInfoFormProps>) {
  const globalAlert = useGlobalAlert();
  const { trusteeId, softwareOptions } = props;
  const initialBanks = props.banks?.filter((b) => b.trim() !== '') ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState<string[]>(initialBanks.length > 0 ? initialBanks : ['']);
  const [software, setSoftware] = useState<string>(props.software ?? '');

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

  const handleSoftwareChange = (selections: ComboOption[]) => {
    const selectedValue = selections.length > 0 ? selections[0].value : '';
    setSoftware(selectedValue);
  };

  async function handleSubmit(event?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (event) {
      event.preventDefault();
    }

    // Guard clause: prevent submission if trusteeId is missing
    if (!trusteeId || trusteeId.trim() === '') {
      globalAlert?.error('Cannot save trustee information: Trustee ID is missing');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await Api2.patchTrustee(trusteeId, {
        banks: banks.filter((bank) => bank.trim() !== ''),
        software: software || null,
      });
      if (response?.data) {
        navigate.navigateTo(`/trustees/${trusteeId}`);
      }
    } catch (e) {
      globalAlert?.error(`Failed to update trustee information: ${(e as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel(_event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }

  return (
    <div className="trustee-other-info-form-screen">
      <form data-testid="trustee-other-info-form">
        <div className="form-container">
          <div className="form-column">
            {banks.map((bank, index) => {
              return (
                <div className="field-group bank-field" key={`bank-${index}`}>
                  <div className="bank-field-input">
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
                        id={`remove-bank-${index}-button`}
                        className="remove-bank-button"
                        uswdsStyle={UswdsButtonStyle.Unstyled}
                        onClick={handleBankRemove(index)}
                      >
                        Remove bank
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <Button
              id="add-bank-button"
              className="add-bank-button"
              onClick={handleBankAdd}
              uswdsStyle={UswdsButtonStyle.Unstyled}
            >
              <Icon name="add_circle" />
              Add another bank
            </Button>
            <div className="field-group">
              <ComboBox
                id="trustee-software"
                className="trustee-software-input"
                name="software"
                label="Bankruptcy Software"
                options={softwareOptions}
                selections={softwareOptions.filter((option) => option.value === software)}
                onUpdateSelection={handleSoftwareChange}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
        <div className="usa-button-group">
          <Button id="submit-button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            id="cancel-button"
            className="unstyled-button cancel-button"
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
