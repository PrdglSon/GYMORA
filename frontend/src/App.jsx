import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeFor, portalOf } from './context/AuthContext';
import { Loading } from './components/ui';
import AppShell from './components/AppShell';

import Home from './pages/public/Home';
import GymPage from './pages/public/GymPage';
import RegisterMember from './pages/public/RegisterMember';
import CoachApply from './pages/public/CoachApply';
import StaffSignup from './pages/public/StaffSignup';
import LoginChooser from './pages/auth/LoginChooser';
import PortalLogin from './pages/auth/PortalLogin';
import RegisterGym from './pages/auth/RegisterGym';
import PrivacyPolicy from './pages/public/PrivacyPolicy';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Kiosk from './pages/kiosk/Kiosk';

import MemberDashboard from './pages/member/MemberDashboard';
import MemberPrograms from './pages/member/MemberPrograms';
import MemberCoaches from './pages/member/MemberCoaches';
import MemberProgress from './pages/member/MemberProgress';
import MemberPayments from './pages/member/MemberPayments';
import MemberProfile from './pages/member/MemberProfile';

import CoachDashboard from './pages/coach/CoachDashboard';
import CoachSchedule from './pages/coach/CoachSchedule';
import CoachClients from './pages/coach/CoachClients';
import CoachPrograms from './pages/coach/CoachPrograms';
import CoachClientProgress from './pages/coach/CoachClientProgress';
import CoachAttendance from './pages/coach/CoachAttendance';
import CoachProfile from './pages/coach/CoachProfile';

import Community from './pages/shared/Community';
import Messages from './pages/shared/Messages';
import Notifications from './pages/shared/Notifications';
import HelpReports from './pages/shared/HelpReports';

import AdminDashboard from './pages/admin/AdminDashboard';
import Members from './pages/admin/Members';
import Attendance from './pages/admin/Attendance';
import Programs from './pages/admin/Programs';
import Coaches from './pages/admin/Coaches';
import Billing from './pages/admin/Billing';
import POS from './pages/admin/POS';
import Inventory from './pages/admin/Inventory';
import Equipment from './pages/admin/Equipment';
import Incidents from './pages/admin/Incidents';
import Support from './pages/admin/Support';
import NotificationManagement from './pages/admin/NotificationManagement';
import Reports from './pages/admin/Reports';
import Settings from './pages/admin/Settings';
import AuditLogs from './pages/admin/AuditLogs';

import PlatformGyms from './pages/platform/PlatformGyms';

function RequireRole({ roles, portal, children }) {
  const { role, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!role) return <Navigate to={`/${portal}/login`} replace />;
  if (roles.includes(role)) return children;
  if (role === 'receptionist' && location.pathname.startsWith('/admin')) return <Navigate to={location.pathname.replace('/admin', '/staff')} replace />;
  if (role === 'admin' && location.pathname.startsWith('/staff')) return <Navigate to={location.pathname.replace('/staff', '/admin')} replace />;
  return <Navigate to={homeFor(role)} replace />;
}

function LoginRoute({ portal }) {
  const { role, ready } = useAuth();
  if (!ready) return <Loading />;
  if (role && portalOf(role) === portal) return <Navigate to={homeFor(role)} replace />;
  return <PortalLogin key={portal} portal={portal} />;
}

const STAFF_ROUTES = [
  ['members', <Members />], ['attendance', <Attendance />], ['billing', <Billing />], ['pos', <POS />], ['inventory', <Inventory />],
  ['equipment', <Equipment />], ['incidents', <Incidents />], ['support', <Support />], ['community', <Community />], ['inbox', <Notifications />],
];
const ADMIN_ONLY_ROUTES = [
  ['programs', <Programs />], ['coaches', <Coaches />], ['notifications', <NotificationManagement />], ['reports', <Reports />], ['settings', <Settings />], ['audit', <AuditLogs />],
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/g/:slug" element={<GymPage />} />
      <Route path="/g/:slug/join" element={<RegisterMember />} />
      <Route path="/g/:slug/apply" element={<CoachApply />} />
      <Route path="/g/:slug/staff-signup" element={<StaffSignup />} />
      <Route path="/login" element={<LoginChooser />} />
      {['admin', 'staff', 'coach', 'member', 'platform'].map((p) => <Route key={p} path={`/${p}/login`} element={<LoginRoute portal={p} />} />)}
      <Route path="/own-a-gym" element={<RegisterGym />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/kiosk/:slug" element={<Kiosk />} />

      <Route path="/member" element={<RequireRole roles={['member']} portal="member"><AppShell /></RequireRole>}>
        <Route index element={<MemberDashboard />} />
        <Route path="programs" element={<MemberPrograms />} />
        <Route path="coaches" element={<MemberCoaches />} />
        <Route path="progress" element={<MemberProgress />} />
        <Route path="community" element={<Community />} />
        <Route path="messages" element={<Messages />} />
        <Route path="payments" element={<MemberPayments />} />
        <Route path="help" element={<HelpReports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<MemberProfile />} />
      </Route>

      <Route path="/coach" element={<RequireRole roles={['coach']} portal="coach"><AppShell /></RequireRole>}>
        <Route index element={<CoachDashboard />} />
        <Route path="schedule" element={<CoachSchedule />} />
        <Route path="clients" element={<CoachClients />} />
        <Route path="programs" element={<CoachPrograms />} />
        <Route path="progress" element={<CoachClientProgress />} />
        <Route path="attendance" element={<CoachAttendance />} />
        <Route path="messages" element={<Messages />} />
        <Route path="community" element={<Community />} />
        <Route path="help" element={<HelpReports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<CoachProfile />} />
      </Route>

      <Route path="/admin" element={<RequireRole roles={['admin']} portal="admin"><AppShell /></RequireRole>}>
        <Route index element={<AdminDashboard />} />
        {[...STAFF_ROUTES, ...ADMIN_ONLY_ROUTES].map(([path, el]) => <Route key={path} path={path} element={el} />)}
      </Route>

      <Route path="/staff" element={<RequireRole roles={['receptionist']} portal="staff"><AppShell /></RequireRole>}>
        <Route index element={<AdminDashboard />} />
        {STAFF_ROUTES.map(([path, el]) => <Route key={path} path={path} element={el} />)}
      </Route>

      <Route path="/platform" element={<RequireRole roles={['platform']} portal="platform"><AppShell /></RequireRole>}>
        <Route index element={<PlatformGyms />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
