import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keyframes } from '@emotion/react';
import { Avatar, Box, Button, Card, CardActionArea, Container, InputAdornment, Stack, TextField, Typography } from '@mui/material';
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
import ArrowForward from '@mui/icons-material/ArrowForward';
import useFetch from '../../hooks/useFetch';
import { fileUrl } from '../../api';
import { PublicNav, PublicFooter } from './PublicLayout';
import { Headline, Grid, Empty, Loading } from '../../components/ui';
import { initials } from '../../utils/format';
import { brand, DISPLAY_FONT } from '../../theme';

const photo = (id, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

const PHOTOS = {
  hero: photo('1534438327276-14e5300c3a48', 2000),
  cta: photo('1581009146145-b5ef050c2e1e', 1800),
};

const TRAINING = [
  ['Strength', 'Free weights, racks and progressive programs.', photo('1517836357463-d25dfeac3438', 900)],
  ['Cardio', 'Treadmills, bikes and conditioning circuits.', photo('1540497077202-7c8a3999166f', 900)],
  ['Group classes', 'HIIT, yoga, Zumba and more with set schedules.', photo('1518611012118-696072aa579a', 900)],
  ['Coaching', 'Matched coaches who track every member\'s progress.', photo('1571019613454-1cb2f99b2d8b', 900)],
];

const FEATURES = [
  ['Membership Management', 'Registration, plans, renewals and student verification.', GroupsOutlined],
  ['Digital Attendance', 'Check in with a QR code at the kiosk or at the front desk.', QrCode2Outlined],
  ['Coach Management', 'Specializations, schedules and live availability.', SportsOutlined],
  ['Programs & Classes', 'Create programs, schedule sessions and track enrollment.', FitnessCenterOutlined],
  ['Payments & POS', 'Membership billing, walk-ins and retail sales.', PointOfSaleOutlined],
  ['Inventory', 'Stock levels, reorder alerts and restocking.', Inventory2Outlined],
  ['Analytics & Reports', 'Attendance, revenue and peak-hour reports.', InsightsOutlined],
  ['Community & Engagement', 'Posts, badges and progress tracking.', ForumOutlined],
];

const HIGHLIGHTS = [
  ['Members check in with a QR code', 'Scan your QR at the gym kiosk or check in at the front desk.', QrCode2Outlined],
  ['Coaches post live availability', 'Members see who is Available, In Session or away, in real time.', SportsOutlined],
  ['Staff record payments and sales', 'Memberships, walk-ins and POS sales in one place.', PointOfSaleOutlined],
  ['Owners see real-time reports', 'Attendance, revenue and peak hours at a glance.', InsightsOutlined],
];

const fadeUp = keyframes`from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; }`;
const pulse = keyframes`0% { box-shadow: 0 0 0 0 rgba(34,160,75,.7); } 70% { box-shadow: 0 0 0 10px rgba(34,160,75,0); } 100% { box-shadow: 0 0 0 0 rgba(34,160,75,0); }`;
const spin = keyframes`to { transform: rotate(360deg); }`;
const fill = keyframes`from { transform: scaleX(0); } to { transform: scaleX(1); }`;
const float = keyframes`0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); }`;
const zoom = keyframes`from { transform: scale(1.08); } to { transform: scale(1); }`;

function Reveal({ children, delay = 0, sx }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setShown(true);
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Box ref={ref} sx={{ opacity: shown ? 1 : 0, animation: shown ? `${fadeUp} .7s ease ${delay}s both` : 'none', ...sx }}>{children}</Box>;
}

function Photo({ src, alt, sx, imgSx }) {
  const [ok, setOk] = useState(true);
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${brand.panel} 0%, #3a2a00 60%, ${brand.yellow} 140%)`, ...sx }}>
      {ok && <Box component="img" src={src} alt={alt} loading="lazy" onError={() => setOk(false)} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...imgSx }} />}
    </Box>
  );
}

