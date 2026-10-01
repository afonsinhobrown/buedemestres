"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { WarningCircle } from "@phosphor-icons/react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, id, ...props }, ref) => {
    // Se não houver id, mas houver label, seria bom um auto-id, mas deixaremos ao cargo de quem usa.
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-tinta)]">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            "flex h-[52px] w-full rounded-[var(--radius-controlo)] border bg-[var(--color-papel)] px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-zinco)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            error 
              ? "border-[var(--color-oxido)] focus-visible:border-[var(--color-oxido)]" 
              : "border-[var(--color-zinco-200)] focus-visible:border-[var(--color-tinta)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-[var(--color-oxido)] mt-1">
            <WarningCircle size={16} weight="bold" />
            <span className="font-medium">{error}</span>
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
