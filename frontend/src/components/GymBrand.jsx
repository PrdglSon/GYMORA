import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import Logo from './Logo';
import { fileUrl } from '../api';
import { brand, DISPLAY_FONT } from '../theme';

export default function GymBrand({ gym, height = 30, maxWidth = 220, onClick }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [gym?.logoUrl]);
  if (!gym) return <Logo height={height} onClick={onClick} />;
  if (gym.logoUrl && !failed) {
    return (
      <Box
        component="img"
        src={fileUrl(gym.logoUrl)}
        alt={gym.name}
        onError={() => setFailed(true)}
        onClick={onClick}
        sx={{ display: 'block', height: height * 1.6, maxWidth, objectFit: 'contain', objectPosition: 'left center', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
      />
    );
  }
  return (
    <Typography
      onClick={onClick}
      title={gym.name}
      sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', color: brand.ink, fontSize: height * 0.8, lineHeight: 1.05, maxWidth, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
    >
      {gym.name}
    </Typography>
  );
}
