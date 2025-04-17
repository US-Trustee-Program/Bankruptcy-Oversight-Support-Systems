import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ComboOption } from './combobox/ComboBox';
import { Pill } from './Pill';

export type PillBoxRef = {
  contains: (el: HTMLElement) => boolean;
};

type PillBoxProps = {
  id: string;
  disabled?: boolean;
  ariaLabelPrefix?: string;
  className?: string;
  selections: ComboOption[];
  wrapPills?: boolean;
  onSelectionChange: (selections: ComboOption[]) => void;
};

type PillFocus = {
  shouldFocus: boolean;
  index: number;
};

function _PillBox(props: PillBoxProps, ref: React.Ref<PillBoxRef>) {
  const { onSelectionChange, ariaLabelPrefix, disabled, wrapPills } = props;
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [selections, setSelections] = useState<ComboOption[]>([]);
  const [pillFocus, setPillFocus] = useState<PillFocus>({ shouldFocus: false, index: 0 });

  function onPillClick(value: string) {
    const newSelections: ComboOption[] = [];
    let removedIndex = 0;
    selections.forEach((selection, index) => {
      if (selection.value !== value) {
        newSelections.push(selection);
      } else {
        removedIndex = index;
      }
    });

    if (newSelections.length > 0 && removedIndex > newSelections.length - 1) {
      setPillFocus({ shouldFocus: true, index: removedIndex });
    } else {
      setPillFocus({ shouldFocus: true, index: removedIndex + 1 });
    }

    onSelectionChange(newSelections);
    setSelections(newSelections);
  }

  function contains(el: HTMLElement) {
    let isContained = false;
    const pillBox = document.querySelector(`#${props.id}.pill-container`);
    if (pillBox?.contains(el)) {
      isContained = true;
    }

    return isContained;
  }

  useImperativeHandle(ref, () => ({
    contains,
  }));

  useEffect(() => {
    setSelections(props.selections);
  }, [props.selections]);

  useEffect(() => {
    if (pillFocus.shouldFocus) {
      const targetIndex = pillFocus.index - 1;
      const pill = pillRefs.current[targetIndex];

      if (pill) {
        pill.focus();
      }
    }
  }, [pillFocus]);

  return (
    <div id={props.id} className={`pill-container ${props.className}`} role="list">
      {selections?.map((selection, idx) => (
        <span role="listitem" className="pill-span" key={idx}>
          <Pill
            id={`pill-${props.id}-${idx}`}
            label={selection.label}
            ariaLabelPrefix={ariaLabelPrefix}
            value={selection.value}
            onClick={onPillClick}
            disabled={disabled}
            wrapText={wrapPills}
            ref={(el: HTMLButtonElement | null) => (pillRefs.current[idx] = el)}
          ></Pill>
        </span>
      ))}
    </div>
  );
}

const PillBox = forwardRef(_PillBox);
export default PillBox;
