import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-controlo)] text-base font-bold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:bg-[var(--color-zinco-200)] disabled:text-[var(--color-zinco)] disabled:border-[var(--color-zinco-200)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-cobalto)] text-white hover:bg-[var(--color-cobalto-700)] shadow-none",
        secondary:
          "bg-[var(--color-papel)] text-[var(--color-tinta)] border-2 border-[var(--color-tinta)] hover:bg-gray-50",
        destructive:
          "bg-[var(--color-oxido)] text-white hover:bg-red-800",
        ghost: "hover:bg-[var(--color-cal)] hover:text-[var(--color-tinta)]",
        link: "text-[var(--color-cobalto)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-8 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
