import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Card, CardContent, Chip, Container, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import useFetch from '../../hooks/useFetch';
import api, { errMsg, fileUrl } from '../../api';
import { useToast } from '../../context/ToastContext';
import { PublicNav, PublicFooter } from './PublicLayout';
import { DataState, Grid, Headline, StatusChip, UserAvatar, Progress, Empty } from '../../components/ui';
import { peso0, ago, fday, hhmm12, isoDay } from '../../utils/format';
import { brand } from '../../theme';

const TABS = ['Home', 'Programs', 'Schedule', 'Coaches', 'Community', 'Membership', 'About'];
const AVAIL_COLOR = { Available: 'green', 'In Session': 'amber', Unavailable: 'grey' };
const EMPTY_INQ = { fullName: '', contact: '', inquiryType: 'Inquiry', subject: '', message: '' };

function busyLevel(n) {
  if (n >= 30) return ['Very busy', brand.red];
  if (n >= 15) return ['Busy', brand.orange];
  if (n >= 5) return ['Moderate', brand.yellow];
  return ['Quiet', brand.green];
}

export default function GymPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('Home');
  const { data, loading, error, reload } = useFetch(`/public/gyms/${slug}`);
  const [inq, setInq] = useState(EMPTY_INQ);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const t = setInterval(reload, 60000);
    return () => clearInterval(t);
  }, [reload]);

  const days = useMemo(() => {
    const groups = {};
    (data?.schedule || []).forEach((s) => {
      const k = isoDay(s.scheduleDate);
      (groups[k] = groups[k] || []).push(s);
    });
    return Object.entries(groups);
  }, [data]);

  const sendInquiry = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data: r } = await api.post(`/public/gyms/${slug}/inquiry`, { ...inq, subject: inq.subject || undefined });
      toast(r.message);
      setInq(EMPTY_INQ);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSending(false);
    }
  };
  const set = (k) => (e) => setInq({ ...inq, [k]: e.target.value });

  const gym = data?.gym;
  const settings = gym?.settings || {};
  const [busyText, busyColor] = busyLevel(data?.inGymNow || 0);
  const available = (data?.coaches || []).filter((c) => c.availabilityStatus === 'Available').length;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav links={TABS} active={tab} onLink={setTab} loginTo={`/login?gym=${slug}`} />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <DataState loading={loading} error={error} data={data} onRetry={reload}>
          {data && (
            <>
              {tab === 'Home' && (
                <Stack spacing={5}>
                  <Grid cols={{ xs: 1, md: '1.2fr 1fr' }} gap={4} sx={{ alignItems: 'center', py: { md: 4 } }}>
                    <Box>
                      {gym.logoUrl && <Box component="img" src={fileUrl(gym.logoUrl)} alt="" sx={{ height: 48, mb: 2 }} />}
                      <Headline line1={gym.name} accent="Train with us." rest="" size={{ xs: 34, md: 56 }} />
                      <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 520 }}>{gym.tagline || gym.about}</Typography>
                      <Stack direction="row" spacing={1.5} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
                        <Button size="large" variant="contained" onClick={() => navigate(`/g/${slug}/join`)}>Join now</Button>
                        <Button size="large" variant="outlined" onClick={() => setTab('Membership')}>See plans</Button>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" color="text.secondary">Already with {gym.name}? Log in as</Typography>
                        {[['member', 'Member'], ['coach', 'Coach'], ['staff', 'Staff']].map(([p, label], i) => (
                          <Stack key={p} direction="row" alignItems="center" spacing={1}>
                            {i > 0 && <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: brand.line }} />}
                            <Link component={RouterLink} to={`/${p}/login?gym=${slug}`} variant="body2" fontWeight={700} underline="hover">{label}</Link>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                    <Card sx={{ bgcolor: brand.panel, color: '#fff', border: 0 }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" sx={{ color: '#aaa' }}>Live now</Typography>
                          <Chip size="small" label={busyText} sx={{ bgcolor: busyColor, color: '#fff' }} />
                        </Stack>
                        <Typography sx={{ fontSize: 44, fontWeight: 800 }}>{data.inGymNow}</Typography>
                        <Typography variant="body2" sx={{ color: '#aaa', mb: 2 }}>people working out · open {hhmm12(settings.openTime)} to {hhmm12(settings.closeTime)}</Typography>
                        <Typography variant="caption" sx={{ color: '#aaa' }}>{available} of {data.coaches.length} coaches available</Typography>
                        {data.coaches.slice(0, 5).map((c) => (
                          <Stack key={c._id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.6 }}>
                            <Typography variant="body2">{c.name}</Typography>
                            <StatusChip label={c.availabilityStatus} color={AVAIL_COLOR[c.availabilityStatus]} />
                          </Stack>
                        ))}
                      </CardContent>
                    </Card>
                  </Grid>

                  {!!data.posts.length && (
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h5">Community highlights</Typography>
                        <Button onClick={() => setTab('Community')}>See all</Button>
                      </Stack>
                      <Grid cols={{ xs: 1, md: 3 }}>
                        {data.posts.slice(0, 3).map((p) => (
                          <Card key={p._id}><CardContent>
                            <Chip size="small" label={p.tag} sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk, mb: 1 }} />
                            <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.content}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{p.authorName} · {ago(p.datePosted)}</Typography>
                          </CardContent></Card>
                        ))}
                      </Grid>
                    </Box>
                  )}

                </Stack>
              )}

              {tab === 'Programs' && (
                <>
                  <Headline line1="Programs for" accent="every goal" rest="" size={{ xs: 28, md: 40 }} sx={{ mb: 3 }} />
                  <Grid cols={{ xs: 1, sm: 2, md: 3 }}>
                    {data.programs.map((p) => {
                      const left = Math.max(0, (p.capacity || 0) - p.enrolled);
                      return (
                        <Card key={p._id}>
                          {p.imageUrl && <Box component="img" src={fileUrl(p.imageUrl)} alt="" sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />}
                          <CardContent>
                            <Stack direction="row" spacing={0.5} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                              <Chip size="small" label={p.category} sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk }} />
                              {p.level && <Chip size="small" label={p.level} />}
                            </Stack>
                            <Typography variant="h6">{p.programName}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{p.description}</Typography>
                            {p.schedule && <Typography variant="body2">{p.schedule}</Typography>}
                            <Typography variant="body2">Coach {p.coachName || 'TBA'}{p.durationWeeks ? ` · ${p.durationWeeks} weeks` : ''}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                              <Progress value={p.capacity ? (p.enrolled / p.capacity) * 100 : 0} />
                              <Typography variant="caption">{left} slots left</Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Grid>
                  {!data.programs.length && <Empty>No programs published yet.</Empty>}
                </>
              )}

              {tab === 'Schedule' && (
                <>
                  <Headline line1="This week's" accent="sessions" rest="" size={{ xs: 28, md: 40 }} />
                  <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Class sessions for the next 7 days. Members enroll in programs from the member app.</Typography>
                  {days.length ? (
                    <Stack spacing={2}>
                      {days.map(([day, list]) => (
                        <Card key={day}><CardContent>
                          <Typography variant="h6" sx={{ mb: 1 }}>{fday(day)}</Typography>
                          {list.map((s) => (
                            <Stack key={s._id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ py: 1, borderTop: `1px solid ${brand.line}` }}>
                              <Box>
                                <Typography fontWeight={700}>{s.programName}</Typography>
                                <Typography variant="caption" color="text.secondary">{s.category} · Coach {s.coachName || 'TBA'}</Typography>
                              </Box>
                              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{hhmm12(s.startTime)} to {hhmm12(s.endTime)}</Typography>
                            </Stack>
                          ))}
                        </CardContent></Card>
                      ))}
                    </Stack>
                  ) : <Empty>No sessions scheduled this week.</Empty>}
                </>
              )}

              {tab === 'Coaches' && (
                <>
                  <Headline line1="Learn from the best." accent="Achieve your best." rest="" size={{ xs: 28, md: 40 }} />
                  <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Availability updates live from the coaches' dashboards.</Typography>
                  <Grid cols={{ xs: 1, sm: 2, md: 3 }}>
                    {data.coaches.map((c) => (
                      <Card key={c._id}><CardContent>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <UserAvatar name={c.name} src={c.avatarUrl} size={56} />
                          <Box>
                            <Typography fontWeight={800}>{c.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{c.experience || 0} yrs{c.certification ? ` · ${c.certification}` : ''}</Typography>
                            <Box sx={{ mt: 0.5 }}><StatusChip label={c.availabilityStatus} color={AVAIL_COLOR[c.availabilityStatus]} /></Box>
                          </Box>
                        </Stack>
                        {c.bio && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{c.bio}</Typography>}
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>{(c.specializations || []).map((s) => <Chip key={s} size="small" label={s} />)}</Stack>
                      </CardContent></Card>
                    ))}
                  </Grid>
                  {!data.coaches.length && <Empty>No coaches listed yet.</Empty>}
                  <Button sx={{ mt: 3 }} variant="outlined" onClick={() => navigate(`/g/${slug}/apply`)}>Apply as a coach</Button>
                </>
              )}

              {tab === 'Community' && (
                <>
                  <Headline line1="Stronger together." accent="Better every day." rest="" size={{ xs: 28, md: 40 }} />
                  <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Announcements, events and member stories. Members can post after logging in.</Typography>
                  <Grid cols={{ xs: 1, md: 2 }}>
                    {data.posts.map((p) => (
                      <Card key={p._id}>
                        {p.image && <Box component="img" src={fileUrl(p.image)} alt="" sx={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />}
                        <CardContent>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={700}>{p.authorName}</Typography>
                            <Chip size="small" label={p.tag} sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk }} />
                          </Stack>
                          <Typography sx={{ my: 1, whiteSpace: 'pre-line' }}>{p.content}</Typography>
                          <Stack direction="row" spacing={2} alignItems="center" sx={{ color: 'text.secondary' }}>
                            <Stack direction="row" spacing={0.5} alignItems="center"><FavoriteBorder sx={{ fontSize: 16 }} /><Typography variant="caption">{p.likes}</Typography></Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center"><ChatBubbleOutline sx={{ fontSize: 16 }} /><Typography variant="caption">{p.comments}</Typography></Stack>
                            <Typography variant="caption">{ago(p.datePosted)}</Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Grid>
                  {!data.posts.length && <Empty>No posts yet.</Empty>}
                </>
              )}

              {tab === 'Membership' && (
                <>
                  <Headline line1="More than a gym." accent="A community." rest="" size={{ xs: 28, md: 40 }} />
                  <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Choose a plan that fits your lifestyle. Walk-in day pass: {peso0(settings.walkInFee)}.</Typography>
                  <Grid cols={{ xs: 1, sm: 2, md: 4 }}>
                    {data.plans.map((p) => (
                      <Card key={p._id} sx={p.highlight ? { borderColor: brand.yellow, boxShadow: `0 0 0 1px ${brand.yellow}` } : undefined}>
                        <CardContent>
                          <Stack direction="row" spacing={0.5} sx={{ mb: 1, minHeight: 22 }}>
                            {p.highlight && <Chip size="small" label="Most popular" sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk }} />}
                            {p.isStudentPlan && <StatusChip label="Student" color="blue" />}
                          </Stack>
                          <Typography fontWeight={800}>{p.planName}</Typography>
                          <Typography sx={{ fontSize: 28, fontWeight: 800 }}>{peso0(p.price)}</Typography>
                          <Typography variant="caption" color="text.secondary">for {p.duration} days</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ my: 1.5, minHeight: 40 }}>{p.description}</Typography>
                          <Button fullWidth variant={p.highlight ? 'contained' : 'outlined'} disabled={settings.allowOnlineSignup === false} onClick={() => navigate(`/g/${slug}/join?plan=${p._id}`)}>Join now</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </Grid>
                  {!data.plans.length && <Empty>No membership plans published yet.</Empty>}
                  {settings.allowOnlineSignup === false && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Online sign-up is turned off. Please register at the front desk.</Typography>}
                </>
              )}

              {tab === 'About' && (
                <Grid cols={{ xs: 1, md: 2 }} gap={4}>
                  <Box>
                    <Headline line1="Built for gyms." accent="Designed for people." rest="" size={{ xs: 28, md: 40 }} />
                    <Typography color="text.secondary" sx={{ mt: 2, whiteSpace: 'pre-line' }}>{gym.about || `${gym.name} runs on GYMORA.`}</Typography>
                    <Typography variant="body2" sx={{ mt: 2 }}>{[gym.address, gym.city].filter(Boolean).join(', ')}</Typography>
                    <Typography variant="body2">{[gym.phoneNumber, gym.email].filter(Boolean).join(' · ')}</Typography>
                    <Typography variant="body2">Open daily {hhmm12(settings.openTime)} to {hhmm12(settings.closeTime)}</Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                      <Link component={RouterLink} to={`/member/login?gym=${slug}`} fontWeight={700}>Member login</Link>
                      <Link component={RouterLink} to={`/coach/login?gym=${slug}`} fontWeight={700}>Coach login</Link>
                      <Link component={RouterLink} to={`/staff/login?gym=${slug}`} fontWeight={700}>Staff login</Link>
                      <Link component={RouterLink} to={`/kiosk/${slug}`} fontWeight={700}>Kiosk</Link>
                    </Stack>
                  </Box>
                  <Card component="form" onSubmit={sendInquiry}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2 }}>Send an inquiry</Typography>
                      <Stack spacing={2}>
                        <TextField label="Your name" value={inq.fullName} onChange={set('fullName')} required />
                        <TextField label="Email or phone" value={inq.contact} onChange={set('contact')} required />
                        <TextField select label="Type" value={inq.inquiryType} onChange={set('inquiryType')}>
                          <MenuItem value="Inquiry">General inquiry</MenuItem>
                          <MenuItem value="Membership">Membership</MenuItem>
                        </TextField>
                        <TextField label="Subject" value={inq.subject} onChange={set('subject')} />
                        <TextField label="Message" value={inq.message} onChange={set('message')} required multiline minRows={3} />
                        <Button type="submit" variant="contained" disabled={sending} sx={{ alignSelf: 'flex-start' }}>Send inquiry</Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </>
          )}
        </DataState>
      </Container>
      <PublicFooter>
        <Box><Typography fontWeight={700}>{gym?.name}</Typography><Typography variant="body2">{gym?.city}</Typography></Box>
        <Box>
          <Typography fontWeight={700}>Members</Typography>
          <Typography variant="body2" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/g/${slug}/join`)}>Join online</Typography>
          <Typography variant="body2" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/member/login?gym=${slug}`)}>Member login</Typography>
        </Box>
        <Box>
          <Typography fontWeight={700}>Coaches</Typography>
          <Typography variant="body2" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/g/${slug}/apply`)}>Apply to coach</Typography>
        </Box>
      </PublicFooter>
    </Box>
  );
}
