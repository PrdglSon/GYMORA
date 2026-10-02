import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { brand, DISPLAY_FONT } from '../../theme';

export default function AuthLayout({ line1, accent, sub, children, wide, badge }) {
  const navigate = useNavigate();
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: wide ? '0.8fr 1.2fr' : '1fr 1fr' }, gap: 5, alignItems: 'center', maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 6 }, py: 4 }}>
      <Box>
        <Logo height={34} onClick={() => navigate('/')} />
        {badge && <Box sx={{ display: 'inline-block', mt: { xs: 3, md: 6 }, px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: brand.yellowSoft, color: brand.yellowInk, fontWeight: 800, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>{badge}</Box>}
        <Typography component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.05, fontSize: { xs: 34, md: 54 }, mt: badge ? 2 : { xs: 3, md: 8 } }}>
          {line1}<br /><Box component="span" sx={{ color: brand.yellow }}>{accent}</Box>
        </Typography>
        <Box sx={{ width: 140, borderTop: `1px solid ${brand.ink}`, my: 2.5 }} />
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>{sub}</Typography>
      </Box>
      <Box sx={{ border: `1px solid ${brand.yellow}`, borderRadius: 4, p: { xs: 2.5, md: 5 } }}>{children}</Box>
    </Box>
  );
}
