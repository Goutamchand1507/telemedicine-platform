import React from 'react';
import { Container, Paper, Typography, Box, Button } from '@mui/material';

const VerifyEmail: React.FC = () => {
  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ padding: 4, width: '100%', textAlign: 'center' }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Email Verification
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Please check your email and click the verification link to activate your account.
          </Typography>
          <Button variant="contained" fullWidth>
            Resend Verification Email
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default VerifyEmail;
