import { cn } from "@/lib/utils";

export function VCard({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-white border border-[#E2E8F0] rounded-[10px] p-5", className)} {...props}>
      {children}
    </div>
  );
}
