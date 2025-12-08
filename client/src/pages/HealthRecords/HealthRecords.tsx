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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Description as DescriptionIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { HealthRecord } from '../../types';
import { toast } from 'react-toastify';

const RECORD_TYPES = [
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'note', label: 'Note' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'vital_signs', label: 'Vital Signs' },
  { value: 'other', label: 'Other' },
];

interface HealthRecordFormData {
  patientId: string;
  recordType: string;
  title: string;
  description?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  recordDate: string;
  vitalSigns?: any;
  labResults?: any;
  medicationsPrescribed?: any;
}

const HealthRecords: React.FC = () => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const { user } = useAuth();

  const [formData, setFormData] = useState<HealthRecordFormData>({
    patientId: '',
    recordType: 'note',
    title: '',
    recordDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchRecords();
  }, [recordTypeFilter, page]);

  useEffect(() => {
    if (user?.role === 'doctor' && (createOpen || editOpen)) {
      fetchPatients();
    }
  }, [createOpen, editOpen, user]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 10 };
      if (recordTypeFilter !== 'all') {
        params.recordType = recordTypeFilter;
      }
      const response = await api.getHealthRecords(params);
      setRecords(response.data.healthRecords);
      setTotalPages(response.data.pagination.pages);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch health records');
      toast.error('Failed to fetch health records');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      setLoadingPatients(true);
      const response = await api.getPatients({ limit: 100 });
      setPatients(response.data.patients);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      toast.error('Failed to fetch patients list');
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleViewDetails = async (record: HealthRecord) => {
    try {
      const response = await api.getHealthRecordDetails(record.id);
      setSelectedRecord(response.data.healthRecord);
      setDetailsOpen(true);
    } catch (err: any) {
      toast.error('Failed to fetch health record details');
    }
  };

  const handleCreateRecord = async () => {
    try {
      if (!formData.title || !formData.recordType || !formData.recordDate) {
        toast.error('Please fill in all required fields');
        return;
      }

      // For patients, set their own ID
      let patientId = formData.patientId;
      if (user?.role === 'patient') {
        // Get patient profile to get patient ID
        const profileResponse = await api.getProfile();
        patientId = profileResponse.data.profile.id;
      }

      await api.createHealthRecord({ ...formData, patientId }, selectedFile || undefined);
      toast.success('Health record created successfully');
      setCreateOpen(false);
      resetForm();
      setSelectedFile(null);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create health record');
    }
  };

  const handleUpdateRecord = async () => {
    try {
      if (!selectedRecord || !formData.title) {
        toast.error('Please fill in all required fields');
        return;
      }

      await api.updateHealthRecord(selectedRecord.id, formData);
      toast.success('Health record updated successfully');
      setEditOpen(false);
      resetForm();
      fetchRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update health record');
    }
  };

  const handleDeleteRecord = async () => {
    try {
      if (!selectedRecord) return;

      await api.deleteHealthRecord(selectedRecord.id);
      toast.success('Health record deleted successfully');
      setDeleteDialogOpen(false);
      setDetailsOpen(false);
      setSelectedRecord(null);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete health record');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (file.size > maxSize) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleDownloadFile = (fileUrl: string) => {
    const fullUrl = `${process.env.REACT_APP_API_URL?.replace('/api', '')}${fileUrl}`;
    window.open(fullUrl, '_blank');
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      recordType: 'note',
      title: '',
      recordDate: new Date().toISOString().split('T')[0],
    });
    setSelectedFile(null);
  };

  const openEditDialog = (record: HealthRecord) => {
    setSelectedRecord(record);
    setFormData({
      patientId: '',
      recordType: record.recordType,
      title: record.title,
      description: record.description,
      diagnosis: record.diagnosis,
      treatmentPlan: record.treatmentPlan,
      recordDate: record.recordDate.split('T')[0],
    });
    setEditOpen(true);
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'lab_result':
        return 'primary';
      case 'imaging':
        return 'secondary';
      case 'prescription':
        return 'success';
      case 'vaccination':
        return 'info';
      case 'vital_signs':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <FileIcon />;
    if (fileType.includes('pdf')) return <PdfIcon />;
    if (fileType.includes('image')) return <ImageIcon />;
    return <DescriptionIcon />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  if (loading && records.length === 0) {
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
          Health Records
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchRecords} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            New Record
          </Button>
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
              <InputLabel>Record Type</InputLabel>
              <Select
                value={recordTypeFilter}
                label="Record Type"
                onChange={(e) => {
                  setRecordTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="all">All Types</MenuItem>
                {RECORD_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Health Records List */}
      {records.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No health records found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a new record to get started
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={3}>
            {records.map((record) => (
              <Grid item xs={12} key={record.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Typography variant="h6">{record.title}</Typography>
                          <Chip
                            label={
                              RECORD_TYPES.find((t) => t.value === record.recordType)
                                ?.label || record.recordType
                            }
                            color={getRecordTypeColor(record.recordType)}
                            size="small"
                          />
                        </Box>

                        {record.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {record.description}
                          </Typography>
                        )}

                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Record Date
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(record.recordDate)}
                            </Typography>
                          </Grid>

                          {record.fileUrl && (
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="caption" color="text.secondary">
                                Attachment
                              </Typography>
                              <Box display="flex" alignItems="center" gap={0.5}>
                                {getFileIcon(record.fileType)}
                                <Typography variant="body2">
                                  {formatFileSize(record.fileSize)}
                                </Typography>
                              </Box>
                            </Grid>
                          )}

                          <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Created
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(record.createdAt)}
                            </Typography>
                          </Grid>
                        </Grid>

                        {user?.role === 'patient' && record.doctor && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            <strong>Doctor:</strong> {record.doctor.name}
                          </Typography>
                        )}

                        {user?.role === 'doctor' && record.patient && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            <strong>Patient:</strong> {record.patient.name}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewDetails(record)}
                    >
                      View Details
                    </Button>
                    {record.fileUrl && (
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadFile(record.fileUrl!)}
                      >
                        Download
                      </Button>
                    )}
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => openEditDialog(record)}
                    >
                      Edit
                    </Button>
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

      {/* Record Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Health Record Details</Typography>
            <IconButton onClick={() => setDetailsOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRecord && (
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h5">{selectedRecord.title}</Typography>
                <Chip
                  label={
                    RECORD_TYPES.find((t) => t.value === selectedRecord.recordType)
                      ?.label || selectedRecord.recordType
                  }
                  color={getRecordTypeColor(selectedRecord.recordType)}
                  size="small"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Record Date
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {formatDate(selectedRecord.recordDate)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Created At
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {formatDate(selectedRecord.createdAt)}
                  </Typography>
                </Grid>

                {selectedRecord.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedRecord.description}
                    </Typography>
                  </Grid>
                )}

                {selectedRecord.diagnosis && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Diagnosis
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedRecord.diagnosis}
                    </Typography>
                  </Grid>
                )}

                {selectedRecord.treatmentPlan && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Treatment Plan
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedRecord.treatmentPlan}
                    </Typography>
                  </Grid>
                )}

                {selectedRecord.vitalSigns && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Vital Signs
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {JSON.stringify(selectedRecord.vitalSigns, null, 2)}
                    </Typography>
                  </Grid>
                )}

                {selectedRecord.labResults && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Lab Results
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {JSON.stringify(selectedRecord.labResults, null, 2)}
                    </Typography>
                  </Grid>
                )}

                {selectedRecord.fileUrl && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Attachment
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                      {getFileIcon(selectedRecord.fileType)}
                      <Typography variant="body2">
                        {formatFileSize(selectedRecord.fileSize)}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadFile(selectedRecord.fileUrl!)}
                      >
                        Download
                      </Button>
                    </Box>
                  </Grid>
                )}
              </Grid>

              {user?.role === 'patient' && selectedRecord.doctor && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Doctor
                  </Typography>
                  <Typography variant="body1">{selectedRecord.doctor.name}</Typography>
                  {selectedRecord.doctor.email && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedRecord.doctor.email}
                    </Typography>
                  )}
                </>
              )}

              {user?.role === 'doctor' && selectedRecord.patient && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Patient
                  </Typography>
                  <Typography variant="body1">{selectedRecord.patient.name}</Typography>
                  {selectedRecord.patient.email && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedRecord.patient.email}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<EditIcon />}
            onClick={() => {
              setDetailsOpen(false);
              openEditDialog(selectedRecord!);
            }}
          >
            Edit
          </Button>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => {
              setDeleteDialogOpen(true);
            }}
          >
            Delete
          </Button>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Record Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Health Record</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {user?.role === 'doctor' && (
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
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Record Type</InputLabel>
                <Select
                  value={formData.recordType}
                  label="Record Type"
                  onChange={(e) =>
                    setFormData({ ...formData, recordType: e.target.value })
                  }
                >
                  {RECORD_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                type="date"
                label="Record Date"
                InputLabelProps={{ shrink: true }}
                value={formData.recordDate}
                onChange={(e) =>
                  setFormData({ ...formData, recordDate: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Title"
                placeholder="e.g., Blood Test Results"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                placeholder="Detailed description of the health record"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Diagnosis (Optional)"
                value={formData.diagnosis || ''}
                onChange={(e) =>
                  setFormData({ ...formData, diagnosis: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Treatment Plan (Optional)"
                value={formData.treatmentPlan || ''}
                onChange={(e) =>
                  setFormData({ ...formData, treatmentPlan: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Divider />
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Attach File (Optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Supported: PDF, JPEG, PNG, DOC (Max 10MB)
              </Typography>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
                fullWidth
              >
                {selectedFile ? selectedFile.name : 'Choose File'}
                <input
                  type="file"
                  hidden
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleFileChange}
                />
              </Button>
              {selectedFile && (
                <Box mt={1}>
                  <Chip
                    label={`${selectedFile.name} (${formatFileSize(
                      selectedFile.size
                    )})`}
                    onDelete={() => setSelectedFile(null)}
                  />
                </Box>
              )}
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
          <Button onClick={handleCreateRecord} variant="contained">
            Create Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          resetForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Health Record</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Diagnosis"
                value={formData.diagnosis || ''}
                onChange={(e) =>
                  setFormData({ ...formData, diagnosis: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Treatment Plan"
                value={formData.treatmentPlan || ''}
                onChange={(e) =>
                  setFormData({ ...formData, treatmentPlan: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditOpen(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleUpdateRecord} variant="contained">
            Update Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this health record? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteRecord} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default HealthRecords;
