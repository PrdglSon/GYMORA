import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import Logo from './Logo';
import { fileUrl } from '../api';
import { brand, DISPLAY_FONT } from '../theme';

function Powered({ children, show }) {
  if (!show) return children;
  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
      {children}
      <Typography component="span" sx={{ mt: 0.4, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, color: 'text.secondary', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
        Powered by <Box component="span" sx={{ fontWeight: 800, color: brand.ink }}>Gymora</Box>
      </Typography>
    </Box>
  );
}

export default function GymBrand({ gym, height = 30, maxWidth = 220, onClick, powered = true }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [gym?.logoUrl]);
  if (!gym) return <Logo height={height} onClick={onClick} />;
  if (gym.logoUrl && !failed) {
    return (
      <Powered show={powered}>
      <Box
        component="img"
        src={fileUrl(gym.logoUrl)}
        alt={gym.name}
        onError={() => setFailed(true)}
        onClick={onClick}
        sx={{ display: 'block', height: height * 1.6, maxWidth, objectFit: 'contain', objectPosition: 'left center', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
      />
      </Powered>
    );
  }
  return (
    <Powered show={powered}>
    <Typography
      onClick={onClick}
      title={gym.name}
      sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', color: brand.ink, fontSize: height * 0.8, lineHeight: 1.05, maxWidth, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
    >
      {gym.name}
    </Typography>
    </Powered>
  );
}
