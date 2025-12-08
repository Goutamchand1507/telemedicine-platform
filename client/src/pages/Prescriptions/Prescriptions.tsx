import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  IconButton,
  Tooltip,
  Pagination,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  LocalPharmacy as PharmacyIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Prescription } from '../../types';
import { toast } from 'react-toastify';

interface PrescriptionFormData {
  patientId: string;
  medicationName: string;
  dosage: string;
  instructions: string;
  quantity: number;
  refillsAllowed: number;
  appointmentId?: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  isControlledSubstance: boolean;
  sideEffects?: string;
  contraindications?: string;
}

const Prescriptions: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const { user } = useAuth();

  // Form state for creating prescription
  const [formData, setFormData] = useState<PrescriptionFormData>({
    patientId: '',
    medicationName: '',
    dosage: '',
    instructions: '',
    quantity: 1,
    refillsAllowed: 0,
    isControlledSubstance: false,
  });

  useEffect(() => {
    fetchPrescriptions();
  }, [statusFilter, page]);

  useEffect(() => {
    if (user?.role === 'doctor' && createOpen) {
      fetchPatients();
    }
  }, [createOpen, user]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 10 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.getPrescriptions(params);
      setPrescriptions(response.data.prescriptions);
      setTotalPages(response.data.pagination.pages);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch prescriptions');
      toast.error('Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async (search?: string) => {
    try {
      setLoadingPatients(true);
      const params: any = { limit: 100 };
      if (search) {
        params.search = search;
      }
      const response = await api.getPatients(params);
      setPatients(response.data.patients);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      toast.error('Failed to fetch patients list');
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleViewDetails = async (prescription: Prescription) => {
    try {
      const response = await api.getPrescriptionDetails(prescription.id);
      setSelectedPrescription(response.data.prescription);
      setDetailsOpen(true);
    } catch (err: any) {
      toast.error('Failed to fetch prescription details');
    }
  };

  const handleRequestRefill = async (prescriptionId: string) => {
    try {
      await api.requestRefill(prescriptionId);
      toast.success('Refill request submitted successfully');
      fetchPrescriptions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to request refill');
    }
  };

  const handleCreatePrescription = async () => {
    try {
      if (!formData.patientId || !formData.medicationName || !formData.dosage || !formData.instructions) {
        toast.error('Please fill in all required fields');
        return;
      }

      await api.createPrescription(formData);
      toast.success('Prescription created successfully');
      setCreateOpen(false);
      resetForm();
      fetchPrescriptions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create prescription');
    }
  };

  const handleUpdateStatus = async (prescriptionId: string, status: string) => {
    try {
      await api.updatePrescriptionStatus(prescriptionId, status);
      toast.success('Prescription status updated successfully');
      fetchPrescriptions();
      setDetailsOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update prescription status');
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      medicationName: '',
      dosage: '',
      instructions: '',
      quantity: 1,
      refillsAllowed: 0,
      isControlledSubstance: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'error';
      case 'expired':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && prescriptions.length === 0) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Prescriptions
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchPrescriptions} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {user?.role === 'doctor' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
            >
              New Prescription
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PharmacyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No prescriptions found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.role === 'doctor'
              ? 'Create a new prescription to get started'
              : 'Your prescriptions will appear here'}
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={3}>
            {prescriptions.map((prescription) => (
              <Grid item xs={12} key={prescription.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Typography variant="h6">
                            {prescription.medicationName}
                          </Typography>
                          {prescription.isControlledSubstance && (
                            <Tooltip title="Controlled Substance">
                              <WarningIcon color="warning" fontSize="small" />
                            </Tooltip>
                          )}
                          <Chip
                            label={prescription.status}
                            color={getStatusColor(prescription.status)}
                            size="small"
                          />
                        </Box>

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>Dosage:</strong> {prescription.dosage}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>Instructions:</strong> {prescription.instructions}
                        </Typography>

                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Quantity
                            </Typography>
                            <Typography variant="body2">{prescription.quantity}</Typography>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Refills
                            </Typography>
                            <Typography variant="body2">
                              {prescription.refillsRemaining} / {prescription.refillsAllowed}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Prescribed
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(prescription.prescribedDate)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Expires
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(prescription.expiryDate)}
                            </Typography>
                          </Grid>
                        </Grid>

                        {user?.role === 'patient' && prescription.doctor && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            <strong>Prescribed by:</strong> {prescription.doctor.name}
                          </Typography>
                        )}

                        {user?.role === 'doctor' && prescription.patient && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            <strong>Patient:</strong> {prescription.patient.name}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewDetails(prescription)}
                    >
                      View Details
                    </Button>
                    {user?.role === 'patient' &&
                      prescription.status === 'active' &&
                      prescription.refillsRemaining > 0 && (
                        <Button
                          size="small"
                          color="primary"
                          onClick={() => handleRequestRefill(prescription.id)}
                        >
                          Request Refill
                        </Button>
                      )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {/* Prescription Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Prescription Details</Typography>
            <IconButton onClick={() => setDetailsOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPrescription && (
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h5">
                  {selectedPrescription.medicationName}
                </Typography>
                {selectedPrescription.isControlledSubstance && (
                  <Tooltip title="Controlled Substance">
                    <WarningIcon color="warning" />
                  </Tooltip>
                )}
                <Chip
                  label={selectedPrescription.status}
                  color={getStatusColor(selectedPrescription.status)}
                  size="small"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Dosage
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedPrescription.dosage}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Quantity
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedPrescription.quantity}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Instructions
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedPrescription.instructions}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Refills Remaining
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedPrescription.refillsRemaining} of{' '}
                    {selectedPrescription.refillsAllowed}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Prescribed Date
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {formatDate(selectedPrescription.prescribedDate)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Expiry Date
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {formatDate(selectedPrescription.expiryDate)}
                  </Typography>
                </Grid>
              </Grid>

              {selectedPrescription.pharmacy && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Pharmacy Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Name
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {selectedPrescription.pharmacy.name}
                      </Typography>
                    </Grid>
                    {selectedPrescription.pharmacy.address && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Address
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {selectedPrescription.pharmacy.address}
                        </Typography>
                      </Grid>
                    )}
                    {selectedPrescription.pharmacy.phone && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Phone
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {selectedPrescription.pharmacy.phone}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}

              {selectedPrescription.sideEffects && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Side Effects
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedPrescription.sideEffects}
                  </Typography>
                </>
              )}

              {selectedPrescription.contraindications && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Contraindications
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedPrescription.contraindications}
                  </Typography>
                </>
              )}

              {user?.role === 'patient' && selectedPrescription.doctor && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Prescribed By
                  </Typography>
                  <Typography variant="body1">
                    {selectedPrescription.doctor.name}
                  </Typography>
                  {selectedPrescription.doctor.email && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedPrescription.doctor.email}
                    </Typography>
                  )}
                </>
              )}

              {user?.role === 'doctor' && selectedPrescription.patient && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Patient
                  </Typography>
                  <Typography variant="body1">
                    {selectedPrescription.patient.name}
                  </Typography>
                  {selectedPrescription.patient.email && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedPrescription.patient.email}
                    </Typography>
                  )}
                  {selectedPrescription.patient.phone && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedPrescription.patient.phone}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {user?.role === 'doctor' && selectedPrescription?.status === 'active' && (
            <>
              <Button
                onClick={() =>
                  handleUpdateStatus(selectedPrescription.id, 'completed')
                }
                color="success"
              >
                Mark Completed
              </Button>
              <Button
                onClick={() =>
                  handleUpdateStatus(selectedPrescription.id, 'cancelled')
                }
                color="error"
              >
                Cancel
              </Button>
            </>
          )}
          {user?.role === 'patient' &&
            selectedPrescription?.status === 'active' &&
            selectedPrescription?.refillsRemaining > 0 && (
              <Button
                onClick={() => {
                  handleRequestRefill(selectedPrescription.id);
                  setDetailsOpen(false);
                }}
                color="primary"
                variant="contained"
              >
                Request Refill
              </Button>
            )}
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Prescription Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Prescription</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Patient</InputLabel>
                <Select
                  value={formData.patientId}
                  label="Patient"
                  onChange={(e) =>
                    setFormData({ ...formData, patientId: e.target.value })
                  }
                  disabled={loadingPatients}
                >
                  {loadingPatients ? (
                    <MenuItem disabled>Loading patients...</MenuItem>
                  ) : patients.length === 0 ? (
                    <MenuItem disabled>No patients found</MenuItem>
                  ) : (
                    patients.map((patient) => (
                      <MenuItem key={patient.id} value={patient.id}>
                        {patient.name} {patient.email && `(${patient.email})`}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              {!loadingPatients && patients.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  No patients available. Patients are registered when they book appointments.
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Medication Name"
                value={formData.medicationName}
                onChange={(e) =>
                  setFormData({ ...formData, medicationName: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Dosage"
                placeholder="e.g., 500mg"
                value={formData.dosage}
                onChange={(e) =>
                  setFormData({ ...formData, dosage: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                multiline
                rows={3}
                label="Instructions"
                placeholder="e.g., Take one tablet twice daily with food"
                value={formData.instructions}
                onChange={(e) =>
                  setFormData({ ...formData, instructions: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                type="number"
                label="Quantity"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: parseInt(e.target.value) })
                }
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Refills Allowed"
                value={formData.refillsAllowed}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    refillsAllowed: parseInt(e.target.value),
                  })
                }
                inputProps={{ min: 0, max: 5 }}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isControlledSubstance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isControlledSubstance: e.target.checked,
                      })
                    }
                  />
                }
                label="Controlled Substance"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider />
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Pharmacy Information (Optional)
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pharmacy Name"
                value={formData.pharmacyName || ''}
                onChange={(e) =>
                  setFormData({ ...formData, pharmacyName: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pharmacy Address"
                value={formData.pharmacyAddress || ''}
                onChange={(e) =>
                  setFormData({ ...formData, pharmacyAddress: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pharmacy Phone"
                value={formData.pharmacyPhone || ''}
                onChange={(e) =>
                  setFormData({ ...formData, pharmacyPhone: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Side Effects (Optional)"
                value={formData.sideEffects || ''}
                onChange={(e) =>
                  setFormData({ ...formData, sideEffects: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Contraindications (Optional)"
                value={formData.contraindications || ''}
                onChange={(e) =>
                  setFormData({ ...formData, contraindications: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateOpen(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleCreatePrescription} variant="contained">
            Create Prescription
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Prescriptions;
