import React, { ButtonHTMLAttributes } from 'react';

interface FooProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  happy: string;
}

export class TestFoo extends React.Component<FooProps> {
  render() {
    const { children, ...rest } = this.props;
    return <button {...rest}>{children}</button>;
  }
}

interface ExtendedFooProps extends FooProps {
  newAttribute: string;
}

export class ExtendedFoo extends React.Component<ExtendedFooProps> {
  render() {
    const { newAttribute, children, ...rest } = this.props;
    return (
      <button data-new={newAttribute} {...rest}>
        {children}
      </button>
    );
  }
}
