import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "@/presentation/components/Layout";
import { HomePage } from "@/presentation/pages/HomePage";
import { MembersPage } from "@/presentation/pages/MembersPage";
import { WarPage } from "@/presentation/pages/WarPage";
import { VsPointPage } from "@/presentation/pages/VsPointPage";
import { EventsPage } from "@/presentation/pages/EventsPage";
import { ExcelPage } from "@/presentation/pages/ExcelPage";
import { ContributionPage } from "@/presentation/pages/ContributionPage";
import { MemberApprovalPage } from "@/presentation/pages/MemberApprovalPage";
import { NoticePage } from "@/presentation/pages/NoticePage";
import { BoardPage } from "@/presentation/pages/BoardPage";
import { TransferPage } from "@/presentation/pages/TransferPage";
import { SignInPage } from "@/presentation/pages/SignInPage";
import { SignUpPage } from "@/presentation/pages/SignUpPage";
import { ChangePasswordPage } from "@/presentation/pages/ChangePasswordPage";
import { useAuthStore } from "@/infrastructure/stores/authStore";

const HEARTBEAT_MS = 2 * 60 * 1000; // 2분마다 갱신

function App() {
  const { loadSession, updateLastSeen } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    updateLastSeen();
    const id = setInterval(updateLastSeen, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [updateLastSeen]);

  return (
    <BrowserRouter>
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/war" element={<WarPage />} />
          <Route path="/vs-point" element={<VsPointPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/contribution" element={<ContributionPage />} />
          <Route path="/excel" element={<ExcelPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/approval" element={<MemberApprovalPage />} />
          <Route path="/notices" element={<NoticePage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/transfer" element={<TransferPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
