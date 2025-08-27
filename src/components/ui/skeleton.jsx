import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

const Skeleton = React.forwardRef(({ 
  className, 
  animated = true,
  variant = "default",
  ...props 
}, ref) => {
  const variants = {
    default: "bg-neutral-200 dark:bg-neutral-800",
    light: "bg-neutral-100 dark:bg-neutral-700",
    primary: "bg-primary-100 dark:bg-primary-900",
    text: "bg-neutral-200 dark:bg-neutral-800 rounded-sm",
    circular: "bg-neutral-200 dark:bg-neutral-800 rounded-full",
    card: "bg-neutral-100 dark:bg-neutral-800 rounded-lg"
  };

  const baseClasses = cn(
    "animate-pulse rounded-md",
    variants[variant],
    className
  );

  if (animated) {
    return (
      <motion.div
        ref={ref}
        className={baseClasses}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        {...props}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={baseClasses}
      {...props}
    />
  );
});

Skeleton.displayName = "Skeleton";

// Composants de skeleton prédéfinis
const SkeletonText = ({ 
  lines = 1, 
  className,
  lineClassName,
  ...props 
}) => (
  <div className={cn("space-y-2", className)} {...props}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={cn(
          "h-4",
          i === lines - 1 && lines > 1 ? "w-3/4" : "w-full",
          lineClassName
        )}
      />
    ))}
  </div>
);

const SkeletonCard = ({ 
  showHeader = true,
  showFooter = false,
  className,
  ...props 
}) => (
  <Skeleton variant="card" className={cn("p-6 space-y-4", className)} {...props}>
    {showHeader && (
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
    {showFooter && (
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    )}
  </Skeleton>
);

const SkeletonDashboard = ({ className, ...props }) => (
  <div className={cn("space-y-6", className)} {...props}>
    {/* Header */}
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-12 w-24 rounded-lg" />
    </div>

    {/* Stats cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} showHeader={false} className="p-4" />
      ))}
    </div>

    {/* Chart */}
    <SkeletonCard className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex justify-between items-end h-32 space-x-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1"
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      </div>
    </SkeletonCard>
  </div>
);

export { 
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonDashboard
};
