import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

const baseStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.75rem 1rem',
  background: '#2563eb',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 600,
};

export function Button({ children, style, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      style={{
        ...baseStyle,
        opacity: props.disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
