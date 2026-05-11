import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Profile from "./pages/Profile";
import Write from "./pages/Write";
import StoryDetail from "./pages/StoryDetail";

import Auth from "./pages/Auth";
import Waitlist from "./pages/Waitlist";
import SetupAccount from "./pages/SetupAccount";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import Bookmarks from "./pages/Bookmarks";
import InnerCircle from "./pages/InnerCircle";
import InnerCirclePayment from "./pages/InnerCirclePayment";
import NotFound from "./pages/NotFound";
import FooterPage from "./pages/FooterPage";
import Notifications from "./pages/Notifications";
import CreateWhisper from "./pages/CreateWhisper";
import WhisperFolder from "./pages/WhisperFolder";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";

const queryClient = new QueryClient();

const ProfileRedirect = () => {
  const { username } = useParams();
  return <Navigate to={`/@${username}`} replace />;
};

const HomeRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/read" replace /> : <Landing />;
};

const App = () => (

  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <MaintenanceGuard>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/read" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/setup-account" element={<SetupAccount />} />
            <Route path="/:username" element={<Profile />} />
            <Route path="/profile/:username" element={<ProfileRedirect />} />
            <Route path="/write" element={<Write />} />
            <Route path="/story/:id" element={<StoryDetail />} />
            
            <Route path="/admin" element={<Admin />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/inner-circle" element={<InnerCircle />} />
            <Route path="/inner-circle/payment" element={<InnerCirclePayment />} />
            <Route path="/page/:slug" element={<FooterPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/whisper/new" element={<CreateWhisper />} />
            <Route path="/:username/whisper/:folderId" element={<WhisperFolder />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </MaintenanceGuard>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
