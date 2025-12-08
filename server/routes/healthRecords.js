const express = require('express');
const { body, validationResult } = require('express-validator');
const { db, encrypt, decrypt } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/health-records/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and DOC files are allowed.'));
    }
  }
});

// @route   POST /api/health-records
// @desc    Create a new health record
// @access  Private
router.post('/', upload.single('file'), [
  body('patientId').isUUID().withMessage('Valid patient ID is required'),
  body('recordType').isIn(['lab_result', 'imaging', 'prescription', 'note', 'vaccination', 'vital_signs', 'other']).withMessage('Invalid record type'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('diagnosis').optional().trim(),
  body('treatmentPlan').optional().trim(),
  body('recordDate').isISO8601().withMessage('Valid record date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      patientId,
      recordType,
      title,
      description,
      diagnosis,
      treatmentPlan,
      recordDate,
      vitalSigns,
      labResults,
      medicationsPrescribed
    } = req.body;

    // Check permissions
    let hasPermission = false;
    
    if (req.user.role === 'doctor') {
      // Doctor can create records for any patient
      hasPermission = true;
    } else if (req.user.role === 'patient') {
      // Patient can only create records for themselves
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      
      if (patient && patient.id === patientId) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get doctor ID if user is a doctor
    let doctorId = null;
    if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      doctorId = doctor?.id;
    }

    // Encrypt sensitive data
    const encryptedData = {
      description: description ? encrypt(description) : null,
      diagnosis: diagnosis ? encrypt(diagnosis) : null,
      treatmentPlan: treatmentPlan ? encrypt(treatmentPlan) : null,
      vitalSigns: vitalSigns ? encrypt(JSON.stringify(vitalSigns)) : null,
      labResults: labResults ? encrypt(JSON.stringify(labResults)) : null,
      medicationsPrescribed: medicationsPrescribed ? encrypt(JSON.stringify(medicationsPrescribed)) : null
    };

    // Create health record
    const [healthRecord] = await db('health_records')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        record_type: recordType,
        title,
        description: encryptedData.description,
        diagnosis: encryptedData.diagnosis,
        treatment_plan: encryptedData.treatmentPlan,
        vital_signs: encryptedData.vitalSigns,
        lab_results: encryptedData.labResults,
        medications_prescribed: encryptedData.medicationsPrescribed,
        file_url: req.file ? `/uploads/health-records/${req.file.filename}` : null,
        file_type: req.file ? req.file.mimetype : null,
        file_size: req.file ? req.file.size : null,
        record_date: recordDate,
        is_encrypted: true
      })
      .returning('*');

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'create',
      resourceType: 'health_record',
      resourceId: healthRecord.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Health record created successfully',
      data: {
        healthRecord: {
          id: healthRecord.id,
          recordType: healthRecord.record_type,
          title: healthRecord.title,
          recordDate: healthRecord.record_date,
          fileUrl: healthRecord.file_url,
          fileType: healthRecord.file_type,
          fileSize: healthRecord.file_size,
          createdAt: healthRecord.created_at
        }
      }
    });

  } catch (error) {
    console.error('Create health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create health record'
    });
  }
});

