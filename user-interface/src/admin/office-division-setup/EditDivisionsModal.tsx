import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import PillBox from '@/lib/components/PillBox';
import { DivisionChange, planDivisionChanges } from './office-division-assignments';
import {
  OfficeSetupRow,
  PrototypeDivision,
  formatDivision,
  formatOffice,
  officeKey,
} from './office-division-setup-data';

export type EditDivisionsModalRef = {
  show: (office: OfficeSetupRow) => void;
  hide: () => void;
};

type EditDivisionsModalProps = {
  modalId: string;
  divisions: PrototypeDivision[];
  onSave: (office: OfficeSetupRow, changes: DivisionChange[]) => void;
};

function toOption(division: PrototypeDivision, office: OfficeSetupRow): ComboOption {
  const assignedElsewhere = division.office && officeKey(division.office) !== officeKey(office);
  let note = '';
  if (assignedElsewhere) note = ` - currently ${formatOffice(division.office)}`;
  if (!division.office) note = ' - unassigned';
  return {
    value: division.code,
    label: formatDivision(division) + note,
    selectedLabel: formatDivision(division),
  };
}

export const EditDivisionsModal = forwardRef<EditDivisionsModalRef, EditDivisionsModalProps>(
  function EditDivisionsModal({ modalId, divisions, onSave }, ref) {
    const modalRef = useRef<ModalRefType>(null);
    const divisionPickerRef = useRef<ComboBoxRef>(null);
    const [office, setOffice] = useState<OfficeSetupRow | null>(null);
    const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

    useImperativeHandle(ref, () => ({
      show(officeToEdit: OfficeSetupRow) {
        setOffice(officeToEdit);
        setSelectedCodes(
          divisions
            .filter((d) => d.office && officeKey(d.office) === officeKey(officeToEdit))
            .map((d) => d.code),
        );
        modalRef.current?.show({});
      },
      hide() {
        modalRef.current?.hide();
      },
    }));

    const options = office ? divisions.map((division) => toOption(division, office)) : [];
    const selectedSet = new Set(selectedCodes);
    const selections = options.filter((option) => selectedSet.has(option.value));
    // Already-chosen divisions show as pills, so the picker only offers the rest.
    const addableOptions = options.filter((option) => !selectedSet.has(option.value));

    // The picker adds one division at a time, then resets to its placeholder so the
    // user can type again to add another.
    function handleAddDivision(picked: ComboOption[]) {
      const [option] = picked;
      if (!option) return;
      setSelectedCodes((codes) => [...codes, option.value]);
      divisionPickerRef.current?.clearSelections();
    }

    function close() {
      modalRef.current?.hide();
    }

    function handleSave() {
      if (!office) return;
      const changes = planDivisionChanges(divisions, office, selectedCodes);
      if (changes.length > 0) onSave(office, changes);
      close();
    }

    const actionButtonGroup = {
      modalId,
      modalRef,
      submitButton: {
        label: 'Save',
        onClick: handleSave,
        closeOnClick: false,
      },
      cancelButton: {
        label: 'Cancel',
        onClick: close,
      },
    };

    const content = (
      <div className="edit-divisions-modal__edit">
        <p>
          A division can only belong to one office. Choosing a division that belongs to another
          office moves it here.
        </p>
        <ComboBox
          ref={divisionPickerRef}
          id={`${modalId}-divisions`}
          label="Division(s)"
          ariaLabelPrefix="Division"
          options={addableOptions}
          onUpdateSelection={handleAddDivision}
          multiSelect={false}
          hideClearAllButton={true}
          placeholder="- Select one or more -"
          autoComplete="off"
        />
        <PillBox
          id={`${modalId}-division-pills`}
          className="edit-divisions-modal__pills"
          ariaLabelPrefix="Division"
          wrapPills={true}
          selections={selections.map((option) => ({
            value: option.value,
            label: option.selectedLabel ?? option.label,
          }))}
          onSelectionChange={(updated) => setSelectedCodes(updated.map((o) => o.value))}
        />
      </div>
    );

    return (
      <Modal
        ref={modalRef}
        modalId={modalId}
        className="edit-divisions-modal"
        heading={`Edit Divisions for ${office ? formatOffice(office) : ''}`}
        actionButtonGroup={actionButtonGroup}
        content={content}
      />
    );
  },
);
