import Button, { UswdsButtonState, UswdsButtonStyle } from './Button';

export const UswdsButtonExamples = () => {
  return (
    <>
      <Button>Default Button</Button>
      <br />
      <br />
      <br />
      <Button uswdsStyle={UswdsButtonStyle.Default} buttonState={UswdsButtonState.Default}>
        Default Style
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Default} buttonState={UswdsButtonState.Active}>
        Default Active
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Default} buttonState={UswdsButtonState.Hover}>
        Default Hover
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Default} buttonState={UswdsButtonState.Focus}>
        Default Focus
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Default} buttonState={UswdsButtonState.Active} disabled>
        Default Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button uswdsStyle={UswdsButtonStyle.Secondary} buttonState={UswdsButtonState.Default}>
        Secondary
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Secondary} buttonState={UswdsButtonState.Active}>
        Secondary Active
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Secondary} buttonState={UswdsButtonState.Hover}>
        Secondary Hover
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Secondary} buttonState={UswdsButtonState.Focus}>
        Secondary Focus
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Secondary} disabled>
        Secondary Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button uswdsStyle={UswdsButtonStyle.Cool} buttonState={UswdsButtonState.Default}>
        Cool
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Cool} buttonState={UswdsButtonState.Active}>
        Cool Active
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Cool} buttonState={UswdsButtonState.Hover}>
        Cool Hover
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Cool} buttonState={UswdsButtonState.Focus}>
        Cool Focus
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Cool} disabled>
        Cool Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button uswdsStyle={UswdsButtonStyle.Warm} buttonState={UswdsButtonState.Default}>
        Warm
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Warm} buttonState={UswdsButtonState.Active}>
        Warm Active
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Warm} buttonState={UswdsButtonState.Hover}>
        Warm Hover
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Warm} buttonState={UswdsButtonState.Focus}>
        Warm Focus
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Warm} disabled>
        Warm Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button uswdsStyle={UswdsButtonStyle.Base} buttonState={UswdsButtonState.Default}>
        Base
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Base} buttonState={UswdsButtonState.Active}>
        Base Active
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Base} buttonState={UswdsButtonState.Hover}>
        Base Hover
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Base} buttonState={UswdsButtonState.Focus}>
        Base Focus
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Base} disabled>
        Base Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button uswdsStyle={UswdsButtonStyle.Outline} buttonState={UswdsButtonState.Default}>
        Outline
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Outline} buttonState={UswdsButtonState.Active}>
        Outline Active
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Outline} buttonState={UswdsButtonState.Hover}>
        Outline Hover
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Outline} buttonState={UswdsButtonState.Focus}>
        Outline Focus
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Outline} disabled>
        Outline Disabled
      </Button>
      <br />
      <br />
      <br />
      <Button uswdsStyle={UswdsButtonStyle.Inverse} buttonState={UswdsButtonState.Default}>
        Inverse
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Inverse} buttonState={UswdsButtonState.Active}>
        Inverse Active
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Inverse} buttonState={UswdsButtonState.Hover}>
        Inverse Hover
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Inverse} buttonState={UswdsButtonState.Focus}>
        Inverse Focus
      </Button>
      <Button uswdsStyle={UswdsButtonStyle.Inverse} disabled>
        Inverse Disabled
      </Button>
      <br />
    </>
  );
};
