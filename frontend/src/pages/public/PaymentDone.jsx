import { useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import Logo from '../../components/Logo';
import { brand } from '../../theme';

export default function PaymentDone() {
  const [params] = useSearchParams();
  const cancelled = !!params.get('cancelled');
  const ref = params.get('ref');
  const Icon = cancelled ? CancelOutlined : CheckCircleOutline;
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: brand.fill }}>
      <Box sx={{ maxWidth: 420, width: '100%', bgcolor: '#fff', borderRadius: 4, p: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><Logo height={28} /></Box>
        <Icon sx={{ fontSize: 72, color: cancelled ? brand.red : brand.green }} />
        <Typography variant="h5" sx={{ mt: 1 }}>{cancelled ? 'Payment cancelled' : 'Payment successful'}</Typography>
        {ref && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Reference {ref}</Typography>}
        <Typography variant="body2" sx={{ mt: 2 }}>
          {cancelled ? 'No money was taken. Let the cashier know if you want to try again or pay another way.' : 'Thank you! Show this screen to the cashier. PayMongo also sends a receipt to your email if you gave one. You can close this page.'}
        </Typography>
      </Box>
    </Box>
  );
}
