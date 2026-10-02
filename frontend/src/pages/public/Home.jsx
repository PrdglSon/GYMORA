import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, Button, Card, CardActionArea, CardContent, Container, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import QrCode2Outlined from '@mui/icons-material/QrCode2Outlined';
import SportsOutlined from '@mui/icons-material/SportsOutlined';
import FitnessCenterOutlined from '@mui/icons-material/FitnessCenterOutlined';
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import SearchIcon from '@mui/icons-material/Search';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import useFetch from '../../hooks/useFetch';
import { fileUrl } from '../../api';
import { PublicNav, PublicFooter } from './PublicLayout';
import { Headline, Grid, Empty, Loading } from '../../components/ui';
import { initials } from '../../utils/format';
import { brand, DISPLAY_FONT } from '../../theme';

const FEATURES = [
  ['Membership Management', 'Registration, plans, renewals and student verification.', GroupsOutlined],
  ['Digital Attendance', 'Check in through the mobile app, a QR kiosk or the front desk.', QrCode2Outlined],
  ['Coach Management', 'Specializations, schedules and live availability.', SportsOutlined],
  ['Programs & Classes', 'Create programs, schedule sessions and track enrollment.', FitnessCenterOutlined],
  ['Payments & POS', 'Membership billing, walk-ins and retail sales.', PointOfSaleOutlined],
  ['Inventory', 'Stock levels, reorder alerts and restocking.', Inventory2Outlined],
  ['Analytics & Reports', 'Attendance, revenue and peak-hour reports.', InsightsOutlined],
  ['Community & Engagement', 'Posts, badges and progress tracking.', ForumOutlined],
];

export default function Home() {
  const navigate = useNavigate();
  const { data: gyms, loading } = useFetch('/public/gyms', { initial: [] });
  const [q, setQ] = useState('');
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return gyms || [];
    return (gyms || []).filter((g) => [g.name, g.city, g.tagline].filter(Boolean).some((v) => v.toLowerCase().includes(s)));
  }, [gyms, q]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav links={['Features', 'Find a Gym']} onLink={(l) => scrollTo(l === 'Features' ? 'features' : 'gyms')} />
      <Container maxWidth="lg">
        <Grid cols={{ xs: 1, md: '1.3fr 1fr' }} gap={4} sx={{ py: { xs: 6, md: 10 }, alignItems: 'center' }}>
          <Box>
            <Typography component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.02, fontSize: { xs: 40, md: 72 } }}>
              Strengthening<br /><Box component="span" sx={{ color: brand.yellow }}>fitness</Box><br />through<br /><Box component="span" sx={{ color: brand.yellow }}>technology</Box>.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 520 }}>
              GYMORA is a gym management platform for memberships, attendance, coaches, programs, payments and community, in one place.
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
              <Button size="large" variant="contained" onClick={() => scrollTo('gyms')}>Find your gym</Button>
              <Button size="large" variant="outlined" onClick={() => navigate('/own-a-gym')}>Own a Gym?</Button>
              <Button size="large" onClick={() => navigate('/login')}>Log In</Button>
            </Stack>
          </Box>
          <Card sx={{ bgcolor: brand.panel, color: '#fff', border: 0 }}>
            <CardContent sx={{ p: 3.5 }}>
              <Typography variant="overline" sx={{ color: brand.yellow }}>One platform</Typography>
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 28, textTransform: 'uppercase', lineHeight: 1.1, my: 1 }}>Members, coaches and staff, connected.</Typography>
              <Stack spacing={1.2} sx={{ mt: 2 }}>
                {['Members check in with a QR code', 'Coaches post live availability', 'Staff record payments and sales', 'Owners see real-time reports'].map((t) => (
                  <Stack key={t} direction="row" spacing={1.2} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: brand.yellow, flex: 'none' }} />
                    <Typography variant="body2" sx={{ color: '#ddd' }}>{t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Card id="features" sx={{ p: { xs: 2, md: 4 } }}>
          <Typography variant="h4" component="h2" textAlign="center" sx={{ mb: 3 }}>
            Everything you need to <Box component="span" sx={{ color: brand.yellow }}>manage and grow</Box> your gym
          </Typography>
          <Grid cols={{ xs: 1, sm: 2, md: 4 }} gap={3}>
            {FEATURES.map(([t, d, Icon]) => (
              <Stack key={t} direction="row" spacing={1.5}>
                <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: brand.yellowSoft, color: brand.yellow, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon /></Box>
                <Box><Typography variant="body2" fontWeight={700}>{t}</Typography><Typography variant="caption" color="text.secondary">{d}</Typography></Box>
              </Stack>
            ))}
          </Grid>
        </Card>

        <Box id="gyms" sx={{ mt: 6, scrollMarginTop: 80 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Headline line1="Find your" accent="gym" rest="" size={{ xs: 28, md: 40 }} />
              <Typography color="text.secondary" sx={{ mt: 1 }}>Gyms running on GYMORA. Pick yours to see programs, coaches and plans.</Typography>
            </Box>
            <TextField
              placeholder="Search by name or city"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ maxWidth: { md: 320 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Stack>
          {loading && !gyms?.length ? <Loading /> : shown.length ? (
            <Grid cols={{ xs: 1, sm: 2, md: 3 }}>
              {shown.map((g) => (
                <Card key={g._id}>
                  <CardActionArea onClick={() => navigate(`/g/${g.slug}`)} sx={{ p: 2.5, height: '100%' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar src={fileUrl(g.logoUrl)} variant="rounded" sx={{ width: 48, height: 48, bgcolor: brand.yellowSoft, color: brand.yellowInk, fontWeight: 800 }}>{initials(g.name)}</Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" noWrap>{g.name}</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                          <PlaceOutlined sx={{ fontSize: 16 }} />
                          <Typography variant="body2">{g.city || 'Philippines'}</Typography>
                        </Stack>
                      </Box>
                    </Stack>
                    {g.tagline && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>{g.tagline}</Typography>}
                  </CardActionArea>
                </Card>
              ))}
            </Grid>
          ) : <Empty>{q ? 'No gyms match your search.' : 'No gyms yet. Be the first: register yours.'}</Empty>}
        </Box>

        <Card sx={{ mt: 6 }}>
          <CardContent sx={{ p: { xs: 3, md: 5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Headline line1="Own a gym?" accent="Run it on GYMORA." rest="" />
              <Typography color="text.secondary" sx={{ mt: 1 }}>Set up your gym in minutes. Your data stays separate from every other gym.</Typography>
            </Box>
            <Button size="large" variant="contained" onClick={() => navigate('/own-a-gym')}>Register your gym</Button>
          </CardContent>
        </Card>
      </Container>
      <PublicFooter>
        <Box><Typography fontWeight={700}>For members</Typography><Typography variant="body2">Find your gym above, then join online.</Typography></Box>
        <Box><Typography fontWeight={700}>For coaches</Typography><Typography variant="body2">Open your gym's page and apply as a coach.</Typography></Box>
        <Box><Typography fontWeight={700}>For gym owners</Typography><Typography variant="body2" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/own-a-gym')}>Register your gym</Typography></Box>
      </PublicFooter>
    </Box>
  );
}
