import React from 'react';
import { render, screen } from '@testing-library/react';
import RichTextEditor3, { RichTextEditor3Ref } from './RichTextEditor3';

describe('RichTextEditor3', () => {
  it('renders without props', () => {
    render(<RichTextEditor3 />);
    expect(
      screen.getByText('RichTextEditor3 - Simple dumb component (does nothing for now)'),
    ).toBeInTheDocument();
  });

  it('renders with id prop', () => {
    render(<RichTextEditor3 id="test-editor" />);
    const editorDiv = screen.getByText(
      'RichTextEditor3 - Simple dumb component (does nothing for now)',
    ).parentElement;
    expect(editorDiv).toHaveAttribute('id', 'test-editor');
  });

  it('renders label when provided', () => {
    render(<RichTextEditor3 label="Test Label" id="test-editor" />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
    const label = screen.getByText('Test Label');
    expect(label).toHaveAttribute('for', 'test-editor');
  });

  it('renders required label with asterisk when required is true', () => {
    render(<RichTextEditor3 label="Required Field" required={true} id="test-editor" />);
    expect(screen.getByText('Required Field *')).toBeInTheDocument();
    const label = screen.getByText('Required Field *');
    expect(label).toHaveAttribute('for', 'test-editor');
  });

  it('renders label without asterisk when required is false', () => {
    render(<RichTextEditor3 label="Optional Field" required={false} id="test-editor" />);
    expect(screen.getByText('Optional Field')).toBeInTheDocument();
    expect(screen.queryByText('Optional Field *')).not.toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    render(<RichTextEditor3 id="test-editor" />);
    expect(screen.queryByRole('label')).not.toBeInTheDocument();
  });

  it('applies required class to label when required is true', () => {
    render(<RichTextEditor3 label="Required Field" required={true} id="test-editor" />);
    const label = screen.getByText('Required Field *');
    expect(label).toHaveClass('required');
  });

  it('does not apply required class to label when required is false', () => {
    render(<RichTextEditor3 label="Optional Field" required={false} id="test-editor" />);
    const label = screen.getByText('Optional Field');
    expect(label).not.toHaveClass('required');
  });

  describe('ref methods', () => {
    it('exposes getValue method that returns empty string', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      expect(ref.current?.getValue()).toBe('');
    });

    it('exposes setValue method that does nothing', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      // Should not throw error when called
      expect(() => ref.current?.setValue('test value')).not.toThrow();
    });

    it('exposes clearValue method that does nothing', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      // Should not throw error when called
      expect(() => ref.current?.clearValue()).not.toThrow();
    });

    it('exposes disable method that does nothing', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      // Should not throw error when called
      expect(() => ref.current?.disable(true)).not.toThrow();
      expect(() => ref.current?.disable(false)).not.toThrow();
    });

    it('exposes getHtml method that returns empty string', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      expect(ref.current?.getHtml()).toBe('');
    });
  });

  it('has correct displayName', () => {
    expect(RichTextEditor3.displayName).toBe('RichTextEditor3');
  });

  it('renders with proper styling', () => {
    render(<RichTextEditor3 id="test-editor" />);
    const editorDiv = screen.getByText(
      'RichTextEditor3 - Simple dumb component (does nothing for now)',
    ).parentElement;

    expect(editorDiv).toHaveStyle({
      border: '1px solid #ccc',
      padding: '8px',
      minHeight: '100px',
    });
  });
});
