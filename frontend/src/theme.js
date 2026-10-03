import { createTheme } from '@mui/material/styles';

export const brand = {
  yellow: '#FFAF00',
  yellowSoft: '#FFF4DE',
  yellowInk: '#9A6A00',
  orange: '#F4511E',
  orangeSoft: '#FDE8E1',
  green: '#22A04B',
  greenSoft: '#E3F5E9',
  blue: '#0058E8',
  blueSoft: '#DEE7FF',
  purple: '#8E3FD6',
  purpleSoft: '#F2E6FC',
  red: '#D93025',
  redSoft: '#FFDCDC',
  ink: '#0E0E0E',
  ink2: '#595959',
  line: '#E2E2E2',
  fill: '#F5F5F5',
  panel: '#1F1F23',
};

export const DISPLAY_FONT = '"Chakra Petch", "Arial Narrow", Impact, sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: brand.yellow, light: brand.yellowSoft, dark: '#E09A00', contrastText: '#FFFFFF' },
    secondary: { main: brand.orange, light: brand.orangeSoft, contrastText: '#FFFFFF' },
    success: { main: brand.green, light: brand.greenSoft },
    info: { main: brand.blue, light: brand.blueSoft },
    error: { main: brand.red, light: brand.redSoft },
    warning: { main: brand.yellow, light: brand.yellowSoft },
    text: { primary: brand.ink, secondary: brand.ink2 },
    divider: brand.line,
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Manrope", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.05 },
    h2: { fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.05 },
    h3: { fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1 },
    h4: { fontWeight: 800, fontSize: '1.5rem' },
    h5: { fontWeight: 800, fontSize: '1.15rem' },
    h6: { fontWeight: 800, fontSize: '0.95rem' },
    subtitle2: { color: brand.ink2, fontSize: '0.78rem', fontWeight: 500 },
    overline: { fontWeight: 800, fontSize: '0.68rem', letterSpacing: 0.6, lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 6,
          paddingInline: 18,
          transition: 'transform .18s ease, box-shadow .2s ease, background-color .2s ease, border-color .2s ease, color .2s ease',
          '&:hover': { transform: 'translateY(-2px)' },
          '&:active': { transform: 'translateY(0)' },
          '&.Mui-disabled': { transform: 'none' },
        },
        contained: {
          position: 'relative',
          overflow: 'hidden',
          '&::after': { content: '""', position: 'absolute', top: 0, left: '-75%', width: '50%', height: '100%', background: 'linear-gradient(120deg, transparent, rgba(255,255,255,.45), transparent)', transform: 'skewX(-20deg)', transition: 'left .55s ease', pointerEvents: 'none' },
          '&:hover::after': { left: '130%' },
        },
        containedPrimary: { color: '#fff', '&:hover': { boxShadow: '0 10px 22px -8px rgba(255,175,0,.7)' } },
        outlined: { borderColor: '#D2D2D2', color: brand.ink, '&:hover': { borderColor: brand.yellow, background: brand.yellowSoft, boxShadow: '0 8px 18px -10px rgba(0,0,0,.35)' } },
        text: { '&:hover': { transform: 'none', background: brand.yellowSoft } },
      },
    },
    MuiCard: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: { borderColor: brand.line, borderRadius: 10 } } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: brand.line } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiChip: { styleOverrides: { root: { borderRadius: 6, fontWeight: 700, fontSize: '0.7rem' }, sizeSmall: { height: 22 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700, minHeight: 44 } } },
    MuiTableCell: { styleOverrides: { head: { fontSize: '0.72rem', color: brand.ink2, fontWeight: 700, whiteSpace: 'nowrap' }, root: { borderColor: '#F0F0F0' } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&.Mui-selected': { backgroundColor: brand.yellowSoft, color: brand.yellow, '& .MuiListItemIcon-root': { color: brand.yellow } },
          '&.Mui-selected:hover': { backgroundColor: brand.yellowSoft },
        },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 800 } } },
  },
});

export default theme;
