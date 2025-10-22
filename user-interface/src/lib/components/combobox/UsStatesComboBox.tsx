import React from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { usStates } from '@common/cams/us-states';

const usStateOptions: ComboOption[] = usStates.map((state) => {
  return {
    label: `${state.code} - ${state.name}`,
    value: state.code,
  };
});

function UsStatesComboBox_(
  props: Omit<ComboBoxProps, 'options' | 'selections'> & { selections: string[] },
  ref?: React.Ref<ComboBoxRef>,
) {
  const selections = (props.selections ?? []).reduce((acc, selection) => {
    const option = usStateOptions.find((option) => option.value === selection);
    if (option) {
      acc.push(option);
    }
    return acc;
  }, [] as ComboOption[]);

  return (
    <ComboBox
      {...props}
      ref={ref}
      options={usStateOptions}
      selections={selections.length > 0 ? selections : undefined}
      singularLabel="state"
      pluralLabel="states"
      errorMessage={props.errorMessage}
    />
  );
}

const UsStatesComboBox = UsStatesComboBox_;
export default UsStatesComboBox;
