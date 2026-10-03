import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Box, Button, InputAdornment, Link, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import SportsOutlined from '@mui/icons-material/SportsOutlined';
import PersonOutline from '@mui/icons-material/PersonOutline';
import AuthLayout from './AuthLayout';
import useFetch from '../../hooks/useFetch';
import { fileUrl } from '../../api';
import { initials } from '../../utils/format';
import { brand } from '../../theme';

const OPTIONS = [
  ['member', 'Member', 'Check in, programs, progress and payments', PersonOutline],
  ['coach', 'Coach', 'Schedule, clients and availability', SportsOutlined],
  ['staff', 'Staff', 'Front desk: check-ins, billing and POS', BadgeOutlined],
  ['admin', 'Administrator', 'Gym owner or manager: full access', AdminPanelSettingsOutlined],
];

const SIGNUP = {
  member: ['Join as a member', (slug) => `/g/${slug}/join`],
  coach: ['Create a coach account', (slug) => `/g/${slug}/apply`],
  staff: ['Create a staff account', (slug) => `/g/${slug}/staff-signup`],
};

function GymAvatar({ gym, size = 42 }) {
  return (
    <Avatar src={fileUrl(gym.logoUrl)} variant="rounded" sx={{ width: size, height: size, bgcolor: brand.yellowSoft, color: brand.yellowInk, fontWeight: 800, fontSize: size * 0.38 }}>
      {initials(gym.name)}
    </Avatar>
  );
}

export default function LoginChooser() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: gyms, loading, error } = useFetch('/public/gyms', { initial: [] });
  const [q, setQ] = useState('');
  const slug = params.get('gym') || '';
  const gym = (gyms || []).find((g) => g.slug === slug);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = gyms || [];
    if (!term) return list;
    return list.filter((g) => [g.name, g.city].filter(Boolean).some((v) => v.toLowerCase().includes(term)));
  }, [gyms, q]);

  const pickGym = (g) => setParams({ gym: g.slug });

  if (gym) {
    return (
      <AuthLayout line1="Welcome" accent="back" sub={`Choose how you log in to ${gym.name}.`}>
        <Link component="button" type="button" onClick={() => setParams({})} underline="hover" variant="body2">← Choose another gym</Link>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
          <GymAvatar gym={gym} />
          <Box>
            <Typography variant="h5">{gym.name}</Typography>
            {gym.city && <Typography variant="body2" color="text.secondary">{gym.city}</Typography>}
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1.5, mb: 2.5 }}>I am a…</Typography>
        <Stack spacing={1.5}>
          {OPTIONS.map(([key, label, sub, Icon]) => (
            <Box key={key} component="button" type="button" onClick={() => navigate(`/${key}/login?gym=${gym.slug}`)} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, textAlign: 'left', font: 'inherit', cursor: 'pointer', border: `1px solid ${brand.line}`, borderRadius: 2.5, bgcolor: '#fff', '&:hover': { borderColor: brand.yellow, bgcolor: brand.yellowSoft } }}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: brand.yellowSoft, color: brand.yellowInk, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon /></Box>
              <Box>
                <Typography fontWeight={800}>{label}</Typography>
                <Typography variant="body2" color="text.secondary">{sub}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
        <Box sx={{ mt: 2.5, p: 2, borderRadius: 2.5, bgcolor: brand.fill }}>
          <Typography variant="body2" fontWeight={800} sx={{ mb: 1 }}>New here? Create an account</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(SIGNUP).map(([key, [label, to]]) => <Button key={key} size="small" variant="outlined" component={RouterLink} to={to(gym.slug)} sx={{ bgcolor: '#fff' }}>{label}</Button>)}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>Coach and staff accounts need the administrator's approval. Administrator accounts are created when the gym is registered, or by an existing administrator.</Typography>
        </Box>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout line1="Find your" accent="gym" sub="Search for the gym you belong to, then log in as a member, coach, staff or administrator.">
      <Link component={RouterLink} to="/" underline="hover" variant="body2">← Back</Link>
      <Typography variant="h4" textAlign="center" sx={{ mt: 2 }}>Log in to your gym</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2.5 }}>Type your gym's name or city</Typography>
      <TextField
        autoFocus
        placeholder="Search your gym"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      <Stack spacing={1} sx={{ mt: 2, minHeight: 120, maxHeight: 312, overflowY: 'auto', pr: 0.5, scrollbarWidth: 'thin', scrollbarColor: `${brand.yellow} transparent`, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: brand.yellow, borderRadius: 3 } }}>
        {error && <Alert severity="error">Cannot load gyms. Is the backend running?</Alert>}
        {!loading && !error && !results.length && (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
            {gyms?.length ? 'No gym matches your search.' : 'No gyms are registered yet.'}
          </Typography>
        )}
        {results.map((g) => (
          <Box key={g._id} component="button" type="button" onClick={() => pickGym(g)} sx={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, textAlign: 'left', font: 'inherit', cursor: 'pointer', border: `1px solid ${brand.line}`, borderRadius: 2.5, bgcolor: '#fff', '&:hover': { borderColor: brand.yellow, bgcolor: brand.yellowSoft } }}>
            <GymAvatar gym={g} size={38} />
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} noWrap>{g.name}</Typography>
              {g.city && <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}><PlaceOutlined sx={{ fontSize: 14 }} />{g.city}</Typography>}
            </Box>
          </Box>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2.5 }}>
        <Button component={RouterLink} to="/own-a-gym" variant="outlined" size="small">Own a gym? Register it</Button>
      </Stack>
    </AuthLayout>
  );
}
