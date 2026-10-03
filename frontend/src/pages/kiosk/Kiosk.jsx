import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Link, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Html5Qrcode } from 'html5-qrcode';
import api, { errMsg, fileUrl } from '../../api';
import Logo from '../../components/Logo';
import { brand, DISPLAY_FONT } from '../../theme';
import { initials, peso0 } from '../../utils/format';

const keyName = (slug) => `gymora_kiosk_${slug}`;
const readKey = (slug) => {
  try {
    return sessionStorage.getItem(keyName(slug)) || '';
  } catch {
    return '';
  }
};
const writeKey = (slug, k) => {
  try {
    if (k) sessionStorage.setItem(keyName(slug), k);
    else sessionStorage.removeItem(keyName(slug));
  } catch {
    return false;
  }
  return true;
};

const CAMERA_KEY = 'gymora_kiosk_camera';
const VIRTUAL = /virtual|gopro|obs|snap|camo|manycam|xsplit|droidcam|broadcast|vcam|e2esoft|splitcam|youcam|iriun|epoccam|ndi/i;

function readCamera() {
  try {
    return localStorage.getItem(CAMERA_KEY) || '';
  } catch {
    return '';
  }
}

function saveCamera(id) {
  try {
    localStorage.setItem(CAMERA_KEY, id);
  } catch {
    return;
  }
}

