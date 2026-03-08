import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

interface NotificationBellProps {
  unreadCount?: number;
}

export default function NotificationBell({ unreadCount = 0 }: NotificationBellProps) {
  return (
    <Link to="/agent/notifications" className="relative p-2 -mr-2">
      <Bell className="w-5 h-5 text-muted-foreground" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
