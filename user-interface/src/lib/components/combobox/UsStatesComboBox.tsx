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

function _UsStatesComboBox(props: Omit<ComboBoxProps, 'options'>, ref?: React.Ref<ComboBoxRef>) {
  return (
    <ComboBox
      {...props}
      ref={ref}
      options={usStateOptions}
      singularLabel="state"
      pluralLabel="states"
    />
  );
}

const UsStatesComboBox = _UsStatesComboBox;
export default UsStatesComboBox;
