import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import {
  useNotifications,
  useHasUnseenNotifications,
  useMarkNotificationsSeen,
  type NotificationRow,
} from "@/hooks/useNotifications";
import highfiveDefault from "@/assets/highfive-default.png";
import { BadgeCheck, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const NotificationItem = ({
  n,
  onNavigate,
}: {
  n: NotificationRow;
  onNavigate?: () => void;
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (n.story_id) navigate(`/story/${n.story_id}`);
    onNavigate?.();
  };

  let icon: JSX.Element;
  let text: JSX.Element;

  if (n.type === "greeting") {
    icon = (
      <img
        src={highfiveDefault}
        alt=""
        className="h-5 w-5 object-contain flex-shrink-0 dark:invert mt-0.5"
      />
    );
    text = (
      <>
        <span className="font-medium text-foreground">{n.count}</span>{" "}
        Respectful Greeting{n.count > 1 ? "s" : ""} on{" "}
        <span className="font-medium text-foreground">
          {n.story?.title || "your story"}
        </span>
      </>
    );
  } else if (n.type === "achievement") {
    icon = n.badge?.image_url ? (
      <img
        src={n.badge.image_url}
        alt=""
        className="h-5 w-5 object-contain flex-shrink-0 mt-0.5"
      />
    ) : (
      <BadgeCheck className="h-5 w-5 flex-shrink-0 text-[hsl(45,90%,50%)] mt-0.5" />
    );
    text = (
      <>
        New badge unlocked:{" "}
        <span className="font-medium text-foreground">
          {n.badge?.title || "Achievement"}
        </span>
      </>
    );
  } else {
    icon = <Eye className="h-5 w-5 flex-shrink-0 text-muted-foreground mt-0.5" />;
    text = (
      <>
        <span className="font-medium text-foreground">
          {n.milestone_value?.toLocaleString()}
        </span>{" "}
        views milestone on{" "}
        <span className="font-medium text-foreground">
          {n.story?.title || "your story"}
        </span>
      </>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50"
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="leading-snug">{text}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { data: hasUnseen } = useHasUnseenNotifications();
  const { data: notifs } = useNotifications(8);
  const markSeen = useMarkNotificationsSeen();

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && hasUnseen) markSeen.mutate();
  };

  const items = notifs || [];

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center justify-center rounded-full p-1 transition-colors hover:text-foreground ${
            hasUnseen ? "text-foreground" : "text-muted-foreground"
          }`}
          aria-label="Notifications"
        >
          <Bell
            className="w-[15px] h-[15px]"
            fill={hasUnseen ? "currentColor" : "none"}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-4 py-2.5 border-b border-border/50">
          <p className="text-xs font-medium text-foreground">Notifications</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            items.map((n) => (
              <NotificationItem key={n.id} n={n} onNavigate={() => setOpen(false)} />
            ))
          )}
        </div>
        <div className="border-t border-border/50">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block w-full px-4 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
          >
            View all
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
