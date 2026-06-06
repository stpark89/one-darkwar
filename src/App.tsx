import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "@/presentation/components/Layout";
import { HomePage } from "@/presentation/pages/HomePage";
import { GuestHomePage } from "@/presentation/pages/GuestHomePage";
import { GuestQuestionsPage } from "@/presentation/pages/GuestQuestionsPage";
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
import { TransferStatusPage } from "@/presentation/pages/TransferStatusPage";
import { TransferListPage } from "@/presentation/pages/TransferListPage";
import { SignInPage } from "@/presentation/pages/SignInPage";
import { SignUpPage } from "@/presentation/pages/SignUpPage";
import { ChangePasswordPage } from "@/presentation/pages/ChangePasswordPage";
import { useAuthStore } from "@/infrastructure/stores/authStore";

const HEARTBEAT_MS = 2 * 60 * 1000; // 2분마다 갱신

const HomeRouter = () => {
  const { isGuest, isTourMode } = useAuthStore();
  // 게스트 + 둘러보기 모드면 실제 HomePage 노출 (read-only)
  return isGuest && !isTourMode ? <GuestHomePage /> : <HomePage />;
};

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
          <Route index element={<HomeRouter />} />
          <Route path="/home" element={<HomeRouter />} />
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
          <Route path="/transfer/status" element={<TransferStatusPage />} />
          <Route path="/transfer/list" element={<TransferListPage />} />
          <Route path="/questions" element={<GuestQuestionsPage />} />
          {/* 존재하지 않는 경로는 홈으로 (오타 등) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