function Scanner({ onScan }) {
  const last = useRef({ text: '', at: 0 });
  const handler = useRef(onScan);
  handler.current = onScan;
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState('');

  useEffect(() => {
    let alive = true;
    Html5Qrcode.getCameras()
      .then((list) => {
        if (!alive) return;
        if (!list.length) {
          setError('No camera found. Members can check in at the front desk.');
          return;
        }
        setCameras(list);
        const saved = readCamera();
        const pick = list.find((c) => c.id === saved) || list.find((c) => !VIRTUAL.test(c.label || '')) || list[0];
        setCameraId(pick.id);
      })
      .catch(() => alive && setError('Camera permission was blocked. Allow the camera in the browser address bar.'));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!cameraId) return undefined;
    let scanner;
    let stopped = false;
    setError('');
    try {
      scanner = new Html5Qrcode('kiosk-reader');
    } catch {
      setError('Camera not available. Members can check in at the front desk.');
      return undefined;
    }
    scanner
      .start({ deviceId: { exact: cameraId } }, { fps: 8, qrbox: 220 }, (text) => {
        const now = Date.now();
        if (text === last.current.text && now - last.current.at < 6000) return;
        last.current = { text, at: now };
        handler.current(text);
      })
      .then(() => {
        if (stopped && scanner.isScanning) scanner.stop().catch(() => {});
      })
      .catch(() => setError('This camera could not start. It may be in use by another app. Pick another camera or close the other app.'));
    return () => {
      stopped = true;
      if (scanner?.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [cameraId]);

  const choose = (e) => {
    saveCamera(e.target.value);
    setCameraId(e.target.value);
  };

  return (
    <Box>
      {cameras.length > 1 && (
        <TextField select size="small" label="Camera" value={cameraId} onChange={choose} SelectProps={{ native: true }} sx={{ mb: 1.5, maxWidth: 360, display: 'flex', mx: 'auto' }}>
          {cameras.map((c, i) => <option key={c.id} value={c.id}>{c.label || `Camera ${i + 1}`}</option>)}
        </TextField>
      )}
      <Box id="kiosk-reader" sx={{ width: '100%', maxWidth: 360, mx: 'auto', borderRadius: 3, overflow: 'hidden', bgcolor: '#000', minHeight: error ? 0 : 240 }} />
      {error && <Alert severity="info" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
}

export default function Kiosk() {
  const { slug } = useParams();
  const [key, setKey] = useState(() => readKey(slug));
  const [gym, setGym] = useState(null);
  const [checking, setChecking] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [guest, setGuest] = useState({ fullName: '', phoneNumber: '' });
  const [result, setResult] = useState(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!key) return;
    setChecking(true);
    api.get(`/kiosk/${slug}/verify`, { headers: { 'x-kiosk-key': key } })
      .then(({ data }) => {
        setGym(data);
        writeKey(slug, key);
      })
      .catch((e) => {
        setError(errMsg(e));
        writeKey(slug, '');
        setKey('');
      })
      .finally(() => setChecking(false));
  }, [key, slug]);

  useEffect(() => {
    if (!result) return undefined;
    const t = setTimeout(() => setResult(null), 6000);
    return () => clearTimeout(t);
  }, [result]);

  const scan = useCallback(async (text) => {
    try {
      const { data } = await api.post(`/kiosk/${slug}/scan`, { code: text }, { headers: { 'x-kiosk-key': key } });
      setResult(data);
    } catch (e) {
      setResult({ ok: false, title: 'Could not check in', message: errMsg(e) });
    }
  }, [slug, key]);

  const unlock = (e) => {
    e.preventDefault();
    const k = keyInput.trim().toUpperCase();
    if (!k) return;
    setError('');
    setKeyInput('');
    setKey(k);
  };

  const lock = () => {
    writeKey(slug, '');
    setGym(null);
    setKey('');
    setCamera(false);
    setResult(null);
  };

  const walkin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/kiosk/${slug}/walkin`, guest, { headers: { 'x-kiosk-key': key } });
      setResult(data);
      setGuest({ fullName: '', phoneNumber: '' });
    } catch (err) {
      setResult({ ok: false, title: 'Could not register', message: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const tone = !result ? {} : result.action === 'cooldown' ? { bg: brand.yellowSoft, fg: brand.yellowInk } : result.ok ? { bg: brand.greenSoft, fg: brand.green } : { bg: brand.redSoft, fg: brand.red };

  const title = (a, b) => (
    <Typography textAlign="center" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 28, textTransform: 'uppercase' }}>
      {a} <Box component="span" sx={{ color: brand.yellow }}>{b}</Box>
    </Typography>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.panel, display: 'grid', placeItems: 'center', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 520, bgcolor: '#fff', borderRadius: 4, p: { xs: 2.5, sm: 4 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Logo height={30} />
          <Link component={RouterLink} to={`/g/${slug}`} variant="body2" fontWeight={700}>Exit kiosk</Link>
        </Stack>

        {!gym ? (
          <Stack component="form" spacing={2} onSubmit={unlock}>
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 26, textTransform: 'uppercase' }}>Unlock <Box component="span" sx={{ color: brand.yellow }}>kiosk</Box></Typography>
            <Typography variant="body2" color="text.secondary">Staff: enter the kiosk key from Settings. This browser tab remembers it until it is closed.</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Kiosk key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} required autoFocus inputProps={{ style: { textTransform: 'uppercase', letterSpacing: 2 } }} />
            <Button type="submit" variant="contained" size="large" disabled={checking}>{checking ? 'Checking…' : 'Unlock'}</Button>
          </Stack>
        ) : (
          <>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              {gym.logoUrl && <Box component="img" src={fileUrl(gym.logoUrl)} alt="" sx={{ height: 28 }} />}
              <Typography variant="body2" fontWeight={700} color="text.secondary">{gym.name}</Typography>
            </Stack>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ mb: 2 }}><Tab label="Member" /><Tab label="Walk-in guest" /></Tabs>
            {tab === 0 ? (
              <Stack spacing={2}>
                {title('Scan your', 'QR')}
                {camera ? <Scanner onScan={scan} /> : <Button variant="outlined" onClick={() => setCamera(true)}>Turn on camera scanner</Button>}
                <Typography variant="caption" color="text.secondary" textAlign="center">Open the GYMORA app, go to Profile and scan your live QR code. Scan once to check in and again when you leave. No phone? Please see the front desk.</Typography>
              </Stack>
            ) : (
              <Stack component="form" spacing={2} onSubmit={walkin}>
                {title('Walk-in', 'guest')}
                <TextField label="Full name" value={guest.fullName} onChange={(e) => setGuest({ ...guest, fullName: e.target.value })} required />
                <TextField label="Phone number" value={guest.phoneNumber} onChange={(e) => setGuest({ ...guest, phoneNumber: e.target.value })} required />
                <Button type="submit" variant="contained" size="large" disabled={busy}>Register visit</Button>
                <Typography variant="caption" color="text.secondary" textAlign="center">Pay the {peso0(gym.walkInFee)} day pass at the front desk.</Typography>
              </Stack>
            )}
            {result && (
              <Box role="status" sx={{ mt: 2, p: 2, borderRadius: 3, textAlign: 'center', bgcolor: tone.bg }}>
                {result.member && (
                  <Stack alignItems="center" spacing={0.5} sx={{ mb: 1.5 }}>
                    <Avatar src={result.member.photoUrl ? fileUrl(result.member.photoUrl) : undefined} sx={{ width: 120, height: 120, fontSize: 40, fontWeight: 800, bgcolor: '#fff', color: brand.yellowInk, border: `4px solid ${tone.fg}` }}>
                      {initials(result.member.name)}
                    </Avatar>
                    <Typography fontWeight={800}>{result.member.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{[result.member.memberCode, result.member.planName].filter(Boolean).join(' · ')}</Typography>
                    {!result.member.photoUrl && <Typography variant="caption" sx={{ color: brand.red, fontWeight: 700 }}>No photo on file. Staff: please verify ID.</Typography>}
                  </Stack>
                )}
                <Typography fontWeight={800} fontSize={20} sx={{ color: tone.fg }}>{result.title}</Typography>
                <Typography variant="body2">{result.message}</Typography>
              </Box>
            )}
            <Button size="small" sx={{ mt: 3 }} onClick={lock}>Lock kiosk</Button>
          </>
        )}
      </Box>
    </Box>
  );
}
