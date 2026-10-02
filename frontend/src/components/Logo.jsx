import { Box } from '@mui/material';
import logo from '../assets/gymora-logo.png';
import logoWhite from '../assets/gymora-logo-white.png';
import logoOnYellow from '../assets/gymora-logo-onyellow.png';

export default function Logo({ height = 30, light = false, onYellow = false, onClick }) {
  const src = onYellow ? logoOnYellow : light ? logoWhite : logo;
  return <Box component="img" src={src} alt="GYMORA" onClick={onClick} sx={{ height, width: 'auto', display: 'block', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }} />;
}
