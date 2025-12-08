const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const { sendPrescriptionNotification } = require('../utils/emailService');

const router = express.Router();

// @route   POST /api/prescriptions
// @desc    Create a new prescription
// @access  Private (Doctor only)
router.post('/', requireRole(['doctor']), [
  body('patientId').isUUID().withMessage('Valid patient ID is required'),
  body('medicationName').trim().notEmpty().withMessage('Medication name is required'),
  body('dosage').trim().notEmpty().withMessage('Dosage is required'),
  body('instructions').trim().notEmpty().withMessage('Instructions are required'),
  body('quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
  body('refillsAllowed').optional().isInt({ min: 0, max: 5 }).withMessage('Refills must be between 0 and 5'),
  body('appointmentId').optional().isUUID().withMessage('Valid appointment ID is required')
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
      medicationName,
      dosage,
      instructions,
      quantity,
      refillsAllowed = 0,
      appointmentId,
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone,
      isControlledSubstance = false,
      sideEffects,
      contraindications
    } = req.body;

    // Get doctor ID
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

    // Verify patient exists
    const patient = await db('patients')
      .select('patients.*', 'users.first_name', 'users.last_name', 'users.email')
      .join('users', 'patients.user_id', 'users.id')
      .where('patients.id', patientId)
      .first();

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Create prescription
    const [prescription] = await db('prescriptions')
      .insert({
        patient_id: patientId,
        doctor_id: doctor.id,
        appointment_id: appointmentId,
        medication_name: medicationName,
        dosage,
        instructions,
        quantity,
        refills_allowed: refillsAllowed,
        refills_remaining: refillsAllowed,
        prescribed_date: new Date(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        pharmacy_name: pharmacyName,
        pharmacy_address: pharmacyAddress,
        pharmacy_phone: pharmacyPhone,
        is_controlled_substance: isControlledSubstance,
        side_effects: sideEffects,
        contraindications,
        status: 'active'
      })
      .returning('*');

    // Send notification email to patient (optional - won't fail if email not configured)
    try {
      await sendPrescriptionNotification(
        patient.email,
        patient.first_name,
        prescription
      );
    } catch (emailError) {
      console.log('Email notification not sent (email service may not be configured):', emailError.message);
    }

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'create',
      resourceType: 'prescription',
      resourceId: prescription.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: {
        prescription: {
          id: prescription.id,
          medicationName: prescription.medication_name,
          dosage: prescription.dosage,
          instructions: prescription.instructions,
          quantity: prescription.quantity,
          refillsAllowed: prescription.refills_allowed,
          refillsRemaining: prescription.refills_remaining,
          prescribedDate: prescription.prescribed_date,
          expiryDate: prescription.expiry_date,
          status: prescription.status,
          pharmacy: {
            name: prescription.pharmacy_name,
            address: prescription.pharmacy_address,
            phone: prescription.pharmacy_phone
          },
          isControlledSubstance: prescription.is_controlled_substance,
          sideEffects: prescription.side_effects,
          contraindications: prescription.contraindications
        }
      }
    });

  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create prescription'
    });
  }
});

