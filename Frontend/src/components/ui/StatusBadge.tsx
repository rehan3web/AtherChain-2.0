import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border",
  {
    variants: {
      status: {
        completed: "bg-green-500/10 text-green-500 border-green-500/20",
        pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        failed: "bg-red-500/10 text-red-500 border-red-500/20",
        processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      },
    },
    defaultVariants: {
      status: "pending",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  Omit<VariantProps<typeof statusBadgeVariants>, "status"> {
  status: string;
}

export function StatusBadge({ className, status, ...props }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as any;
  return (
    <span className={cn(statusBadgeVariants({ status: normalizedStatus }), className)} {...props}>
      {status}
    </span>
  );
}
