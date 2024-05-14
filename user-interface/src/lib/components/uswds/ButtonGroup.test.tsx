import { fireEvent, render, screen } from '@testing-library/react';
import ButtonGroup, { ButtonGroupProps } from './ButtonGroup';
import Button from './Button';

const buttonGroupId = 'test-button-group';
const buttonGroupCSSClass = 'test-class-name';

describe('tests for USWDS button group', () => {
  function renderWithProps(props?: Partial<ButtonGroupProps>) {
    const defaultProps: ButtonGroupProps = {
      id: buttonGroupId,
      activeButtonId: 'button-1',
      className: buttonGroupCSSClass,
      onButtonClick: (_id: string) => {},
      children: [],
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <div>
        <ButtonGroup {...renderProps} />
      </div>,
    );
  }

  test('should contain supplied class name and id, and render without children if no children are passed', () => {
    renderWithProps();

    const ul = screen.getByTestId(`button-group-${buttonGroupId}`);
    expect(ul).toBeInTheDocument();
    expect(ul).toHaveAttribute('id', buttonGroupId);
    expect(ul).toHaveClass(buttonGroupCSSClass);

    expect(ul.children.length).toBe(0);
  });

  test('should not contain class name or id if none are supplied in props', () => {
    renderWithProps({
      id: '',
      className: '',
    });

    const ul = document.getElementsByClassName('usa-button-group usa-button-group--segmented');
    expect(ul[0]).toBeInTheDocument();
    expect(ul[0].id).toBe('');
    expect(ul[0]).toHaveAttribute('data-testid', 'button-group');
    expect(ul[0].classList.length).toBe(2);
  });

  test('should contain given children and ids set approprietly, and active button has proper class name', () => {
    renderWithProps({
      children: [
        <Button id="button-1" key="button-key-1">
          Button 1
        </Button>,
        <Button id="button-2" key="button-key-2">
          Button 2
        </Button>,
      ],
    });

    const button1 = screen.getByTestId('button-button-1');
    const button2 = screen.getByTestId('button-button-2');

    expect(button1).toHaveAttribute('id', 'button-1');
    expect(button1).toHaveClass('usa-button');
    expect(button1).not.toHaveClass('usa-button--outline');

    expect(button2).toHaveAttribute('id', 'button-2');
    expect(button2).toHaveClass('usa-button');
    expect(button2).toHaveClass('usa-button--outline');
  });

  test('should call individual buttons onClick handlers and onButtonClick of button group if buttons are clicked', () => {
    const buttonGroupOnClick = vi.fn();
    const button1OnClick = vi.fn();
    const button2OnClick = vi.fn();
    renderWithProps({
      onButtonClick: buttonGroupOnClick,
      children: [
        <Button id="button-1" key="button-key-1" onClick={button1OnClick}>
          Button 1
        </Button>,
        <Button id="button-2" key="button-key-2" onClick={button2OnClick}>
          Button 2
        </Button>,
      ],
    });

    const button1 = screen.getByTestId('button-button-1');
    const button2 = screen.getByTestId('button-button-2');

    fireEvent.click(button1);
    fireEvent.click(button2);

    expect(button1OnClick).toHaveBeenCalled();
    expect(button2OnClick).toHaveBeenCalled();
    expect(buttonGroupOnClick).toHaveBeenCalledWith('button-1');
    expect(buttonGroupOnClick).toHaveBeenCalledWith('button-2');
  });

  test('should render children with default ids if no id is supplied', () => {
    renderWithProps({
      children: [<Button key="1">Button 1</Button>, <Button key="2">Button 2</Button>],
    });

    const button1 = document.querySelector(`#${buttonGroupId}-child-0`);
    const button2 = document.querySelector(`#${buttonGroupId}-child-1`);

    expect(button1).toBeInTheDocument();
    expect(button2).toBeInTheDocument();
  });

  test('should render children with supplied class names', () => {
    renderWithProps({
      children: [
        <Button key="1" id="button-1" className="class-1">
          Button 1
        </Button>,
        <Button key="2" id="button-2" className="class-2">
          Button 2
        </Button>,
      ],
    });

    const button1 = screen.getByTestId('button-button-1');
    const button2 = screen.getByTestId('button-button-2');

    expect(button1).toHaveClass('usa-button');
    expect(button1).toHaveClass('class-1');

    expect(button2).toHaveClass('usa-button');
    expect(button2).toHaveClass('class-2');
  });
});
