import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import {
  useNotifications,
  useDeleteNotification,
} from "@/hooks/useNotifications";
import { NotificationItem } from "@/components/NotificationBell";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Notifications = () => {
  const { user, loading } = useAuth();
  const { data: notifs, isLoading } = useNotifications(100);
  const deleteN = useDeleteNotification();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="font-serif text-2xl text-foreground mb-2">Notifications</h1>
        <p className="text-sm text-muted-foreground mb-8">
          A quiet log of what's happening with your stories.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !notifs || notifs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No notifications yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {notifs.map((n) => (
              <li key={n.id} className="group flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <NotificationItem n={n} />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      aria-label="Delete notification"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 mt-3 mr-2 text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this notification?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteN.mutate(n.id)}>
                        Yes, delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Notifications;