// @route   GET /api/prescriptions
// @desc    Get prescriptions
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query;
    
    if (req.user.role === 'patient') {
      // Get patient prescriptions
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

      query = db('prescriptions')
        .select(
          'prescriptions.*',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name',
          'users.profile_image_url as doctor_profile_image'
        )
        .join('doctors', 'prescriptions.doctor_id', 'doctors.id')
        .join('users', 'doctors.user_id', 'users.id')
        .where('prescriptions.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      // Get doctor prescriptions
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

      query = db('prescriptions')
        .select(
          'prescriptions.*',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name',
          'users.profile_image_url as patient_profile_image'
        )
        .join('patients', 'prescriptions.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('prescriptions.doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Apply status filter
    if (status) {
      query = query.where('prescriptions.status', status);
    }

    // Get total count with a separate simpler query
    let countQuery = db('prescriptions').count('* as count');

    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery.where('prescriptions.patient_id', patient.id);
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery.where('prescriptions.doctor_id', doctor.id);
    }

    if (status) {
      countQuery = countQuery.where('prescriptions.status', status);
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const prescriptions = await query
      .orderBy('prescriptions.prescribed_date', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        prescriptions: prescriptions.map(prescription => ({
          id: prescription.id,
          medicationName: prescription.medication_name,
          dosage: prescription.dosage,
          instructions: prescription.instructions,
          quantity: prescription.quantity,
          refillsAllowed: prescription.refills_allowed,
          refillsRemaining: prescription.refills_remaining,
          prescribedDate: prescription.prescribed_date,
          expiryDate: prescription.expiry_date,
          status: prescription.status,
          pharmacy: {
            name: prescription.pharmacy_name,
            address: prescription.pharmacy_address,
            phone: prescription.pharmacy_phone
          },
          isControlledSubstance: prescription.is_controlled_substance,
          sideEffects: prescription.side_effects,
          contraindications: prescription.contraindications,
          createdAt: prescription.created_at,
          ...(req.user.role === 'patient' ? {
            doctor: {
              name: `${prescription.doctor_first_name} ${prescription.doctor_last_name}`,
              profileImage: prescription.doctor_profile_image
            }
          } : {
            patient: {
              name: `${prescription.patient_first_name} ${prescription.patient_last_name}`,
              profileImage: prescription.patient_profile_image
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
    console.error('Get prescriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get prescriptions'
    });
  }
});

// @route   GET /api/prescriptions/:id
// @desc    Get prescription details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    let query;
    
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('prescriptions')
        .select(
          'prescriptions.*',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name',
          'users.profile_image_url as doctor_profile_image',
          'users.email as doctor_email'
        )
        .join('doctors', 'prescriptions.doctor_id', 'doctors.id')
        .join('users', 'doctors.user_id', 'users.id')
        .where('prescriptions.id', req.params.id)
        .where('prescriptions.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('prescriptions')
        .select(
          'prescriptions.*',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name',
          'users.profile_image_url as patient_profile_image',
          'users.email as patient_email',
          'users.phone as patient_phone'
        )
        .join('patients', 'prescriptions.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('prescriptions.id', req.params.id)
        .where('prescriptions.doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const prescription = await query.first();

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.json({
      success: true,
      data: {
        prescription: {
          id: prescription.id,
          medicationName: prescription.medication_name,
          dosage: prescription.dosage,
          instructions: prescription.instructions,
          quantity: prescription.quantity,
          refillsAllowed: prescription.refills_allowed,
          refillsRemaining: prescription.refills_remaining,
          prescribedDate: prescription.prescribed_date,
          expiryDate: prescription.expiry_date,
          status: prescription.status,
          pharmacy: {
            name: prescription.pharmacy_name,
            address: prescription.pharmacy_address,
            phone: prescription.pharmacy_phone
          },
          isControlledSubstance: prescription.is_controlled_substance,
          sideEffects: prescription.side_effects,
          contraindications: prescription.contraindications,
          createdAt: prescription.created_at,
          ...(req.user.role === 'patient' ? {
            doctor: {
              name: `${prescription.doctor_first_name} ${prescription.doctor_last_name}`,
              profileImage: prescription.doctor_profile_image,
              email: prescription.doctor_email
            }
          } : {
            patient: {
              name: `${prescription.patient_first_name} ${prescription.patient_last_name}`,
              profileImage: prescription.patient_profile_image,
              email: prescription.patient_email,
              phone: prescription.patient_phone
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('Get prescription details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get prescription details'
    });
  }
});

// @route   PUT /api/prescriptions/:id/status
// @desc    Update prescription status
// @access  Private (Doctor only)
router.put('/:id/status', requireRole(['doctor']), [
  body('status').isIn(['active', 'completed', 'cancelled', 'expired']).withMessage('Invalid status')
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

    const { status } = req.body;

    // Get doctor ID
    const doctor = await db('doctors')
      .select('id')
      .where('user_id', req.user.id)
      .first();

    // Check if prescription exists and belongs to this doctor
    const prescription = await db('prescriptions')
      .where('id', req.params.id)
      .where('doctor_id', doctor.id)
      .first();

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Update prescription status
    await db('prescriptions')
      .where('id', req.params.id)
      .update({ status });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'update',
      resourceType: 'prescription',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        oldValues: { status: prescription.status },
        newValues: { status }
      }
    });

    res.json({
      success: true,
      message: 'Prescription status updated successfully'
    });

  } catch (error) {
    console.error('Update prescription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update prescription status'
    });
  }
});

// @route   POST /api/prescriptions/:id/refill
// @desc    Request prescription refill
// @access  Private (Patient only)
router.post('/:id/refill', requireRole(['patient']), async (req, res) => {
  try {
    // Get patient ID
    const patient = await db('patients')
      .select('id')
      .where('user_id', req.user.id)
      .first();

    // Check if prescription exists and belongs to this patient
    const prescription = await db('prescriptions')
      .where('id', req.params.id)
      .where('patient_id', patient.id)
      .first();

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check if refills are available
    if (prescription.refills_remaining <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No refills remaining for this prescription'
      });
    }

    // Check if prescription is still active
    if (prescription.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Prescription is not active'
      });
    }

    // Check if prescription has expired
    if (new Date() > new Date(prescription.expiry_date)) {
      return res.status(400).json({
        success: false,
        message: 'Prescription has expired'
      });
    }

    // Update refills remaining
    await db('prescriptions')
      .where('id', req.params.id)
      .update({ 
        refills_remaining: prescription.refills_remaining - 1 
      });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'refill',
      resourceType: 'prescription',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Refill request processed successfully'
    });

  } catch (error) {
    console.error('Request refill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refill request'
    });
  }
});

module.exports = router;
