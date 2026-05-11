import { Search, User, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PenLine, LogOut, Shield, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import SearchDialog from "@/components/SearchDialog";
import VerifiedBadge from "@/components/VerifiedBadge";
import NotificationBell from "@/components/NotificationBell";
import { useInnerCircleEnabled } from "@/hooks/useInnerCircle";

const Header = () => {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, profile, isFounder, isAdmin, roles } = useAuth();
  const isInnerCircle = roles.includes("inner_circle");
  const { data: innerCircleEnabled } = useInnerCircleEnabled();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4 my-[20px]">
        <Link to="/read" className="flex items-center">
          <span className="font-serif tracking-tight text-primary font-medium text-xl">Sena (◕ᴗ◕✿)</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Search"
          >
            <Search className="w-[15px] h-[15px]" />
          </button>

          {user && <NotificationBell />}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name} />
                    <AvatarFallback className="text-xs font-medium text-muted-foreground">
                      {profile?.display_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/write")} className="gap-2.5 cursor-pointer py-2.5">
                  <PenLine className="h-4 w-4" /> Write
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/@${profile?.username}`)} className="gap-2.5 cursor-pointer py-2.5">
                  <User className="h-4 w-4" /> Profile
                  {isInnerCircle && (
                    <BadgeCheck className="ml-auto h-4 w-4 text-[hsl(45,90%,50%)] fill-[hsl(45,90%,50%)] stroke-white" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2.5 cursor-pointer py-2.5">
                  <Settings className="h-4 w-4" /> Setting
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/inner-circle")}
                  className="gap-2.5 cursor-pointer py-2.5"
                  disabled={!innerCircleEnabled && !isInnerCircle}
                >
                  <BadgeCheck className={`h-4 w-4 ${innerCircleEnabled || isInnerCircle ? "text-[hsl(45,90%,50%)] fill-[hsl(45,90%,50%)] stroke-white" : "text-muted-foreground"}`} />
                  <span className={innerCircleEnabled || isInnerCircle ? "text-[hsl(45,70%,40%)]" : ""}>
                    Support & Join Inner Circle
                  </span>
                </DropdownMenuItem>
                {(isFounder || isAdmin) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-2.5 cursor-pointer py-2.5">
                      <Shield className="h-4 w-4" /> Admin
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-2.5 cursor-pointer py-2.5 text-muted-foreground">
                  <LogOut className="h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Login
            </Link>
          )}
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
};

export default Header;
