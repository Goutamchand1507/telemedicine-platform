const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const { sendAppointmentConfirmation, sendAppointmentReminder } = require('../utils/emailService');

const router = express.Router();

// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private
router.post('/', [
  body('doctorId').isUUID().withMessage('Valid doctor ID is required'),
  body('scheduledAt').isISO8601().withMessage('Valid scheduled date is required'),
  body('durationMinutes').optional().isInt({ min: 15, max: 120 }).withMessage('Duration must be between 15 and 120 minutes'),
  body('type').optional().isIn(['consultation', 'follow_up', 'emergency', 'routine_checkup']).withMessage('Invalid appointment type'),
  body('reasonForVisit').optional().trim()
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
      doctorId,
      scheduledAt,
      durationMinutes = 30,
      type = 'consultation',
      reasonForVisit
    } = req.body;

    // Check if user is a patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Only patients can book appointments'
      });
    }

    // Get patient ID
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

    // Check if doctor exists and is available
    const doctor = await db('doctors')
      .select('doctors.*', 'users.first_name', 'users.last_name', 'users.email')
      .join('users', 'doctors.user_id', 'users.id')
      .where('doctors.id', doctorId)
      .where('doctors.is_available', true)
      .where('users.status', 'active')
      .first();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or not available'
      });
    }

    // Check for conflicting appointments
    const scheduledDate = new Date(scheduledAt);
    const endTime = new Date(scheduledDate.getTime() + durationMinutes * 60000);

    const conflictingAppointment = await db('appointments')
      .where('doctor_id', doctorId)
      .where('status', 'in', ['scheduled', 'confirmed'])
      .where(function() {
        this.whereBetween('scheduled_at', [scheduledDate, endTime])
          .orWhere(function() {
            this.where('scheduled_at', '<=', scheduledDate)
              .andWhere(db.raw('scheduled_at + INTERVAL \'1 minute\' * duration_minutes'), '>', scheduledDate);
          });
      })
      .first();

    if (conflictingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'Doctor is not available at the requested time'
      });
    }

    // Create appointment
    const [appointment] = await db('appointments')
      .insert({
        patient_id: patient.id,
        doctor_id: doctorId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        type,
        reason_for_visit: reasonForVisit,
        consultation_fee: doctor.consultation_fee,
        status: 'scheduled'
      })
      .returning('*');

    // Get patient user details for email
    const patientUser = await db('users')
      .select('first_name', 'last_name', 'email')
      .where('id', req.user.id)
      .first();

    // Send confirmation email
    await sendAppointmentConfirmation(
      patientUser.email,
      patientUser.first_name,
      {
        ...appointment,
        doctor_name: `${doctor.first_name} ${doctor.last_name}`,
        doctor_specialization: doctor.specialization
      }
    );

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'create',
      resourceType: 'appointment',
      resourceId: appointment.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: {
        appointment: {
          id: appointment.id,
          scheduledAt: appointment.scheduled_at,
          durationMinutes: appointment.duration_minutes,
          type: appointment.type,
          reasonForVisit: appointment.reason_for_visit,
          status: appointment.status,
          consultationFee: appointment.consultation_fee,
          doctor: {
            id: doctor.id,
            name: `${doctor.first_name} ${doctor.last_name}`,
            specialization: doctor.specialization
          }
        }
      }
    });

  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment'
    });
  }
});

