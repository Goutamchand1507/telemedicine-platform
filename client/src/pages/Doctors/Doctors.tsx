import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search,
  Person,
  CalendarToday,
  VideoCall,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../services/api';
import { toast } from 'react-toastify';

interface Doctor {
  id: string;
  userId: string;
  name: string;
  specialization: string;
  bio?: string;
  consultationFee: number;
  experienceYears?: number;
  rating: number;
  totalReviews: number;
  profileImage?: string;
  languages?: string[];
}

const Doctors: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [specialization, setSpecialization] = useState('');
  const navigate = useNavigate();

  // Booking dialog state
  const [bookingDialog, setBookingDialog] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingData, setBookingData] = useState({
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    type: 'consultation',
    appointmentMode: 'video', // video or in_person
    reasonForVisit: '',
    durationMinutes: 30,
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await api.getDoctors({
        search: searchTerm || undefined,
        specialization: specialization || undefined,
      });
      setDoctors(response.data.doctors);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchDoctors();
  };

  const handleBookAppointment = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setBookingDialog(true);
  };

  const handleCloseDialog = () => {
    setBookingDialog(false);
    setSelectedDoctor(null);
    setBookingData({
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      type: 'consultation',
      appointmentMode: 'video',
      reasonForVisit: '',
      durationMinutes: 30,
    });
  };

  const handleConfirmBooking = async () => {
    if (!selectedDoctor) return;

    try {
      setBookingLoading(true);
      await api.createAppointment({
        doctorId: selectedDoctor.id,
        scheduledAt: bookingData.scheduledAt.toISOString(),
        type: bookingData.type,
        reasonForVisit: bookingData.reasonForVisit,
        durationMinutes: bookingData.durationMinutes,
      });

      toast.success('Appointment booked successfully!');
      handleCloseDialog();
      navigate('/appointments');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
    }
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
          Find a Doctor
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Search for doctors by name or specialization
        </Typography>
      </Box>

      {/* Search Filters */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search by name or specialization"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Specialization</InputLabel>
              <Select
                value={specialization}
                label="Specialization"
                onChange={(e) => setSpecialization(e.target.value)}
              >
                <MenuItem value="">All Specializations</MenuItem>
                <MenuItem value="General Practice">General Practice</MenuItem>
                <MenuItem value="Cardiology">Cardiology</MenuItem>
                <MenuItem value="Dermatology">Dermatology</MenuItem>
                <MenuItem value="Pediatrics">Pediatrics</MenuItem>
                <MenuItem value="Psychiatry">Psychiatry</MenuItem>
                <MenuItem value="Orthopedics">Orthopedics</MenuItem>
                <MenuItem value="Neurology">Neurology</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              sx={{ height: '56px' }}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Doctors List */}
      {doctors.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No doctors found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your search criteria
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {doctors.map((doctor) => (
            <Grid item xs={12} sm={6} md={4} key={doctor.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      src={doctor.profileImage}
                      sx={{ width: 80, height: 80, mb: 2 }}
                    >
                      <Person sx={{ fontSize: 40 }} />
                    </Avatar>
                    <Typography variant="h6" align="center" gutterBottom>
                      Dr. {doctor.name}
                    </Typography>
                    <Chip
                      label={doctor.specialization}
                      size="small"
                      color="primary"
                      sx={{ mb: 1 }}
                    />
                  </Box>

                  {doctor.bio && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {doctor.bio}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    <Rating value={Number(doctor.rating)} readOnly precision={0.1} size="small" />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({doctor.totalReviews})
                    </Typography>
                  </Box>

                  {doctor.experienceYears && (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 1 }}>
                      {doctor.experienceYears} years experience
                    </Typography>
                  )}

                  <Typography variant="h6" color="primary" align="center" sx={{ mt: 2 }}>
                    ₹{doctor.consultationFee}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center" display="block">
                    per consultation
                  </Typography>
                </CardContent>

                {/* ONLY BOOK BUTTON — View Profile Removed */}
                <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<CalendarToday />}
                    onClick={() => handleBookAppointment(doctor)}
                  >
                    Book
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Booking Dialog */}
      <Dialog open={bookingDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Book Appointment with Dr. {selectedDoctor?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DateTimePicker
                label="Appointment Date & Time"
                value={bookingData.scheduledAt}
                onChange={(newValue) =>
                  newValue && setBookingData({ ...bookingData, scheduledAt: newValue })
                }
                minDateTime={new Date()}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: { mb: 2 },
                  },
                }}
              />
            </LocalizationProvider>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Consultation Mode</InputLabel>
              <Select
                value={bookingData.appointmentMode}
                label="Consultation Mode"
                onChange={(e) => setBookingData({ ...bookingData, appointmentMode: e.target.value })}
              >
                <MenuItem value="video">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VideoCall fontSize="small" />
                    Video Consultation
                  </Box>
                </MenuItem>
                <MenuItem value="in_person">In-Person Visit</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Duration</InputLabel>
              <Select
                value={bookingData.durationMinutes}
                label="Duration"
                onChange={(e) =>
                  setBookingData({ ...bookingData, durationMinutes: Number(e.target.value) })
                }
              >
                <MenuItem value={15}>15 minutes</MenuItem>
                <MenuItem value={30}>30 minutes</MenuItem>
                <MenuItem value={45}>45 minutes</MenuItem>
                <MenuItem value={60}>60 minutes</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Reason for Visit"
              value={bookingData.reasonForVisit}
              onChange={(e) => setBookingData({ ...bookingData, reasonForVisit: e.target.value })}
              placeholder="Describe your symptoms or reason for consultation..."
              required
            />

            {selectedDoctor && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Consultation Fee
                </Typography>
                <Typography variant="h5" color="primary">
                  ₹{selectedDoctor.consultationFee}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDialog} disabled={bookingLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBooking}
            variant="contained"
            disabled={bookingLoading || !bookingData.reasonForVisit.trim()}
            startIcon={bookingLoading ? <CircularProgress size={20} /> : <CalendarToday />}
          >
            Confirm Booking
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Doctors;
