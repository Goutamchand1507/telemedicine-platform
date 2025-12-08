import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";

import {
  Container,
  Typography,
  Card,
  Avatar,
  Box,
  Chip,
  Divider,
  CircularProgress,
  Button
} from "@mui/material";

interface Doctor {
  id: string;
  userId: string;
  name: string;
  specialization: string;
  bio: string;
  consultationFee: number;
  experienceYears: number;
  profileImage?: string;
}

const DoctorDetails: React.FC = () => {
  const { id } = useParams();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await axiosInstance.get(`/users/doctors/${id}`);
        setDoctor(response.data.data.doctor);
      } catch (error) {
        console.error("Error fetching doctor:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDoctor();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!doctor) {
    return (
      <Container sx={{ mt: 5 }}>
        <Typography variant="h5" color="error">
          Doctor not found
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 5 }}>
      <Card sx={{ p: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Avatar
            src={doctor.profileImage || ""}
            alt={doctor.name}
            sx={{ width: 100, height: 100 }}
          />

          <Box>
            <Typography variant="h4" fontWeight="bold">
              {doctor.name}
            </Typography>

            <Chip label={doctor.specialization} color="primary" sx={{ mt: 1 }} />
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6">About</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {doctor.bio}
        </Typography>

        <Typography variant="h6">Experience</Typography>
        <Typography variant="body1">{doctor.experienceYears} years</Typography>

        <Typography variant="h6" sx={{ mt: 2 }}>
          Consultation Fee
        </Typography>
        <Typography variant="body1">₹{doctor.consultationFee}</Typography>

        <Button variant="contained" color="primary" sx={{ mt: 4 }}>
          Book Appointment
        </Button>
      </Card>
    </Container>
  );
};

export default DoctorDetails;
