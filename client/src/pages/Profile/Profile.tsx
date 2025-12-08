import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  TextField,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CameraAlt as CameraIcon,
  Lock as LockIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { toast } from 'react-toastify';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  profileImage?: string;
  // Patient specific
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceGroupNumber?: string;
  bloodType?: string;
  height?: number;
  weight?: number;
  // Doctor specific
  specialization?: string;
  bio?: string;
  consultationFee?: number;
  experienceYears?: number;
  languages?: string[];
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ProfileData | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { user, updateUser } = useAuth();

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.getProfile();
      const userData = response.data.user;
      const profileData = response.data.profile;

      const combined: ProfileData = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        dateOfBirth: userData.dateOfBirth,
        address: userData.address,
        city: userData.city,
        state: userData.state,
        zipCode: userData.zipCode,
        country: userData.country,
        profileImage: userData.profileImage,
      };

      // Add role-specific data
      if (user?.role === 'patient' && profileData) {
        combined.emergencyContactName = profileData.emergency_contact_name;
        combined.emergencyContactPhone = profileData.emergency_contact_phone;
        combined.emergencyContactRelationship = profileData.emergency_contact_relationship;
        combined.insuranceProvider = profileData.insurance_provider;
        combined.insurancePolicyNumber = profileData.insurance_policy_number;
        combined.insuranceGroupNumber = profileData.insurance_group_number;
        combined.bloodType = profileData.blood_type;
        combined.height = profileData.height;
        combined.weight = profileData.weight;
      } else if (user?.role === 'doctor' && profileData) {
        combined.specialization = profileData.specialization;
        combined.bio = profileData.bio;
        combined.consultationFee = profileData.consultation_fee;
        combined.experienceYears = profileData.experience_years;
        combined.languages = profileData.languages;
      }

      setProfile(combined);
      setEditedProfile(combined);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch profile');
      toast.error('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedProfile({ ...profile! });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile({ ...profile! });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSave = async () => {
    try {
      if (!editedProfile) return;

      // Prepare update data
      const updateData: any = {
        firstName: editedProfile.firstName,
        lastName: editedProfile.lastName,
        phone: editedProfile.phone,
        dateOfBirth: editedProfile.dateOfBirth,
        address: editedProfile.address,
        city: editedProfile.city,
        state: editedProfile.state,
        zipCode: editedProfile.zipCode,
        country: editedProfile.country,
      };

      // Add role-specific data
      if (user?.role === 'patient') {
        updateData.emergencyContactName = editedProfile.emergencyContactName;
        updateData.emergencyContactPhone = editedProfile.emergencyContactPhone;
        updateData.emergencyContactRelationship = editedProfile.emergencyContactRelationship;
        updateData.insuranceProvider = editedProfile.insuranceProvider;
        updateData.insurancePolicyNumber = editedProfile.insurancePolicyNumber;
        updateData.insuranceGroupNumber = editedProfile.insuranceGroupNumber;
        updateData.bloodType = editedProfile.bloodType;
        updateData.height = editedProfile.height;
        updateData.weight = editedProfile.weight;
      } else if (user?.role === 'doctor') {
        updateData.specialization = editedProfile.specialization;
        updateData.bio = editedProfile.bio;
        updateData.consultationFee = editedProfile.consultationFee;
        updateData.experienceYears = editedProfile.experienceYears;
        updateData.languages = editedProfile.languages;
      }

      await api.updateProfile(updateData);

      // Upload image if selected
      if (imageFile) {
        const imageResponse = await api.uploadProfileImage(imageFile);
        editedProfile.profileImage = imageResponse.data.profileImageUrl;
      }

      setProfile(editedProfile);
      setIsEditing(false);
      setImageFile(null);
      setImagePreview(null);

      // Update auth context
      updateUser({
        firstName: editedProfile.firstName,
        lastName: editedProfile.lastName,
        profileImage: editedProfile.profileImage,
      });

      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (file.size > maxSize) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error('New passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 8) {
        toast.error('New password must be at least 8 characters');
        return;
      }

      // API call would go here
      // await api.changePassword(passwordData);

      toast.success('Password changed successfully');
      setPasswordDialogOpen(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    }
  };

  const getProfileImageUrl = () => {
    if (imagePreview) return imagePreview;
    if (profile?.profileImage) {
      return `${process.env.REACT_APP_API_URL?.replace('/api', '')}${profile.profileImage}`;
    }
    return undefined;
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container>
        <Alert severity="error">Failed to load profile</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          My Profile
        </Typography>
        <Box>
          {!isEditing ? (
            <>
              <Button
                variant="outlined"
                startIcon={<LockIcon />}
                onClick={() => setPasswordDialogOpen(true)}
                sx={{ mr: 1 }}
              >
                Change Password
              </Button>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleEdit}
              >
                Edit Profile
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                sx={{ mr: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Image Section */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Box position="relative" display="inline-block">
              <Avatar
                src={getProfileImageUrl()}
                alt={`${profile.firstName} ${profile.lastName}`}
                sx={{ width: 150, height: 150, mb: 2, mx: 'auto' }}
              />
              {isEditing && (
                <IconButton
                  component="label"
                  sx={{
                    position: 'absolute',
                    bottom: 20,
                    right: 0,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  <CameraIcon />
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </IconButton>
              )}
            </Box>
            <Typography variant="h5" gutterBottom>
              {profile.firstName} {profile.lastName}
            </Typography>
            <Chip
              label={user?.role?.toUpperCase()}
              color="primary"
              size="small"
              sx={{ mb: 1 }}
            />
            {user?.emailVerified && (
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <VerifiedIcon color="success" fontSize="small" />
                <Typography variant="caption" color="success.main">
                  Verified
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Profile Information */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={editedProfile?.firstName || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, firstName: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={editedProfile?.lastName || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, lastName: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={profile.email}
                  disabled
                  helperText="Email cannot be changed"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={editedProfile?.phone || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, phone: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date of Birth"
                  InputLabelProps={{ shrink: true }}
                  value={editedProfile?.dateOfBirth?.split('T')[0] || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, dateOfBirth: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={editedProfile?.address || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, address: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={editedProfile?.city || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, city: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="State"
                  value={editedProfile?.state || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, state: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Zip Code"
                  value={editedProfile?.zipCode || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, zipCode: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Country"
                  value={editedProfile?.country || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile!, country: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </Grid>
            </Grid>

            {/* Patient Specific Fields */}
            {user?.role === 'patient' && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Emergency Contact
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Contact Name"
                      value={editedProfile?.emergencyContactName || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          emergencyContactName: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Contact Phone"
                      value={editedProfile?.emergencyContactPhone || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          emergencyContactPhone: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Relationship"
                      value={editedProfile?.emergencyContactRelationship || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          emergencyContactRelationship: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>
                </Grid>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Insurance Information
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Insurance Provider"
                      value={editedProfile?.insuranceProvider || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          insuranceProvider: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Policy Number"
                      value={editedProfile?.insurancePolicyNumber || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          insurancePolicyNumber: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Group Number"
                      value={editedProfile?.insuranceGroupNumber || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          insuranceGroupNumber: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>
                </Grid>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Health Information
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Blood Type"
                      value={editedProfile?.bloodType || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          bloodType: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Height (cm)"
                      value={editedProfile?.height || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          height: parseFloat(e.target.value),
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Weight (kg)"
                      value={editedProfile?.weight || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          weight: parseFloat(e.target.value),
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>
                </Grid>
              </>
            )}

            {/* Doctor Specific Fields */}
            {user?.role === 'doctor' && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Professional Information
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Specialization"
                      value={editedProfile?.specialization || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          specialization: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Bio"
                      value={editedProfile?.bio || ''}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile!, bio: e.target.value })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Consultation Fee"
                      value={editedProfile?.consultationFee || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          consultationFee: parseFloat(e.target.value),
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Years of Experience"
                      value={editedProfile?.experienceYears || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          experienceYears: parseInt(e.target.value),
                        })
                      }
                      disabled={!isEditing}
                    />
                  </Grid>
                </Grid>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Change Password Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Current Password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="New Password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                helperText="Must be at least 8 characters"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Confirm New Password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePasswordChange} variant="contained">
            Change Password
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Profile;
