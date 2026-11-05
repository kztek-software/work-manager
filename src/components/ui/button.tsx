import * as React from "react";
import { Button as PrimeButton, type ButtonProps as PrimeButtonProps } from "primereact/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-hover",
        secondary: "bg-surface-2 text-foreground hover:bg-line",
        ghost: "hover:bg-surface-2 text-foreground",
        outline: "border border-line bg-transparent hover:bg-surface-2 text-foreground",
        danger: "bg-accent text-white hover:bg-accent-hover",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8.5 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-8.5 w-8.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(buttonVariants({ variant, size, className }), child.props.className),
        ...props,
      });
    }
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
