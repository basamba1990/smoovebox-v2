import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-md hover:shadow-lg hover:from-primary-700 hover:to-secondary-700 active:scale-95",
        destructive: "bg-gradient-to-r from-error-500 to-error-600 text-white shadow-md hover:shadow-lg hover:from-error-600 hover:to-error-700 active:scale-95",
        outline: "border-2 border-primary-300 bg-transparent text-primary-700 hover:bg-primary-50 hover:border-primary-400 active:scale-95",
        secondary: "bg-gradient-to-r from-secondary-100 to-secondary-200 text-secondary-900 hover:from-secondary-200 hover:to-secondary-300 active:scale-95",
        ghost: "text-primary-700 hover:bg-primary-50 hover:text-primary-800 active:scale-95",
        link: "text-primary-600 underline-offset-4 hover:underline hover:text-primary-700",
        success: "bg-gradient-to-r from-success-500 to-success-600 text-white shadow-md hover:shadow-lg hover:from-success-600 hover:to-success-700 active:scale-95",
        warning: "bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-md hover:shadow-lg hover:from-warning-600 hover:to-warning-700 active:scale-95",
        glass: "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 shadow-lg",
        premium: "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-amber-900 shadow-lg hover:shadow-xl hover:from-amber-500 hover:via-yellow-600 hover:to-amber-700 active:scale-95"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12"
      },
      animation: {
        none: "",
        pulse: "animate-pulse",
        bounce: "animate-bounce",
        spin: "animate-spin"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      animation: "none"
    }
  }
);

const Button = React.forwardRef(({ 
  className, 
  variant, 
  size, 
  animation,
  asChild = false, 
  loading = false,
  loadingText = "Chargement...",
  icon,
  iconPosition = "left",
  ripple = true,
  ...props 
}, ref) => {
  const Comp = asChild ? Slot : motion.button;
  const [ripples, setRipples] = React.useState([]);

  const handleClick = (e) => {
    if (ripple && !loading) {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      const newRipple = {
        x,
        y,
        size,
        id: Date.now()
      };
      
      setRipples(prev => [...prev, newRipple]);
      
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
      }, 600);
    }
    
    if (props.onClick && !loading) {
      props.onClick(e);
    }
  };

  const buttonContent = (
    <>
      {/* Ripple effect */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 animate-ping pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            animationDuration: '600ms'
          }}
        />
      ))}
      
      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {loadingText && <span className="text-sm">{loadingText}</span>}
          </div>
        </div>
      )}
      
      {/* Button content */}
      <div className={cn("flex items-center gap-2", loading && "opacity-0")}>
        {icon && iconPosition === "left" && (
          <span className="flex-shrink-0">{icon}</span>
        )}
        {props.children}
        {icon && iconPosition === "right" && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </div>
    </>
  );

  if (asChild) {
    return (
      <Slot
        className={cn(buttonVariants({ variant, size, animation, className }))}
        ref={ref}
        {...props}
        onClick={handleClick}
      >
        {buttonContent}
      </Slot>
    );
  }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, animation, className }))}
      ref={ref}
      disabled={loading || props.disabled}
      whileHover={{ scale: loading ? 1 : 1.02 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
      onClick={handleClick}
    >
      {buttonContent}
    </Comp>
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };

