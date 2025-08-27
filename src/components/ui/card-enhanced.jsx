import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { cva } from 'class-variance-authority';

const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border shadow-md hover:shadow-lg",
        elevated: "border-border shadow-lg hover:shadow-xl",
        glass: "bg-white/10 backdrop-blur-md border-white/20 shadow-lg",
        gradient: "bg-gradient-to-br from-primary-50 to-secondary-50 border-primary-200 shadow-md hover:shadow-lg",
        outline: "border-2 border-primary-200 bg-transparent hover:border-primary-300 hover:bg-primary-50/50",
        success: "border-success-200 bg-success-50 shadow-md",
        warning: "border-warning-200 bg-warning-50 shadow-md",
        error: "border-error-200 bg-error-50 shadow-md"
      },
      size: {
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
        xl: "p-10"
      },
      hover: {
        none: "",
        lift: "hover:-translate-y-1",
        scale: "hover:scale-[1.02]",
        glow: "hover:shadow-colored"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      hover: "lift"
    }
  }
);

const Card = React.forwardRef(({ 
  className, 
  variant, 
  size, 
  hover,
  animated = true,
  children,
  ...props 
}, ref) => {
  const cardContent = (
    <div
      className={cn(cardVariants({ variant, size, hover, className }))}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={hover === "scale" ? { scale: 1.02 } : {}}
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
});

Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </h3>
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// Composants spécialisés
const StatsCard = React.forwardRef(({ 
  title, 
  value, 
  description, 
  icon, 
  trend,
  trendValue,
  className,
  ...props 
}, ref) => (
  <Card ref={ref} variant="elevated" hover="glow" className={cn("relative overflow-hidden", className)} {...props}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      {icon && (
        <div className="h-4 w-4 text-muted-foreground">
          {icon}
        </div>
      )}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      )}
      {trend && trendValue && (
        <div className={cn(
          "flex items-center text-xs mt-2",
          trend === "up" ? "text-success-600" : trend === "down" ? "text-error-600" : "text-muted-foreground"
        )}>
          <span className="font-medium">{trendValue}</span>
          <span className="ml-1">par rapport au mois dernier</span>
        </div>
      )}
    </CardContent>
    
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary-50/20 pointer-events-none" />
  </Card>
));
StatsCard.displayName = "StatsCard";

const FeatureCard = React.forwardRef(({ 
  title, 
  description, 
  icon, 
  action,
  className,
  ...props 
}, ref) => (
  <Card ref={ref} variant="gradient" hover="lift" className={cn("text-center", className)} {...props}>
    <CardHeader>
      {icon && (
        <div className="mx-auto h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center mb-4">
          <div className="h-6 w-6 text-primary-600">
            {icon}
          </div>
        </div>
      )}
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-center">
        {description}
      </CardDescription>
    </CardContent>
    {action && (
      <CardFooter className="justify-center">
        {action}
      </CardFooter>
    )}
  </Card>
));
FeatureCard.displayName = "FeatureCard";

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  StatsCard,
  FeatureCard,
  cardVariants
};

