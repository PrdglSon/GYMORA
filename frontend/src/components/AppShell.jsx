import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Typography, Menu, MenuItem, Divider, Select, useMediaQuery, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import FitnessCenterOutlined from '@mui/icons-material/FitnessCenterOutlined';
import SportsOutlined from '@mui/icons-material/SportsOutlined';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import BuildOutlined from '@mui/icons-material/BuildOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ManageSearchOutlined from '@mui/icons-material/ManageSearchOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import QrCode2Outlined from '@mui/icons-material/QrCode2Outlined';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import PersonOutline from '@mui/icons-material/PersonOutline';
import PersonSearchOutlined from '@mui/icons-material/PersonSearchOutlined';
import HelpOutline from '@mui/icons-material/HelpOutline';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Logo from './Logo';
import NotificationsMenu from './NotificationsMenu';
import ChangePasswordDialog from './ChangePasswordDialog';
import { UserAvatar, StatusChip } from './ui';
import { useAuth, homeFor, portalOf } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api, { errMsg } from '../api';
import { brand } from '../theme';

const ADMIN_NAV = [
  ['', 'Dashboard', HomeOutlined], ['members', 'Members', PeopleOutline], ['attendance', 'Attendance', EventNoteOutlined], ['programs', 'Programs', FitnessCenterOutlined],
  ['coaches', 'Coaches', SportsOutlined], ['billing', 'Payments & Billing', CreditCardOutlined], ['pos', 'Point of Sale', PointOfSaleOutlined], ['inventory', 'Inventory', Inventory2Outlined],
  ['equipment', 'Equipment', BuildOutlined], ['incidents', 'Incident Reports', ReportProblemOutlined], ['support', 'Customer Support', SupportAgentOutlined], ['notifications', 'Notification Management', CampaignOutlined],
  ['community', 'Community', ForumOutlined], ['reports', 'Reports & Analytics', InsightsOutlined], ['settings', 'System Settings', SettingsOutlined], ['audit', 'Audit Logs', ManageSearchOutlined],
];
const STAFF_PAGES = ['', 'members', 'attendance', 'billing', 'pos', 'inventory', 'equipment', 'incidents', 'support', 'community', 'inbox'];

const NAV = {
  member: [
    ['', 'Dashboard', HomeOutlined], ['programs', 'Programs', FitnessCenterOutlined], ['coaches', 'Find a Coach', PersonSearchOutlined], ['progress', 'Progress', BarChartOutlined],
    ['community', 'Community', ForumOutlined], ['messages', 'Messages', ChatBubbleOutline], ['payments', 'Payments', CreditCardOutlined], ['help', 'Help & Reports', HelpOutline],
    ['notifications', 'Notifications', NotificationsNoneOutlined], ['profile', 'Profile', PersonOutline],
  ],
  coach: [
    ['', 'Dashboard', HomeOutlined], ['schedule', 'My Schedule', CalendarMonthOutlined], ['clients', 'My Clients', PeopleOutline], ['programs', 'Programs', EventNoteOutlined],
    ['progress', 'Client Progress', BarChartOutlined], ['attendance', 'Attendance', QrCode2Outlined], ['messages', 'Messages', ChatBubbleOutline], ['community', 'Community', ForumOutlined],
    ['help', 'Help & Reports', HelpOutline], ['notifications', 'Notifications', NotificationsNoneOutlined], ['profile', 'Profile', PersonOutline],
  ],
  admin: [...ADMIN_NAV, ['inbox', 'My Notifications', NotificationsNoneOutlined]],
  receptionist: [...ADMIN_NAV.filter(([p]) => STAFF_PAGES.includes(p)), ['inbox', 'My Notifications', NotificationsNoneOutlined]],
  platform: [['', 'Gyms', ApartmentOutlined]],
};
const ROLE_LABEL = { member: 'Member', coach: 'Coach', admin: 'Administrator', receptionist: 'Staff', platform: 'Platform Admin' };
const SIDEBAR = 252;

const TitleContext = createContext(() => {});
export function usePageTitle(title, sub) {
  const set = useContext(TitleContext);
  useEffect(() => {
    set({ title, sub });
  }, [title, sub, set]);
}

export function useBase() {
  const { role } = useAuth();
  return homeFor(role);
}

