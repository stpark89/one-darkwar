import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/presentation/components/Layout";
import { HomePage } from "@/presentation/pages/HomePage";
import { MembersPage } from "@/presentation/pages/MembersPage";
import { WarPage } from "@/presentation/pages/WarPage";
import { EventsPage } from "@/presentation/pages/EventsPage";
import { ExcelPage } from "@/presentation/pages/ExcelPage";
import { ContributionPage } from "@/presentation/pages/ContributionPage";
import { MemberApprovalPage } from "@/presentation/pages/MemberApprovalPage";
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
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/war" element={<WarPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/contribution" element={<ContributionPage />} />
          <Route path="/excel" element={<ExcelPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/approval" element={<MemberApprovalPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
