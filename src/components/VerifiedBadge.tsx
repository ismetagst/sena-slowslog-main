import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

const VerifiedBadge = ({ size = "sm", className }: VerifiedBadgeProps) => {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)}>
          <BadgeCheck className={cn(sizeClass, "text-[hsl(45,90%,50%)] fill-[hsl(45,90%,50%)] stroke-white")} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Inner Circle
      </TooltipContent>
    </Tooltip>
  );
};

export default VerifiedBadge;
