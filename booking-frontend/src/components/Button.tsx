import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500',
  };
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