// @route   GET /api/appointments
// @desc    Get user's appointments
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query;
    
    if (req.user.role === 'patient') {
      // Get patient appointments
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

      query = db('appointments')
        .select(
          'appointments.*',
          'doctors.specialization',
          'doctors.consultation_fee',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name',
          'users.profile_image_url as doctor_profile_image'
        )
        .join('doctors', 'appointments.doctor_id', 'doctors.id')
        .join('users', 'doctors.user_id', 'users.id')
        .where('appointments.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      // Get doctor appointments
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

      query = db('appointments')
        .select(
          'appointments.*',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name',
          'users.profile_image_url as patient_profile_image',
          'patients.emergency_contact_name',
          'patients.emergency_contact_phone'
        )
        .join('patients', 'appointments.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('appointments.doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Apply status filter
    if (status) {
      query = query.where('appointments.status', status);
    }

    // Get total count with a separate simpler query
    let countQuery = db('appointments').count('* as count');

    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery.where('appointments.patient_id', patient.id);
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery.where('appointments.doctor_id', doctor.id);
    }

    if (status) {
      countQuery = countQuery.where('appointments.status', status);
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const appointments = await query
      .orderBy('appointments.scheduled_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        appointments: appointments.map(appointment => ({
          id: appointment.id,
          scheduledAt: appointment.scheduled_at,
          durationMinutes: appointment.duration_minutes,
          type: appointment.type,
          reasonForVisit: appointment.reason_for_visit,
          status: appointment.status,
          consultationFee: appointment.consultation_fee,
          paymentStatus: appointment.payment_status,
          startedAt: appointment.started_at,
          endedAt: appointment.ended_at,
          notes: appointment.notes,
          createdAt: appointment.created_at,
          ...(req.user.role === 'patient' ? {
            doctor: {
              id: appointment.doctor_id,
              name: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
              specialization: appointment.specialization,
              profileImage: appointment.doctor_profile_image
            }
          } : {
            patient: {
              name: `${appointment.patient_first_name} ${appointment.patient_last_name}`,
              profileImage: appointment.patient_profile_image,
              emergencyContact: {
                name: appointment.emergency_contact_name,
                phone: appointment.emergency_contact_phone
              }
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
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointments'
    });
  }
});

// @route   GET /api/appointments/:id
// @desc    Get appointment details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    let query;
    
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('appointments')
        .select(
          'appointments.*',
          'doctors.specialization',
          'doctors.bio',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name',
          'users.profile_image_url as doctor_profile_image',
          'users.email as doctor_email'
        )
        .join('doctors', 'appointments.doctor_id', 'doctors.id')
        .join('users', 'doctors.user_id', 'users.id')
        .where('appointments.id', req.params.id)
        .where('appointments.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('appointments')
        .select(
          'appointments.*',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name',
          'users.profile_image_url as patient_profile_image',
          'users.email as patient_email',
          'users.phone as patient_phone',
          'patients.emergency_contact_name',
          'patients.emergency_contact_phone',
          'patients.medical_history',
          'patients.allergies',
          'patients.current_medications'
        )
        .join('patients', 'appointments.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('appointments.id', req.params.id)
        .where('appointments.doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const appointment = await query.first();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          scheduledAt: appointment.scheduled_at,
          durationMinutes: appointment.duration_minutes,
          type: appointment.type,
          reasonForVisit: appointment.reason_for_visit,
          status: appointment.status,
          consultationFee: appointment.consultation_fee,
          paymentStatus: appointment.payment_status,
          startedAt: appointment.started_at,
          endedAt: appointment.ended_at,
          notes: appointment.notes,
          meetingRoomId: appointment.meeting_room_id,
          videoCallUrl: appointment.video_call_url,
          createdAt: appointment.created_at,
          ...(req.user.role === 'patient' ? {
            doctor: {
              id: appointment.doctor_id,
              name: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
              specialization: appointment.specialization,
              bio: appointment.bio,
              profileImage: appointment.doctor_profile_image,
              email: appointment.doctor_email
            }
          } : {
            patient: {
              name: `${appointment.patient_first_name} ${appointment.patient_last_name}`,
              profileImage: appointment.patient_profile_image,
              email: appointment.patient_email,
              phone: appointment.patient_phone,
              emergencyContact: {
                name: appointment.emergency_contact_name,
                phone: appointment.emergency_contact_phone
              },
              medicalHistory: appointment.medical_history,
              allergies: appointment.allergies,
              currentMedications: appointment.current_medications
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('Get appointment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointment details'
    });
  }
});

// @route   PUT /api/appointments/:id/status
// @desc    Update appointment status
// @access  Private
router.put('/:id/status', [
  body('status').isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).withMessage('Invalid status'),
  body('notes').optional().trim()
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

    const { status, notes } = req.body;

    // Check if user has permission to update this appointment
    let appointment;
    if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .where('id', req.params.id)
        .where('doctor_id', doctor.id)
        .first();
    } else if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .where('id', req.params.id)
        .where('patient_id', patient.id)
        .first();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Update appointment
    const updateData = { status };
    if (notes) updateData.notes = notes;
    
    if (status === 'in_progress') {
      updateData.started_at = new Date();
    } else if (status === 'completed') {
      updateData.ended_at = new Date();
    }

    await db('appointments')
      .where('id', req.params.id)
      .update(updateData);

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'update',
      resourceType: 'appointment',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        oldValues: { status: appointment.status },
        newValues: { status, notes }
      }
    });

    res.json({
      success: true,
      message: 'Appointment status updated successfully'
    });

  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment status'
    });
  }
});

// @route   DELETE /api/appointments/:id
// @desc    Cancel appointment
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    // Check if user has permission to cancel this appointment
    let appointment;
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .where('id', req.params.id)
        .where('patient_id', patient.id)
        .first();
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .where('id', req.params.id)
        .where('doctor_id', doctor.id)
        .first();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment can be cancelled
    if (['completed', 'cancelled'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Appointment cannot be cancelled'
      });
    }

    // Cancel appointment
    await db('appointments')
      .where('id', req.params.id)
      .update({ status: 'cancelled' });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'cancel',
      resourceType: 'appointment',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment'
    });
  }
});

module.exports = router;