function CountUp({ to, suffix = '', duration = 1400 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{n}{suffix}</>;
}

function LivePanel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const t = setInterval(() => setActive((i) => (i + 1) % HIGHLIGHTS.length), 3200);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <Box sx={{ position: 'relative', borderRadius: 4, p: '1.5px', overflow: 'hidden', animation: `${float} 6s ease-in-out infinite`, boxShadow: '0 30px 60px -20px rgba(0,0,0,.6)' }}>
      <Box sx={{ position: 'absolute', inset: '-60%', background: `conic-gradient(from 0deg, transparent 0 60%, ${brand.yellow} 75%, transparent 90%)`, animation: `${spin} 6s linear infinite` }} />
      <Box onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} sx={{ position: 'relative', borderRadius: 'inherit', bgcolor: 'rgba(20,20,24,.92)', backdropFilter: 'blur(10px)', color: '#fff', p: { xs: 2.5, md: 3.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" sx={{ color: brand.yellow }}>One platform</Typography>
          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ px: 1.2, py: 0.4, borderRadius: 5, bgcolor: 'rgba(34,160,75,.15)' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: brand.green, animation: `${pulse} 1.8s infinite` }} />
            <Typography variant="caption" fontWeight={800} sx={{ color: '#7be39b', letterSpacing: 0.5 }}>LIVE</Typography>
          </Stack>
        </Stack>
        <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: 24, md: 28 }, textTransform: 'uppercase', lineHeight: 1.1, mt: 1, mb: 2 }}>
          Members, coaches and staff, <Box component="span" sx={{ color: brand.yellow }}>connected.</Box>
        </Typography>
        <Stack spacing={1}>
          {HIGHLIGHTS.map(([title, sub, Icon], i) => {
            const on = i === active;
            return (
              <Box key={title} onMouseEnter={() => setActive(i)} sx={{ position: 'relative', overflow: 'hidden', cursor: 'default', borderRadius: 2, p: 1.4, display: 'flex', gap: 1.5, alignItems: 'flex-start', bgcolor: on ? 'rgba(255,175,0,.1)' : 'transparent', border: `1px solid ${on ? 'rgba(255,175,0,.35)' : 'transparent'}`, transform: on ? 'translateX(4px)' : 'none', transition: 'all .35s ease' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', flex: 'none', bgcolor: on ? brand.yellow : 'rgba(255,255,255,.08)', color: on ? '#111' : '#bbb', transition: 'all .35s ease' }}><Icon fontSize="small" /></Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ color: on ? '#fff' : '#cfcfcf', transition: 'color .3s' }}>{title}</Typography>
                  <Box sx={{ maxHeight: on ? 40 : 0, opacity: on ? 1 : 0, overflow: 'hidden', transition: 'max-height .4s ease, opacity .4s ease' }}>
                    <Typography variant="caption" sx={{ color: '#a9a9a9' }}>{sub}</Typography>
                  </Box>
                </Box>
                {on && <Box key={`bar-${active}-${paused}`} sx={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%', bgcolor: brand.yellow, transformOrigin: 'left', animation: paused ? 'none' : `${fill} 3.2s linear forwards`, transform: paused ? 'scaleX(1)' : undefined }} />}
              </Box>
            );
          })}
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          {[[2, '', 'Check-in methods'], [4, '', 'User roles'], [100, '%', 'Web-based']].map(([n, s, l]) => (
            <Box key={l} textAlign="center">
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 26, color: brand.yellow, lineHeight: 1 }}><CountUp to={n} suffix={s} /></Typography>
              <Typography variant="caption" sx={{ color: '#9a9a9a' }}>{l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

const lightOutlined = { color: '#fff', borderColor: 'rgba(255,255,255,.6)', '&:hover': { borderColor: brand.yellow, color: brand.yellow, background: 'rgba(255,175,0,.08)' } };

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
      <PublicNav links={['Features', 'Training', 'Find a Gym']} onLink={(l) => scrollTo(l === 'Features' ? 'features' : l === 'Training' ? 'training' : 'gyms')} />

      <Box component="section" sx={{ position: 'relative', overflow: 'hidden', bgcolor: brand.ink, color: '#fff' }}>
        <Photo src={PHOTOS.hero} alt="Gym floor with free weights" sx={{ position: 'absolute', inset: 0 }} imgSx={{ animation: `${zoom} 12s ease-out both` }} />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,12,.94) 0%, rgba(10,10,12,.82) 45%, rgba(10,10,12,.55) 100%)' }} />
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Grid cols={{ xs: 1, md: '1.25fr 1fr' }} gap={5} sx={{ py: { xs: 7, md: 12 }, alignItems: 'center' }}>
            <Box>
              <Reveal>
                <Typography component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.02, fontSize: { xs: 40, md: 72 } }}>
                  Strengthening<br /><Box component="span" sx={{ color: brand.yellow }}>fitness</Box><br />through<br /><Box component="span" sx={{ color: brand.yellow }}>technology</Box>.
                </Typography>
              </Reveal>
              <Reveal delay={0.15}>
                <Typography sx={{ mt: 2, maxWidth: 520, color: 'rgba(255,255,255,.78)' }}>
                  GYMORA is a gym management platform for memberships, attendance, coaches, programs, payments and community, in one place.
                </Typography>
              </Reveal>
              <Reveal delay={0.3}>
                <Stack direction="row" spacing={1.5} sx={{ mt: 3.5 }} flexWrap="wrap" useFlexGap>
                  <Button size="large" variant="contained" endIcon={<ArrowForward />} onClick={() => scrollTo('gyms')} sx={{ '& .MuiButton-endIcon': { transition: 'transform .2s' }, '&:hover .MuiButton-endIcon': { transform: 'translateX(4px)' } }}>Find your gym</Button>
                  <Button size="large" variant="outlined" onClick={() => navigate('/own-a-gym')} sx={lightOutlined}>Own a Gym?</Button>
                  <Button size="large" onClick={() => navigate('/login')} sx={{ color: brand.yellow, '&:hover': { background: 'rgba(255,175,0,.1)' } }}>Log In</Button>
                </Stack>
              </Reveal>
            </Box>
            <Reveal delay={0.2}><LivePanel /></Reveal>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg">
        <Reveal>
          <Card id="features" sx={{ p: { xs: 2, md: 4 }, mt: { xs: -3, md: -5 }, position: 'relative', zIndex: 1, boxShadow: '0 20px 50px -25px rgba(0,0,0,.35)', scrollMarginTop: 80 }}>
            <Typography variant="h4" component="h2" textAlign="center" sx={{ mb: 3 }}>
              Everything you need to <Box component="span" sx={{ color: brand.yellow }}>manage and grow</Box> your gym
            </Typography>
            <Grid cols={{ xs: 1, sm: 2, md: 4 }} gap={1.5}>
              {FEATURES.map(([t, d, Icon]) => (
                <Stack key={t} direction="row" spacing={1.5} sx={{ p: 1.5, borderRadius: 2.5, transition: 'all .25s ease', '&:hover': { bgcolor: brand.yellowSoft, transform: 'translateY(-3px)', boxShadow: '0 12px 24px -16px rgba(0,0,0,.4)' }, '&:hover .feat-icon': { bgcolor: brand.yellow, color: '#fff', transform: 'rotate(-6deg) scale(1.06)' } }}>
                  <Box className="feat-icon" sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: brand.yellowSoft, color: brand.yellow, display: 'grid', placeItems: 'center', flex: 'none', transition: 'all .25s ease' }}><Icon /></Box>
                  <Box><Typography variant="body2" fontWeight={700}>{t}</Typography><Typography variant="caption" color="text.secondary">{d}</Typography></Box>
                </Stack>
              ))}
            </Grid>
          </Card>
        </Reveal>

        <Box id="training" sx={{ mt: { xs: 6, md: 9 }, scrollMarginTop: 80 }}>
          <Reveal>
            <Headline line1="Built for every" accent="kind of training" rest="" size={{ xs: 28, md: 40 }} />
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 560 }}>From the weights floor to group classes, GYMORA keeps members, coaches and staff in step.</Typography>
          </Reveal>
          <Grid cols={{ xs: 1, sm: 2, md: 4 }} gap={2}>
            {TRAINING.map(([title, sub, src], i) => (
              <Reveal key={title} delay={i * 0.08}>
                <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', height: { xs: 220, md: 300 }, cursor: 'default', '&:hover img': { transform: 'scale(1.08)' }, '&:hover .tile-sub': { maxHeight: 60, opacity: 1 }, '&:hover .tile-bar': { width: 56 } }}>
                  <Photo src={src} alt={title} sx={{ position: 'absolute', inset: 0 }} imgSx={{ transition: 'transform .6s ease' }} />
                  <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.85) 100%)' }} />
                  <Box sx={{ position: 'absolute', left: 18, right: 18, bottom: 16, color: '#fff' }}>
                    <Box className="tile-bar" sx={{ width: 28, height: 3, bgcolor: brand.yellow, borderRadius: 2, mb: 1, transition: 'width .3s ease' }} />
                    <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>{title}</Typography>
                    <Box className="tile-sub" sx={{ maxHeight: { xs: 60, md: 0 }, opacity: { xs: 1, md: 0 }, overflow: 'hidden', transition: 'all .35s ease' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.8)' }}>{sub}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Reveal>
            ))}
          </Grid>
        </Box>

        <Box id="gyms" sx={{ mt: { xs: 6, md: 9 }, scrollMarginTop: 80 }}>
          <Reveal>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2} sx={{ mb: 3 }}>
              <Box>
                <Headline line1="Find your" accent="gym" rest="" size={{ xs: 28, md: 40 }} />
                <Typography color="text.secondary" sx={{ mt: 1 }}>Gyms running on GYMORA. Pick yours to see programs, coaches and plans.</Typography>
              </Box>
              <TextField
                placeholder="Search your gym"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ maxWidth: { md: 320 } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Stack>
          </Reveal>
          {loading && !gyms?.length ? <Loading /> : shown.length ? (
            <Grid cols={{ xs: 1, sm: 2, md: 3 }}>
              {shown.map((g, i) => (
                <Reveal key={g._id} delay={Math.min(i, 5) * 0.06}>
                  <Card sx={{ height: '100%', transition: 'all .25s ease', '&:hover': { transform: 'translateY(-4px)', borderColor: brand.yellow, boxShadow: '0 16px 30px -18px rgba(0,0,0,.45)' }, '&:hover .gym-go': { opacity: 1, transform: 'translateX(0)' } }}>
                    <CardActionArea onClick={() => navigate(`/g/${g.slug}`)} sx={{ p: 2.5, height: '100%' }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar src={fileUrl(g.logoUrl)} variant="rounded" sx={{ width: 48, height: 48, bgcolor: brand.yellowSoft, color: brand.yellowInk, fontWeight: 800 }}>{initials(g.name)}</Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="h6" noWrap>{g.name}</Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                            <PlaceOutlined sx={{ fontSize: 16 }} />
                            <Typography variant="body2">{g.city || 'Philippines'}</Typography>
                          </Stack>
                        </Box>
                        <ArrowForward className="gym-go" sx={{ color: brand.yellow, opacity: 0, transform: 'translateX(-6px)', transition: 'all .25s ease' }} />
                      </Stack>
                      {g.tagline && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>{g.tagline}</Typography>}
                    </CardActionArea>
                  </Card>
                </Reveal>
              ))}
            </Grid>
          ) : <Empty>{q ? 'No gyms match your search.' : 'No gyms yet. Be the first: register yours.'}</Empty>}
        </Box>

        <Reveal>
          <Box sx={{ position: 'relative', mt: { xs: 6, md: 9 }, borderRadius: 4, overflow: 'hidden', color: '#fff' }}>
            <Photo src={PHOTOS.cta} alt="Athlete training in a gym" sx={{ position: 'absolute', inset: 0 }} />
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,12,.92) 0%, rgba(10,10,12,.7) 60%, rgba(255,175,0,.35) 100%)' }} />
            <Box sx={{ position: 'relative', p: { xs: 3, md: 6 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Headline line1="Own a gym?" accent="Run it on GYMORA." rest="" sx={{ color: '#fff' }} />
                <Typography sx={{ mt: 1, color: 'rgba(255,255,255,.8)' }}>Set up your gym in minutes. Your data stays separate from every other gym.</Typography>
              </Box>
              <Button size="large" variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/own-a-gym')} sx={{ '& .MuiButton-endIcon': { transition: 'transform .2s' }, '&:hover .MuiButton-endIcon': { transform: 'translateX(4px)' } }}>Register your gym</Button>
            </Box>
          </Box>
        </Reveal>
      </Container>

      <PublicFooter>
        <Box><Typography fontWeight={700}>For members</Typography><Typography variant="body2">Find your gym above, then join online.</Typography></Box>
        <Box><Typography fontWeight={700}>For coaches</Typography><Typography variant="body2">Open your gym's page and apply as a coach.</Typography></Box>
        <Box><Typography fontWeight={700}>For gym owners</Typography><Typography variant="body2" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/own-a-gym')}>Register your gym</Typography></Box>
      </PublicFooter>
    </Box>
  );
}
