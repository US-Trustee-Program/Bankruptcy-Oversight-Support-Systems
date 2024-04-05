import {
  Children,
  PropsWithChildren,
  FunctionComponent,
  ReactElement,
  cloneElement,
  useState,
  useEffect,
} from 'react';
import './Accordion.scss';

interface AccordionGroupProps extends PropsWithChildren {
  children?: ReactElement | Array<ReactElement>;
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
        key: `${child.key}-copy`,
        onExpand: expandAccordion,
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
  children: Array<ReactElement | string>;
  expandedId?: string;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
  hidden?: boolean;
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
          type="button"
          className="usa-accordion__button"
          aria-expanded={expanded}
          aria-controls={`accordion-${props.id}`}
          data-testid={`accordion-button-${props.id}`}
          onClick={toggle}
        >
          {props.children[0]}
        </button>
      </h4>
      <div
        id={`accordion-${props.id}`}
        className="usa-accordion__content usa-prose no-overflow"
        data-testid={`accordion-content-${props.id}`}
        hidden={!!hidden || !expanded}
      >
        {props.children[1]}
      </div>
    </>
  );
};
