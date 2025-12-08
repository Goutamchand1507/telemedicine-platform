import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
} from '@mui/material';
import {
  CalendarToday,
  VideoCall,
  Description,
  LocalPharmacy,
  Payment,
  People,
  TrendingUp,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import apiService from '../../services/api';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch dashboard data based on user role
  const { data: appointmentsData } = useQuery(
    'appointments',
    () => apiService.getAppointments({ limit: 5 }),
    { enabled: !!user }
  );

  const { data: healthRecordsData } = useQuery(
    'healthRecords',
    () => apiService.getHealthRecords({ limit: 5 }),
    { enabled: !!user }
  );

  const { data: prescriptionsData } = useQuery(
    'prescriptions',
    () => apiService.getPrescriptions({ limit: 5 }),
    { enabled: !!user }
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getQuickActions = () => {
    if (user?.role === 'patient') {
      return [
        { title: 'Book Appointment', icon: <CalendarToday />, path: '/doctors', color: 'primary' },
        { title: 'View Health Records', icon: <Description />, path: '/health-records', color: 'secondary' },
        { title: 'My Prescriptions', icon: <LocalPharmacy />, path: '/prescriptions', color: 'success' },
        { title: 'Billing', icon: <Payment />, path: '/billing', color: 'warning' },
      ];
    } else if (user?.role === 'doctor') {
      return [
        { title: 'Today\'s Appointments', icon: <CalendarToday />, path: '/appointments', color: 'primary' },
        { title: 'Video Consultations', icon: <VideoCall />, path: '/appointments', color: 'secondary' },
        { title: 'Patient Records', icon: <Description />, path: '/health-records', color: 'success' },
        { title: 'Prescriptions', icon: <LocalPharmacy />, path: '/prescriptions', color: 'warning' },
      ];
    } else {
      return [
        { title: 'Admin Dashboard', icon: <TrendingUp />, path: '/admin/dashboard', color: 'primary' },
        { title: 'Manage Users', icon: <People />, path: '/admin/users', color: 'secondary' },
        { title: 'View Appointments', icon: <CalendarToday />, path: '/admin/appointments', color: 'success' },
        { title: 'Billing Overview', icon: <Payment />, path: '/admin/billing', color: 'warning' },
      ];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'confirmed':
        return 'primary';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
      case 'no_show':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {getGreeting()}, {user?.firstName}!
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Welcome to your telemedicine dashboard
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {getQuickActions().map((action, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={() => navigate(action.path)}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: `${action.color}.main`,
                      width: 56,
                      height: 56,
                    }}
                  >
                    {action.icon}
                  </Avatar>
                </Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {action.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Appointments */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Recent Appointments
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/appointments')}
                >
                  View All
                </Button>
              </Box>
              {appointmentsData?.data?.appointments?.length > 0 ? (
                <List>
                  {appointmentsData.data.appointments.map((appointment: any) => (
                    <ListItem key={appointment.id} divider>
                      <ListItemAvatar>
                        <Avatar>
                          <CalendarToday />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">
                              {user?.role === 'patient' 
                                ? `Dr. ${appointment.doctor?.name}` 
                                : appointment.patient?.name}
                            </Typography>
                            <Chip
                              label={appointment.status}
                              size="small"
                              color={getStatusColor(appointment.status) as any}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="textSecondary">
                            {new Date(appointment.scheduledAt).toLocaleDateString()} at{' '}
                            {new Date(appointment.scheduledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                  No recent appointments
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Health Records */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Recent Health Records
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/health-records')}
                >
                  View All
                </Button>
              </Box>
              {healthRecordsData?.data?.healthRecords?.length > 0 ? (
                <List>
                  {healthRecordsData.data.healthRecords.map((record: any) => (
                    <ListItem key={record.id} divider>
                      <ListItemAvatar>
                        <Avatar>
                          <Description />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={record.title}
                        secondary={
                          <Typography variant="body2" color="textSecondary">
                            {new Date(record.recordDate).toLocaleDateString()} - {record.recordType}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                  No recent health records
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Prescriptions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Recent Prescriptions
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/prescriptions')}
                >
                  View All
                </Button>
              </Box>
              {prescriptionsData?.data?.prescriptions?.length > 0 ? (
                <List>
                  {prescriptionsData.data.prescriptions.map((prescription: any) => (
                    <ListItem key={prescription.id} divider>
                      <ListItemAvatar>
                        <Avatar>
                          <LocalPharmacy />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={prescription.medicationName}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {prescription.dosage} - {prescription.instructions}
                            </Typography>
                            <Chip
                              label={prescription.status}
                              size="small"
                              color={prescription.status === 'active' ? 'success' : 'default'}
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                  No recent prescriptions
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Profile Summary
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  src={user?.profileImage}
                  alt={user?.firstName}
                  sx={{ width: 64, height: 64, mr: 2 }}
                >
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
                  </Typography>
                  <Chip
                    label={user?.emailVerified ? 'Verified' : 'Unverified'}
                    size="small"
                    color={user?.emailVerified ? 'success' : 'warning'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              </Box>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/profile')}
              >
                Update Profile
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
