import { Button, IconButton, Tooltip } from '@mui/material';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import { Link as RouterLink, useLocation } from 'react-router-dom';

export default function HomeButton({ compact = false, label = 'Home', sx }) {
  const { pathname } = useLocation();
  if (pathname === '/') return null;
  if (compact) {
    return (
      <Tooltip title="Go to the GYMORA home page">
        <IconButton component={RouterLink} to="/" aria-label="GYMORA home page" sx={sx}><HomeOutlined /></IconButton>
      </Tooltip>
    );
  }
  return (
    <Button component={RouterLink} to="/" variant="outlined" startIcon={<HomeOutlined />} aria-label="Go to the GYMORA home page" sx={{ whiteSpace: 'nowrap', ...sx }}>
      {label}
    </Button>
  );
}
