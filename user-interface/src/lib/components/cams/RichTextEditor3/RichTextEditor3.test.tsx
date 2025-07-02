import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import RichTextEditor3 from './RichTextEditor3';
import type { RichTextEditor3Ref } from './types';

describe('RichTextEditor3', () => {
  it('renders without props', () => {
    render(<RichTextEditor3 />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with id prop', () => {
    render(<RichTextEditor3 id="test-editor" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('id', 'test-editor');
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
    expect(label).toHaveClass('rich-text-editor3__label');
    expect(label).toHaveClass('required');
  });

  it('does not apply required class to label when required is false', () => {
    render(<RichTextEditor3 label="Optional Field" required={false} id="test-editor" />);
    const label = screen.getByText('Optional Field');
    expect(label).toHaveClass('rich-text-editor3__label');
    expect(label).not.toHaveClass('required');
  });

  describe('ref methods', () => {
    it('exposes getValue method that returns current value', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      expect(ref.current?.getValue()).toBe('');
    });

    it('exposes setValue method that updates the value', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      act(() => {
        ref.current?.setValue('test value');
      });
      expect(ref.current?.getValue()).toBe('test value');

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('test value');
    });

    it('exposes clearValue method that clears the value', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      act(() => {
        ref.current?.setValue('initial value');
      });
      expect(ref.current?.getValue()).toBe('initial value');

      act(() => {
        ref.current?.clearValue();
      });
      expect(ref.current?.getValue()).toBe('');

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('exposes disable method that disables the textarea', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();

      act(() => {
        ref.current?.disable(true);
      });
      expect(textarea).toBeDisabled();

      act(() => {
        ref.current?.disable(false);
      });
      expect(textarea).not.toBeDisabled();
    });

    it('exposes getHtml method that returns current value', () => {
      const ref = React.createRef<RichTextEditor3Ref>();
      render(<RichTextEditor3 ref={ref} />);

      act(() => {
        ref.current?.setValue('test html content');
      });
      expect(ref.current?.getHtml()).toBe('test html content');
    });
  });

  it('has correct displayName', () => {
    expect(RichTextEditor3.displayName).toBe('RichTextEditor3');
  });

  it('renders with proper CSS classes instead of inline styles', () => {
    render(<RichTextEditor3 id="test-editor" />);
    const textarea = screen.getByRole('textbox');
    const container = textarea.parentElement;

    expect(container).toHaveClass('rich-text-editor3');
    expect(textarea).toHaveClass('rich-text-editor3__textarea');
  });

  it('applies proper classes to label', () => {
    render(<RichTextEditor3 label="Test Label" id="test-editor" />);
    const label = screen.getByText('Test Label');

    expect(label).toHaveClass('rich-text-editor3__label');
  });

  it('allows user to type text', () => {
    render(<RichTextEditor3 />);
    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Hello, world!' } });
    expect(textarea).toHaveValue('Hello, world!');
  });

  it('calls onChange when text is typed', () => {
    const mockOnChange = vi.fn();
    render(<RichTextEditor3 onChange={mockOnChange} />);
    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Test input' } });
    expect(mockOnChange).toHaveBeenCalledWith('Test input');
  });

  it('applies required attribute when required is true', () => {
    render(<RichTextEditor3 required={true} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeRequired();
  });
});
