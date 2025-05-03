import Button, { UswdsButtonState, UswdsButtonStyle } from './Button';

export const UswdsButtonExamples = () => {
  return (
    <>
      <Button>Default Button</Button>
      <br />
      <br />
      <br />
      <Button buttonState={UswdsButtonState.Default} uswdsStyle={UswdsButtonStyle.Default}>
        Default Style
      </Button>
      <Button buttonState={UswdsButtonState.Active} uswdsStyle={UswdsButtonStyle.Default}>
        Default Active
      </Button>
      <Button buttonState={UswdsButtonState.Hover} uswdsStyle={UswdsButtonStyle.Default}>
        Default Hover
      </Button>
      <Button buttonState={UswdsButtonState.Focus} uswdsStyle={UswdsButtonStyle.Default}>
        Default Focus
      </Button>
      <Button buttonState={UswdsButtonState.Active} disabled uswdsStyle={UswdsButtonStyle.Default}>
        Default Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button buttonState={UswdsButtonState.Default} uswdsStyle={UswdsButtonStyle.Secondary}>
        Secondary
      </Button>
      <Button buttonState={UswdsButtonState.Active} uswdsStyle={UswdsButtonStyle.Secondary}>
        Secondary Active
      </Button>
      <Button buttonState={UswdsButtonState.Hover} uswdsStyle={UswdsButtonStyle.Secondary}>
        Secondary Hover
      </Button>
      <Button buttonState={UswdsButtonState.Focus} uswdsStyle={UswdsButtonStyle.Secondary}>
        Secondary Focus
      </Button>
      <Button disabled uswdsStyle={UswdsButtonStyle.Secondary}>
        Secondary Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button buttonState={UswdsButtonState.Default} uswdsStyle={UswdsButtonStyle.Cool}>
        Cool
      </Button>
      <Button buttonState={UswdsButtonState.Active} uswdsStyle={UswdsButtonStyle.Cool}>
        Cool Active
      </Button>
      <Button buttonState={UswdsButtonState.Hover} uswdsStyle={UswdsButtonStyle.Cool}>
        Cool Hover
      </Button>
      <Button buttonState={UswdsButtonState.Focus} uswdsStyle={UswdsButtonStyle.Cool}>
        Cool Focus
      </Button>
      <Button disabled uswdsStyle={UswdsButtonStyle.Cool}>
        Cool Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button buttonState={UswdsButtonState.Default} uswdsStyle={UswdsButtonStyle.Warm}>
        Warm
      </Button>
      <Button buttonState={UswdsButtonState.Active} uswdsStyle={UswdsButtonStyle.Warm}>
        Warm Active
      </Button>
      <Button buttonState={UswdsButtonState.Hover} uswdsStyle={UswdsButtonStyle.Warm}>
        Warm Hover
      </Button>
      <Button buttonState={UswdsButtonState.Focus} uswdsStyle={UswdsButtonStyle.Warm}>
        Warm Focus
      </Button>
      <Button disabled uswdsStyle={UswdsButtonStyle.Warm}>
        Warm Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button buttonState={UswdsButtonState.Default} uswdsStyle={UswdsButtonStyle.Base}>
        Base
      </Button>
      <Button buttonState={UswdsButtonState.Active} uswdsStyle={UswdsButtonStyle.Base}>
        Base Active
      </Button>
      <Button buttonState={UswdsButtonState.Hover} uswdsStyle={UswdsButtonStyle.Base}>
        Base Hover
      </Button>
      <Button buttonState={UswdsButtonState.Focus} uswdsStyle={UswdsButtonStyle.Base}>
        Base Focus
      </Button>
      <Button disabled uswdsStyle={UswdsButtonStyle.Base}>
        Base Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button buttonState={UswdsButtonState.Default} uswdsStyle={UswdsButtonStyle.Outline}>
        Outline
      </Button>
      <Button buttonState={UswdsButtonState.Active} uswdsStyle={UswdsButtonStyle.Outline}>
        Outline Active
      </Button>
      <Button buttonState={UswdsButtonState.Hover} uswdsStyle={UswdsButtonStyle.Outline}>
        Outline Hover
      </Button>
      <Button buttonState={UswdsButtonState.Focus} uswdsStyle={UswdsButtonStyle.Outline}>
        Outline Focus
      </Button>
      <Button disabled uswdsStyle={UswdsButtonStyle.Outline}>
        Outline Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button buttonState={UswdsButtonState.Default} uswdsStyle={UswdsButtonStyle.Inverse}>
        Inverse
      </Button>
      <Button buttonState={UswdsButtonState.Active} uswdsStyle={UswdsButtonStyle.Inverse}>
        Inverse Active
      </Button>
      <Button buttonState={UswdsButtonState.Hover} uswdsStyle={UswdsButtonStyle.Inverse}>
        Inverse Hover
      </Button>
      <Button buttonState={UswdsButtonState.Focus} uswdsStyle={UswdsButtonStyle.Inverse}>
        Inverse Focus
      </Button>
      <Button disabled uswdsStyle={UswdsButtonStyle.Inverse}>
        Inverse Disabled
      </Button>
      <br />
    </>
  );
};
