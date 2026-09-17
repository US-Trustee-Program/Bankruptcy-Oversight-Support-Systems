import {
  Children,
  PropsWithChildren,
  FunctionComponent,
  ReactElement,
  cloneElement,
  useState,
} from 'react';
import './Accordion.scss';

interface AccordionGroupProps extends PropsWithChildren {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  children?: ReactElement<any> | Array<ReactElement<any>>;
}

export const AccordionGroup: FunctionComponent<AccordionGroupProps> = (props) => {
  const [expandedAccordion, setExpandedAccordion] = useState<string>('');

  function expandAccordion(accordionId: string) {
    setExpandedAccordion(accordionId);
  }

  function collapseAccordion(accordionId: string) {
    setExpandedAccordion((prev) => (prev === accordionId ? '' : prev));
  }

  const renderChildren = () => {
    if (!props.children) return;
    return Children.map(props.children, (child) => {
      const childOnExpand = child.props.onExpand;
      const childOnCollapse = child.props.onCollapse;
      return cloneElement(child, {
        key: `${child.key}-copy`,
        onExpand: (id: string) => {
          expandAccordion(id);
          if (childOnExpand) childOnExpand(id);
        },
        onCollapse: (id: string) => {
          collapseAccordion(id);
          if (childOnCollapse) childOnCollapse(id);
        },
        expandedId: expandedAccordion,
      });
    });
  };

  return (
    <div className="usa-accordion" data-testid="accordion-group">
      {renderChildren()}
    </div>
  );
};

interface AccordionProps extends PropsWithChildren {
  id: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  children: Array<ReactElement<any> | string>;
  expandedId?: string;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
  hidden?: boolean;
}

export const Accordion: FunctionComponent<AccordionProps> = (props) => {
  const { hidden, id, expandedId, onExpand, onCollapse } = props;
  // Controlled when a parent supplies expandedId at all; expanded is then
  // derived directly from it each render instead of mirrored into local
  // state, so there is exactly one source of truth for the expand state.
  // Uncontrolled (no expandedId ever provided) falls back to local state.
  const isControlled = expandedId !== undefined;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState<boolean>(false);
  const expanded = isControlled ? expandedId === id : uncontrolledExpanded;

  function toggle() {
    const nextExpanded = !expanded;
    if (!isControlled) {
      setUncontrolledExpanded(nextExpanded);
    }
    if (nextExpanded) {
      onExpand?.(id);
    } else {
      onCollapse?.(id);
    }
  }

  return (
    <>
      <h4
        className={`usa-accordion__heading ${expanded ? 'usa-accordion--expanded' : ''}`}
        data-testid={`accordion-${id}`}
        hidden={hidden}
      >
        <button
          type="button"
          className="usa-accordion__button"
          aria-expanded={expanded}
          aria-controls={`accordion-${id}`}
          data-testid={`accordion-button-${id}`}
          onClick={toggle}
        >
          {props.children[0]}
        </button>
      </h4>
      <div
        id={`accordion-${id}`}
        className="usa-accordion__content usa-prose no-overflow"
        data-testid={`accordion-content-${id}`}
        hidden={!!hidden || !expanded}
      >
        {props.children[1]}
      </div>
    </>
  );
};
