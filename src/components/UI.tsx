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
      className="bg-[#071739] rounded-[20px] p-[18px] shadow-lg shadow-blue-950/40 border border-blue-900/50 flex flex-col h-full text-white"
    >
      <h3 className="text-[16px] font-bold text-white mb-4">{title}</h3>
      <div className="flex-1 flex flex-col gap-4">
        {children}
      </div>
      {footer && <div className="mt-6 pt-4 border-t border-blue-900/50 flex items-center">{footer}</div>}
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
  const baseClass = "h-[42px] px-5 rounded-full font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 cursor-pointer";
  
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-950/50 focus:ring-blue-500 active:scale-95",
    secondary: "bg-[#0B214F] text-blue-200 hover:bg-[#0E2C6B] hover:text-white border border-blue-800/40 shadow-sm focus:ring-blue-500 active:scale-95",
    ghost: "bg-transparent text-blue-300 hover:bg-blue-900/30 hover:text-white focus:ring-blue-400"
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
      <label className="text-[13px] font-semibold text-blue-200/90">{label}</label>
      <input 
        className={`h-10 px-3 w-full rounded-xl border border-blue-900/60 bg-[#040E24] text-white text-sm focus:bg-[#071739] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-blue-300/40 ${className}`}
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
        <span className="text-[14px] font-semibold text-white">{label}</span>
        {description && <span className="text-[12px] text-blue-200/60 mt-0.5">{description}</span>}
      </div>
      <div className="relative inline-flex items-center">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
        />
        <div className="w-10 h-5.5 bg-[#0B214F] border border-blue-800/40 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-400 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600"></div>
      </div>
    </label>
  );
}
