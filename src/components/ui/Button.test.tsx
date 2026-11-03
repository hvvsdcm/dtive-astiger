import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Input } from './Input';

describe('Button', () => {
  it('renders a type="button" primary button and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>장바구니 담기</Button>);
    const button = screen.getByRole('button', { name: '장바구니 담기' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('bg-ink');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        저장
      </Button>,
    );
    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies variant and size classes', () => {
    render(
      <Button variant="secondary" size="sm">
        취소
      </Button>,
    );
    const button = screen.getByRole('button', { name: '취소' });
    expect(button.className).toContain('border-ink');
    expect(button.className).toContain('h-9');
  });
});

describe('Input', () => {
  it('links the error message when invalid', () => {
    render(<Input id="email" invalid defaultValue="x" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });
});
