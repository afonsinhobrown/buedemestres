import React from 'react';

type TradeSignProps = {
  title: string;
  subtitle?: string;
  variant?: 'cobalto' | 'amarelo' | 'oxido' | 'papel';
  size?: 'sm' | 'md' | 'lg';
  rotation?: number; // Para o "tilt" das placas
  className?: string;
  color?: string;
  noTilt?: boolean;
};

export function TradeSign({
  title,
  subtitle,
  variant = 'cobalto',
  size = 'md',
  rotation = 0,
  className = '',
}: TradeSignProps) {
  
  const variantStyles = {
    cobalto: 'bg-cobalto text-white border-white',
    amarelo: 'bg-amarelo text-tinta border-tinta',
    oxido: 'bg-oxido text-white border-white',
    papel: 'bg-papel text-tinta border-cobalto',
  };

  const sizeStyles = {
    sm: 'p-1 px-2 text-xs border-2',
    md: 'p-3 px-4 text-xl border-2',
    lg: 'p-5 px-6 text-3xl border-[3px]',
  };

  return (
    <div 
      className={`inline-block shadow-sm cursor-pointer select-none transition-transform active:scale-95 bg-transparent p-[3px] ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className={`${variantStyles[variant]} rounded-[2px] h-full w-full flex flex-col justify-center items-center text-center ${sizeStyles[size]}`}>
        <span className="display-sign leading-none">{title}</span>
        {subtitle && (
          <span className="display-sign text-[0.6em] leading-none mt-1 opacity-90">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