function CoachAvailability() {
  const { account, setSession } = useAuth();
  const toast = useToast();
  const change = async (e) => {
    try {
      const { data } = await api.patch('/coaches/me/availability', { availabilityStatus: e.target.value });
      setSession((s) => ({ ...s, account: { ...s.account, ...data } }));
      toast(`You are now shown as ${data.availabilityStatus}`);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  return (
    <Select value={account?.availabilityStatus || 'Unavailable'} onChange={change} size="small" sx={{ fontWeight: 700, minWidth: 140 }} inputProps={{ 'aria-label': 'Your availability' }}>
      {['Available', 'In Session', 'Unavailable'].map((s) => <MenuItem key={s} value={s}><StatusChip label={s} /></MenuItem>)}
    </Select>
  );
}

export default function AppShell() {
  const { account, gym, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = useMediaQuery('(max-width:900px)');
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [pw, setPw] = useState(false);
  const [head, setHead] = useState({ title: '', sub: '' });

  const base = homeFor(role);
  const items = NAV[role] || [];
  const signOut = () => {
    const portal = portalOf(role);
    logout();
    navigate(`/${portal}/login`);
  };

  useEffect(() => setOpen(false), [location.pathname]);

  const sidebar = (
    <Box sx={{ width: SIDEBAR, p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 1, pt: 0.5 }}><Logo height={28} onClick={() => navigate(base)} /></Box>
      {gym && <Typography variant="caption" color="text.secondary" sx={{ px: 1, mt: 0.8 }}>{gym.name}</Typography>}
      <Box sx={{ px: 1, mt: 0.5 }}><StatusChip label={`${ROLE_LABEL[role]} portal`} color={role === 'admin' ? 'amber' : role === 'receptionist' ? 'blue' : 'grey'} /></Box>
      <List sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.3 }}>
        {items.map(([path, label, Icon]) => (
          <ListItemButton key={path} component={NavLink} to={path ? `${base}/${path}` : base} end={!path} selected={path ? location.pathname.startsWith(`${base}/${path}`) : location.pathname === base} sx={{ py: 0.8 }}>
            <ListItemIcon sx={{ minWidth: 36, color: brand.ink }}><Icon fontSize="small" /></ListItemIcon>
            <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: 'auto', pt: 2, borderTop: `1px solid ${brand.line}` }}>
        <Button fullWidth variant="outlined" startIcon={<LogoutOutlined />} onClick={signOut}>Log out</Button>
      </Box>
    </Box>
  );

  return (
    <TitleContext.Provider value={setHead}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {mobile ? (
          <Drawer open={open} onClose={() => setOpen(false)}>{sidebar}</Drawer>
        ) : (
          <Box component="nav" sx={{ width: SIDEBAR, flex: 'none', borderRight: `1px solid ${brand.line}`, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>{sidebar}</Box>
        )}
        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 3.5 }, py: { xs: 2, md: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2.5, gap: 2, flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              {mobile && <IconButton onClick={() => setOpen(true)} aria-label="Open menu" sx={{ mt: -0.5 }}><MenuIcon /></IconButton>}
              <Box>
                <Typography variant="h4" component="h1">{head.title}</Typography>
                {head.sub && <Typography variant="subtitle2">{head.sub}</Typography>}
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {role === 'coach' && <CoachAvailability />}
              {role !== 'platform' && <NotificationsMenu />}
              <Stack direction="row" spacing={1} alignItems="center" onClick={(e) => setMenu(e.currentTarget)} sx={{ cursor: 'pointer' }}>
                <UserAvatar name={account?.name} src={account?.avatarUrl} />
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="body2" fontWeight={800} lineHeight={1.2}>{account?.name}</Typography>
                  <Typography variant="caption" sx={{ color: brand.yellow, fontWeight: 700 }}>{ROLE_LABEL[role]}</Typography>
                </Box>
                <KeyboardArrowDown fontSize="small" />
              </Stack>
              <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
                <MenuItem disabled><Typography variant="caption">{account?.email}</Typography></MenuItem>
                <Divider />
                <MenuItem onClick={() => { setMenu(null); setPw(true); }}>Change password</MenuItem>
                <MenuItem onClick={signOut}>Log out</MenuItem>
              </Menu>
            </Stack>
          </Stack>
          <Outlet />
        </Box>
      </Box>
      <ChangePasswordDialog open={pw} onClose={() => setPw(false)} />
    </TitleContext.Provider>
  );
}
