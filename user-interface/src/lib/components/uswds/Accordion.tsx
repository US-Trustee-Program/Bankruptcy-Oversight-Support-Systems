import {
  Children,
  cloneElement,
  FunctionComponent,
  PropsWithChildren,
  ReactElement,
  useEffect,
  useState,
} from 'react';

import './Accordion.scss';

interface AccordionGroupProps extends PropsWithChildren {
  children?: Array<ReactElement> | ReactElement;
}

export const AccordionGroup: FunctionComponent<AccordionGroupProps> = (props) => {
  const [expandedAccordion, setExpandedAccordion] = useState<string>('');

  function expandAccordion(accordionId: string) {
    setExpandedAccordion(accordionId);
  }

  const renderChildren = () => {
    if (!props.children) return;
    return Children.map(props.children, (child) => {
      return cloneElement(child, {
        expandedId: expandedAccordion,
        key: `${child.key}-copy`,
        onExpand: expandAccordion,
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
  ariaDescription?: string;
  children: Array<ReactElement | string>;
  expandedId?: string;
  hidden?: boolean;
  id: string;
  onCollapse?: (id: string) => void;
  onExpand?: (id: string) => void;
}

export const Accordion: FunctionComponent<AccordionProps> = (props) => {
  const { hidden } = props;
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    setExpanded(props.expandedId === props.id);
  }, [props.expandedId]);

  function toggle() {
    setExpanded(!expanded);
    if (props.onExpand) {
      props.onExpand(props.id);
    }
    if (props.onCollapse) {
      props.onCollapse(props.id);
    }
  }

  return (
    <>
      <h4 className="usa-accordion__heading" data-testid={`accordion-${props.id}`} hidden={hidden}>
        <button
          aria-controls={`accordion-${props.id}`}
          aria-expanded={expanded}
          className="usa-accordion__button"
          data-testid={`accordion-button-${props.id}`}
          onClick={toggle}
          type="button"
        >
          {props.children[0]}
        </button>
      </h4>
      <div
        className="usa-accordion__content usa-prose no-overflow"
        data-testid={`accordion-content-${props.id}`}
        hidden={!!hidden || !expanded}
        id={`accordion-${props.id}`}
      >
        {props.children[1]}
      </div>
    </>
  );
};
