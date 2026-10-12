import React, { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { motion } from 'motion/react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ title, children, footer }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[20px] p-[18px] shadow-sm border border-gray-100 flex flex-col h-full"
    >
      <h3 className="text-[16px] font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex-1 flex flex-col gap-4">
        {children}
      </div>
      {footer && <div className="mt-6 pt-4 border-t border-gray-50 flex items-center">{footer}</div>}
    </motion.div>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  disabled?: boolean;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const baseClass = "h-[42px] px-5 rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 cursor-pointer";
  
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-emerald-500",
    secondary: "bg-gray-900 text-white hover:bg-gray-800 shadow-sm focus:ring-gray-900",
    ghost: "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-200"
  };

  return (
    <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  className?: string;
  value?: any;
  onChange?: any;
  placeholder?: string;
  type?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[13px] font-medium text-gray-700">{label}</label>
      <input 
        className={`h-10 px-3 w-full rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-gray-400 ${className}`}
        {...props}
      />
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export function Toggle({ label, checked, onChange, description }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div className="flex flex-col">
        <span className="text-[14px] font-medium text-gray-800">{label}</span>
        {description && <span className="text-[12px] text-gray-500 mt-0.5">{description}</span>}
      </div>
      <div className="relative inline-flex items-center">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
        />
        <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-500"></div>
      </div>
    </label>
  );
}
