import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  CalendarToday as CalendarIcon,
  EventAvailable as EventAvailableIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as DoctorIcon,
  Description as DescriptionIcon,
  LocalPharmacy as PharmacyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import { toast } from 'react-toastify';

interface DashboardStats {
  userStats: {
    total: number;
    patients: number;
    doctors: number;
    admins: number;
    activeUsers: number;
    newThisMonth: number;
  };
  appointmentStats: {
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    inProgress: number;
    todayCount: number;
  };
  healthRecordsStats: {
    total: number;
    thisMonth: number;
  };
  prescriptionStats: {
    total: number;
    active: number;
    thisMonth: number;
  };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard');
      setStats(response.data.data);
      setError('');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch dashboard statistics';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    trend?: 'up' | 'down';
    trendValue?: string;
  }> = ({ title, value, icon, color, subtitle, trend, trendValue }) => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" gutterBottom>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && trendValue && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                {trend === 'up' ? (
                  <TrendingUpIcon color="success" fontSize="small" />
                ) : (
                  <TrendingDownIcon color="error" fontSize="small" />
                )}
                <Typography
                  variant="caption"
                  color={trend === 'up' ? 'success.main' : 'error.main'}
                >
                  {trendValue}
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}15`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !stats) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error || 'No data available'}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your telemedicine platform
        </Typography>
      </Box>

      {/* User Statistics */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          User Statistics
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Users"
              value={stats.userStats.total}
              icon={<PeopleIcon sx={{ color: '#1976d2', fontSize: 32 }} />}
              color="#1976d2"
              subtitle={`${stats.userStats.activeUsers} active`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Patients"
              value={stats.userStats.patients}
              icon={<HospitalIcon sx={{ color: '#2e7d32', fontSize: 32 }} />}
              color="#2e7d32"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Doctors"
              value={stats.userStats.doctors}
              icon={<DoctorIcon sx={{ color: '#ed6c02', fontSize: 32 }} />}
              color="#ed6c02"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="New This Month"
              value={stats.userStats.newThisMonth}
              icon={<PersonAddIcon sx={{ color: '#9c27b0', fontSize: 32 }} />}
              color="#9c27b0"
              trend="up"
              trendValue="New registrations"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Appointment Statistics */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Appointment Statistics
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Appointments"
              value={stats.appointmentStats.total}
              icon={<CalendarIcon sx={{ color: '#0288d1', fontSize: 32 }} />}
              color="#0288d1"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Today's Appointments"
              value={stats.appointmentStats.todayCount}
              icon={<EventAvailableIcon sx={{ color: '#d32f2f', fontSize: 32 }} />}
              color="#d32f2f"
              subtitle="Scheduled for today"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="In Progress"
              value={stats.appointmentStats.inProgress}
              icon={<TrendingUpIcon sx={{ color: '#f57c00', fontSize: 32 }} />}
              color="#f57c00"
              subtitle="Currently active"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Appointment Status Breakdown */}
      <Box mb={4}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Appointment Status Breakdown
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {stats.appointmentStats.scheduled}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Scheduled
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  {stats.appointmentStats.completed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="error.main">
                  {stats.appointmentStats.cancelled}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cancelled
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="warning.main">
                  {stats.appointmentStats.inProgress}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  In Progress
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {/* Other Statistics */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Platform Activity
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <StatCard
              title="Health Records"
              value={stats.healthRecordsStats.total}
              icon={<DescriptionIcon sx={{ color: '#0097a7', fontSize: 32 }} />}
              color="#0097a7"
              subtitle={`${stats.healthRecordsStats.thisMonth} this month`}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <StatCard
              title="Active Prescriptions"
              value={stats.prescriptionStats.active}
              icon={<PharmacyIcon sx={{ color: '#5e35b1', fontSize: 32 }} />}
              color="#5e35b1"
              subtitle={`${stats.prescriptionStats.total} total`}
            />
          </Grid>
        </Grid>
      </Box>

      {/* System Status */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          System Status
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
          <Chip label="All Systems Operational" color="success" />
          <Chip label={`${stats.userStats.activeUsers} Active Users`} />
          <Chip label={`${stats.appointmentStats.todayCount} Appointments Today`} />
          <Chip label={`${stats.prescriptionStats.active} Active Prescriptions`} />
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminDashboard;
