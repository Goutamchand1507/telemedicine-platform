import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  Chip,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  VideoCall as VideoCallIcon,
  Schedule,
  Person,
  CalendarToday,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface Appointment {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  type: string;
  reasonForVisit: string;
  status: string;
  doctor?: {
    name: string;
    specialization: string;
  };
  patient?: {
    name: string;
  };
}

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.getAppointments({ limit: 20 });
      setAppointments(response.data.appointments);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return 'primary';
      case 'in_progress':
        return 'success';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const canJoinCall = (appointment: Appointment) => {
    // Check if appointment is scheduled or in progress
    if (appointment.status !== 'scheduled' && appointment.status !== 'in_progress') {
      return false;
    }

    // Check if appointment time is within 15 minutes before or after scheduled time
    const scheduledTime = new Date(appointment.scheduledAt).getTime();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;

    return now >= scheduledTime - fifteenMinutes;
  };

  const handleJoinCall = (appointmentId: string) => {
    navigate(`/video-call/${appointmentId}`);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Appointments
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage your upcoming and past appointments
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {appointments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No appointments found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {user?.role === 'patient'
              ? 'Book an appointment with a doctor to get started'
              : 'No patient appointments scheduled yet'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {appointments.map((appointment) => (
            <Grid item xs={12} key={appointment.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {appointment.type.charAt(0).toUpperCase() + appointment.type.slice(1)} Consultation
                      </Typography>
                      <Chip
                        label={appointment.status.replace('_', ' ').toUpperCase()}
                        color={getStatusColor(appointment.status)}
                        size="small"
                      />
                    </Box>
                    {canJoinCall(appointment) && (
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<VideoCallIcon />}
                        onClick={() => handleJoinCall(appointment.id)}
                        sx={{ minWidth: 150 }}
                      >
                        Join Video Call
                      </Button>
                    )}
                  </Box>

                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CalendarToday fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(appointment.scheduledAt)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Duration: {appointment.durationMinutes} minutes
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {user?.role === 'patient' && appointment.doctor
                            ? `Dr. ${appointment.doctor.name} - ${appointment.doctor.specialization}`
                            : appointment.patient
                            ? `Patient: ${appointment.patient.name}`
                            : 'N/A'}
                        </Typography>
                      </Box>
                    </Grid>
                    {appointment.reasonForVisit && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Reason:</strong> {appointment.reasonForVisit}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    onClick={() => navigate(`/appointments/${appointment.id}`)}
                  >
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default Appointments;
