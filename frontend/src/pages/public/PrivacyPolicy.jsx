import { Box, Container, Typography } from '@mui/material';
import { PublicNav, PublicFooter } from './PublicLayout';

const SECTIONS = [
  ['Who we are', 'GYMORA is a web-based fitness management information system used by fitness centers to manage memberships, attendance, coaches, payments, inventory and community engagement. Each fitness center that uses GYMORA manages the records of its own members, coaches and staff.'],
  ['Information we collect', 'We collect the information that members, coaches, staff and gym owners enter into GYMORA: names, email addresses, phone numbers, profile photos, fitness goals, body measurements, attendance records, membership plans, payments and school IDs submitted for student verification.'],
  ['How we use it', 'The information is used only to run the gym services: creating accounts, recording check-ins and check-outs, processing payments, matching members with coaches, generating reports for the gym, and sending account emails such as welcome messages, renewal reminders and password reset links.'],
  ['Email', 'GYMORA sends emails from the GYMORA Gmail account through the Gmail API. It only sends messages; it does not read, store or share the contents of any mailbox.'],
  ['Sharing', 'We do not sell personal information. Records are visible only to the fitness center the person belongs to and to the GYMORA platform owner for support. Uploaded files are stored with Cloudinary and data is stored in MongoDB Atlas.'],
  ['Security', 'Passwords are encrypted with bcrypt, logins use secure tokens, and each user only sees the features of their role.'],
  ['Your choices', 'You can update your profile at any time. To delete your account or your data, contact your fitness center or the GYMORA platform owner.'],
  ['Contact', 'For questions about this policy, contact the GYMORA team through your fitness center.'],
];

export default function PrivacyPolicy() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav />
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>Privacy Policy</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>Last updated October 2026</Typography>
        {SECTIONS.map(([title, body]) => (
          <Box key={title} sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>{title}</Typography>
            <Typography color="text.secondary">{body}</Typography>
          </Box>
        ))}
      </Container>
      <PublicFooter />
    </Box>
  );
}