// @route   GET /api/health-records
// @desc    Get health records
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { patientId, recordType, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query;
    
    if (req.user.role === 'patient') {
      // Patient can only view their own records
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient profile not found'
        });
      }

      query = db('health_records')
        .select(
          'health_records.*',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name'
        )
        .leftJoin('doctors', 'health_records.doctor_id', 'doctors.id')
        .leftJoin('users', 'doctors.user_id', 'users.id')
        .where('health_records.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      // Doctor can view records for their patients
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found'
        });
      }

      query = db('health_records')
        .select(
          'health_records.*',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name'
        )
        .join('patients', 'health_records.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('health_records.doctor_id', doctor.id);

      // Filter by specific patient if provided
      if (patientId) {
        query = query.where('health_records.patient_id', patientId);
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Apply record type filter
    if (recordType) {
      query = query.where('health_records.record_type', recordType);
    }

    // Get total count with a separate simpler query
    let countQuery = db('health_records').count('* as count');

    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery.where('health_records.patient_id', patient.id);
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery.where('health_records.doctor_id', doctor.id);
      if (patientId) {
        countQuery = countQuery.where('health_records.patient_id', patientId);
      }
    }

    if (recordType) {
      countQuery = countQuery.where('health_records.record_type', recordType);
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const healthRecords = await query
      .orderBy('health_records.record_date', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        healthRecords: healthRecords.map(record => ({
          id: record.id,
          recordType: record.record_type,
          title: record.title,
          recordDate: record.record_date,
          fileUrl: record.file_url,
          fileType: record.file_type,
          fileSize: record.file_size,
          createdAt: record.created_at,
          ...(req.user.role === 'patient' ? {
            doctor: record.doctor_first_name ? {
              name: `${record.doctor_first_name} ${record.doctor_last_name}`
            } : null
          } : {
            patient: {
              name: `${record.patient_first_name} ${record.patient_last_name}`
            }
          })
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get health records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health records'
    });
  }
});

// @route   GET /api/health-records/:id
// @desc    Get health record details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    let query;
    
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('health_records')
        .select(
          'health_records.*',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name',
          'users.email as doctor_email'
        )
        .leftJoin('doctors', 'health_records.doctor_id', 'doctors.id')
        .leftJoin('users', 'doctors.user_id', 'users.id')
        .where('health_records.id', req.params.id)
        .where('health_records.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('health_records')
        .select(
          'health_records.*',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name',
          'users.email as patient_email'
        )
        .join('patients', 'health_records.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('health_records.id', req.params.id)
        .where('health_records.doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const healthRecord = await query.first();

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: 'Health record not found'
      });
    }

    // Decrypt sensitive data
    const decryptedData = {
      description: healthRecord.description ? decrypt(healthRecord.description) : null,
      diagnosis: healthRecord.diagnosis ? decrypt(healthRecord.diagnosis) : null,
      treatmentPlan: healthRecord.treatment_plan ? decrypt(healthRecord.treatment_plan) : null,
      vitalSigns: healthRecord.vital_signs ? JSON.parse(decrypt(healthRecord.vital_signs)) : null,
      labResults: healthRecord.lab_results ? JSON.parse(decrypt(healthRecord.lab_results)) : null,
      medicationsPrescribed: healthRecord.medications_prescribed ? JSON.parse(decrypt(healthRecord.medications_prescribed)) : null
    };

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'view',
      resourceType: 'health_record',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        healthRecord: {
          id: healthRecord.id,
          recordType: healthRecord.record_type,
          title: healthRecord.title,
          description: decryptedData.description,
          diagnosis: decryptedData.diagnosis,
          treatmentPlan: decryptedData.treatmentPlan,
          vitalSigns: decryptedData.vitalSigns,
          labResults: decryptedData.labResults,
          medicationsPrescribed: decryptedData.medicationsPrescribed,
          recordDate: healthRecord.record_date,
          fileUrl: healthRecord.file_url,
          fileType: healthRecord.file_type,
          fileSize: healthRecord.file_size,
          createdAt: healthRecord.created_at,
          ...(req.user.role === 'patient' ? {
            doctor: healthRecord.doctor_first_name ? {
              name: `${healthRecord.doctor_first_name} ${healthRecord.doctor_last_name}`,
              email: healthRecord.doctor_email
            } : null
          } : {
            patient: {
              name: `${healthRecord.patient_first_name} ${healthRecord.patient_last_name}`,
              email: healthRecord.patient_email
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('Get health record details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health record details'
    });
  }
});

// @route   PUT /api/health-records/:id
// @desc    Update health record
// @access  Private
router.put('/:id', [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('diagnosis').optional().trim(),
  body('treatmentPlan').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, description, diagnosis, treatmentPlan, vitalSigns, labResults, medicationsPrescribed } = req.body;

    // Check permissions
    let query;
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('health_records')
        .where('id', req.params.id)
        .where('patient_id', patient.id);
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('health_records')
        .where('id', req.params.id)
        .where('doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const healthRecord = await query.first();

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: 'Health record not found'
      });
    }

    // Encrypt sensitive data
    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description ? encrypt(description) : null;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis ? encrypt(diagnosis) : null;
    if (treatmentPlan !== undefined) updateData.treatment_plan = treatmentPlan ? encrypt(treatmentPlan) : null;
    if (vitalSigns !== undefined) updateData.vital_signs = vitalSigns ? encrypt(JSON.stringify(vitalSigns)) : null;
    if (labResults !== undefined) updateData.lab_results = labResults ? encrypt(JSON.stringify(labResults)) : null;
    if (medicationsPrescribed !== undefined) updateData.medications_prescribed = medicationsPrescribed ? encrypt(JSON.stringify(medicationsPrescribed)) : null;

    // Update health record
    await db('health_records')
      .where('id', req.params.id)
      .update(updateData);

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'update',
      resourceType: 'health_record',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Health record updated successfully'
    });

  } catch (error) {
    console.error('Update health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update health record'
    });
  }
});

// @route   DELETE /api/health-records/:id
// @desc    Delete health record
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    // Check permissions
    let query;
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('health_records')
        .where('id', req.params.id)
        .where('patient_id', patient.id);
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('health_records')
        .where('id', req.params.id)
        .where('doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const healthRecord = await query.first();

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: 'Health record not found'
      });
    }

    // Delete associated file if exists
    if (healthRecord.file_url) {
      const filePath = path.join(__dirname, '..', '..', healthRecord.file_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete health record
    await db('health_records')
      .where('id', req.params.id)
      .del();

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'delete',
      resourceType: 'health_record',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Health record deleted successfully'
    });

  } catch (error) {
    console.error('Delete health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete health record'
    });
  }
});

module.exports = router;
