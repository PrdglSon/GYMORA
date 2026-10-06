import { Box, Button, Stack, Typography, Container, Link } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import GymBrand from '../../components/GymBrand';
import { useAuth, homeFor } from '../../context/AuthContext';
import { brand } from '../../theme';

export function PublicNav({ links = [], active, onLink, loginTo = '/login', gym }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  return (
    <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: '#fff', borderBottom: `1px solid ${brand.line}` }}>
      <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.5, flexWrap: 'wrap' }}>
        {gym ? <GymBrand gym={gym} height={30} onClick={() => navigate(`/g/${gym.slug}`)} /> : <Logo height={30} onClick={() => navigate('/')} />}
        <Stack direction="row" spacing={2.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
          {links.map((l) => (
            <Box key={l} component="button" onClick={() => onLink?.(l)} sx={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit', fontWeight: 600, fontSize: 14, py: 0.5, borderBottom: `2px solid ${active === l ? brand.yellow : 'transparent'}` }}>{l}</Box>
          ))}
        </Stack>
        <Stack direction="row" spacing={1}>
          {role ? (
            <Button variant="contained" onClick={() => navigate(homeFor(role))}>Open dashboard</Button>
          ) : (
            <>
              <Button variant="outlined" component={RouterLink} to={loginTo}>Log In</Button>
              <Button variant="contained" component={RouterLink} to="/own-a-gym">Own a Gym?</Button>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

export function PublicFooter({ children }) {
  return (
    <Box sx={{ mt: 'auto', pt: 6 }}>
      <Box component="footer" sx={{ bgcolor: brand.yellow, color: '#fff', py: 5 }}>
        <Container maxWidth="lg" sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0,1fr))' } }}>
          <Box>
            <Logo height={30} onYellow />
            <Typography fontWeight={700} sx={{ mt: 1 }}>Strengthening Fitness<br />Through Technology.</Typography>
          </Box>
          {children}
        </Container>
        <Container maxWidth="lg" sx={{ mt: 4, pt: 2, borderTop: '1px solid rgba(255,255,255,0.4)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2">© {new Date().getFullYear()} GYMORA</Typography>
        </Container>
      </Box>
    </Box>
  );
}
