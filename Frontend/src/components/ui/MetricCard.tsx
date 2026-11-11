import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const MetricCard = ({ title, subtitle, children, className, delay = 0 }: MetricCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "group relative flex flex-col bg-card border border-border p-6 overflow-hidden",
        "hover:border-foreground/30 transition-colors duration-300",
        className
      )}
    >
      {/* Technical corner markers */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground/60 font-mono mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="flex-1">
        {children}
      </div>
    </motion.div>
  );
};
