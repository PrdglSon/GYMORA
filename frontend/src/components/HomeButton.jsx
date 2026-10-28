import { IconButton, Tooltip } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { brand } from '../theme';

export default function HomeButton({ size = 38, sx }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (pathname === '/') return null;
  const goBack = () => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate('/');
  };
  return (
    <Tooltip title="Back">
      <IconButton
        onClick={goBack}
        aria-label="Go back"
        sx={{ width: size, height: size, flex: 'none', border: `1px solid ${brand.line}`, bgcolor: '#fff', color: brand.ink, transition: 'all .15s', '&:hover': { bgcolor: brand.yellowSoft, borderColor: brand.yellow }, ...sx }}
      >
        <ArrowBackRounded fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
