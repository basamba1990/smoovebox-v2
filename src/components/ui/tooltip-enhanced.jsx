import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(({ 
  className, 
  sideOffset = 4, 
  variant = "default",
  size = "default",
  animated = true,
  ...props 
}, ref) => {
  const variants = {
    default: "bg-neutral-900 text-neutral-50 border-neutral-800",
    light: "bg-white text-neutral-900 border-neutral-200 shadow-lg",
    primary: "bg-primary-600 text-white border-primary-700",
    success: "bg-success-600 text-white border-success-700",
    warning: "bg-warning-600 text-white border-warning-700",
    error: "bg-error-600 text-white border-error-700"
  };

  const sizes = {
    sm: "px-2 py-1 text-xs",
    default: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  };

  const content = (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-lg border px-3 py-1.5 text-sm shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );

  if (animated) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          transition={{ duration: 0.15 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  return content;
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Composant wrapper simplifié
const TooltipWrapper = ({ 
  children, 
  content, 
  side = "top", 
  variant = "default",
  size = "default",
  disabled = false,
  delayDuration = 300,
  ...props 
}) => {
  if (disabled || !content) {
    return children;
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          variant={variant} 
          size={size}
          {...props}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Tooltip avec icône d'aide
const HelpTooltip = ({ 
  content, 
  className,
  iconClassName,
  ...props 
}) => (
  <TooltipWrapper content={content} {...props}>
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-200 text-neutral-600 hover:bg-neutral-300 transition-colors",
        className
      )}
    >
      <svg
        className={cn("w-3 h-3", iconClassName)}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </button>
  </TooltipWrapper>
);

// Tooltip pour les boutons d'action
const ActionTooltip = ({ 
  children, 
  content, 
  shortcut,
  ...props 
}) => {
  const tooltipContent = (
    <div className="flex flex-col gap-1">
      <span>{content}</span>
      {shortcut && (
        <span className="text-xs opacity-75 font-mono">
          {shortcut}
        </span>
      )}
    </div>
  );

  return (
    <TooltipWrapper content={tooltipContent} {...props}>
      {children}
    </TooltipWrapper>
  );
};

export { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent, 
  TooltipProvider,
  TooltipWrapper,
  HelpTooltip,
  ActionTooltip
};

