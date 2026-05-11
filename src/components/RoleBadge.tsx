import { Role, ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown, Star, Leaf, BadgeCheck, ShieldCheck } from "lucide-react";

interface RoleBadgeProps {
  role?: Role;
  variant?: "card" | "profile";
  className?: string;
}

const roleConfig: Record<Role, { icon: typeof Crown; colors: string; iconColor: string }> = {
  founder: {
    icon: Crown,
    colors: "bg-[hsl(38,80%,92%)] text-[hsl(38,70%,30%)] border-[hsl(38,70%,75%)]",
    iconColor: "text-[hsl(38,80%,45%)]",
  },
  admin: {
    icon: ShieldCheck,
    colors: "bg-[hsl(260,50%,92%)] text-[hsl(260,50%,30%)] border-[hsl(260,45%,75%)]",
    iconColor: "text-[hsl(260,50%,45%)]",
  },
  early_adopter: {
    icon: Star,
    colors: "bg-[hsl(140,50%,90%)] text-[hsl(140,50%,28%)] border-[hsl(140,45%,72%)]",
    iconColor: "text-[hsl(140,50%,38%)]",
  },
  contributor: {
    icon: Star,
    colors: "bg-[hsl(140,50%,85%)] text-[hsl(140,50%,25%)] border-[hsl(140,45%,65%)]",
    iconColor: "text-[hsl(140,50%,35%)]",
  },
  writer: {
    icon: Leaf,
    colors: "bg-[hsl(220,50%,92%)] text-[hsl(220,50%,30%)] border-[hsl(220,45%,75%)]",
    iconColor: "text-[hsl(220,50%,45%)]",
  },
  inner_circle: {
    icon: BadgeCheck,
    colors: "bg-[hsl(45,80%,92%)] text-[hsl(45,60%,30%)] border-[hsl(45,70%,75%)]",
    iconColor: "text-[hsl(45,90%,50%)]",
  },
};

const RoleBadge = ({ role, variant = "card", className }: RoleBadgeProps) => {
  if (!role) return null;
  const config = roleConfig[role];
  if (!config) return null;
  const Icon = config.icon;

  if (variant === "card") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
          config.colors,
          className
        )}
      >
        <Icon className={cn("h-2.5 w-2.5", config.iconColor)} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        config.colors,
        className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", config.iconColor)} />
      {ROLE_LABELS[role]}
    </span>
  );
};

export default RoleBadge;
