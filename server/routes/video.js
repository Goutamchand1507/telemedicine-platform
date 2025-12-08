const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// @route   POST /api/video/create-room
// @desc    Create a video consultation room
// @access  Private
router.post('/create-room', [
  body('appointmentId').isUUID().withMessage('Valid appointment ID is required')
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

    const { appointmentId } = req.body;

    // Check if user has permission to access this appointment
    let appointment;
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .select('*')
        .where('id', appointmentId)
        .where('patient_id', patient.id)
        .first();
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .select('*')
        .where('id', appointmentId)
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

    // Check if appointment is scheduled for now or in the future
    const now = new Date();
    const appointmentTime = new Date(appointment.scheduled_at);
    const appointmentEndTime = new Date(appointmentTime.getTime() + appointment.duration_minutes * 60000);

    if (now < appointmentTime || now > appointmentEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Video consultation is only available during scheduled appointment time'
      });
    }

    // Generate unique room ID
    const roomId = uuidv4();

    // Update appointment with room ID and video call URL
    const videoCallUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/video-call/${appointmentId}?room=${roomId}`;
    
    await db('appointments')
      .where('id', appointmentId)
      .update({
        meeting_room_id: roomId,
        video_call_url: videoCallUrl,
        status: 'in_progress',
        started_at: new Date()
      });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'create',
      resourceType: 'video_room',
      resourceId: appointmentId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        roomId,
        videoCallUrl
      }
    });

    res.json({
      success: true,
      message: 'Video room created successfully',
      data: {
        roomId,
        videoCallUrl,
        appointmentId
      }
    });

  } catch (error) {
    console.error('Create video room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create video room'
    });
  }
});

// @route   GET /api/video/room/:appointmentId
// @desc    Get video room details
// @access  Private
router.get('/room/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Check if user has permission to access this appointment
    let appointment;
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .select(
          'appointments.*',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name',
          'users.profile_image_url as doctor_profile_image'
        )
        .join('doctors', 'appointments.doctor_id', 'doctors.id')
        .join('users', 'doctors.user_id', 'users.id')
        .where('appointments.id', appointmentId)
        .where('appointments.patient_id', patient.id)
        .first();
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .select(
          'appointments.*',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name',
          'users.profile_image_url as patient_profile_image'
        )
        .join('patients', 'appointments.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('appointments.id', appointmentId)
        .where('appointments.doctor_id', doctor.id)
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

    // Check if room exists
    if (!appointment.meeting_room_id) {
      return res.status(404).json({
        success: false,
        message: 'Video room not found'
      });
    }

    res.json({
      success: true,
      data: {
        roomId: appointment.meeting_room_id,
        videoCallUrl: appointment.video_call_url,
        appointment: {
          id: appointment.id,
          scheduledAt: appointment.scheduled_at,
          durationMinutes: appointment.duration_minutes,
          status: appointment.status,
          startedAt: appointment.started_at,
          ...(req.user.role === 'patient' ? {
            doctor: {
              name: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
              profileImage: appointment.doctor_profile_image
            }
          } : {
            patient: {
              name: `${appointment.patient_first_name} ${appointment.patient_last_name}`,
              profileImage: appointment.patient_profile_image
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('Get video room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video room details'
    });
  }
});

// @route   POST /api/video/end-call
// @desc    End video consultation
// @access  Private
router.post('/end-call', [
  body('appointmentId').isUUID().withMessage('Valid appointment ID is required'),
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

    const { appointmentId, notes } = req.body;

    // Check if user has permission to end this appointment
    let appointment;
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .where('id', appointmentId)
        .where('patient_id', patient.id)
        .first();
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      appointment = await db('appointments')
        .where('id', appointmentId)
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

    // Update appointment status
    const updateData = {
      status: 'completed',
      ended_at: new Date()
    };

    if (notes) {
      updateData.notes = notes;
    }

    await db('appointments')
      .where('id', appointmentId)
      .update(updateData);

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'end_call',
      resourceType: 'video_consultation',
      resourceId: appointmentId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        notes,
        duration: appointment.started_at ? 
          Math.round((new Date() - new Date(appointment.started_at)) / 60000) : null
      }
    });

    res.json({
      success: true,
      message: 'Video consultation ended successfully'
    });

  } catch (error) {
    console.error('End video call error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end video consultation'
    });
  }
});

// @route   GET /api/video/ice-servers
// @desc    Get ICE servers for WebRTC
// @access  Private
router.get('/ice-servers', async (req, res) => {
  try {
    // Return ICE servers configuration for WebRTC
    // In production, you would configure these with your STUN/TURN servers
    const iceServers = [
      {
        urls: 'stun:stun.l.google.com:19302'
      },
      {
        urls: 'stun:stun1.l.google.com:19302'
      }
      // Add TURN servers for production
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: 'username',
      //   credential: 'password'
      // }
    ];

    res.json({
      success: true,
      data: {
        iceServers
      }
    });

  } catch (error) {
    console.error('Get ICE servers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ICE servers'
    });
  }
});

// @route   POST /api/video/record-session
// @desc    Start/stop recording session
// @access  Private (Doctor only)
router.post('/record-session', requireRole(['doctor']), [
  body('appointmentId').isUUID().withMessage('Valid appointment ID is required'),
  body('action').isIn(['start', 'stop']).withMessage('Action must be start or stop')
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

    const { appointmentId, action } = req.body;

    // Check if doctor has permission to record this appointment
    const doctor = await db('doctors')
      .select('id')
      .where('user_id', req.user.id)
      .first();

    const appointment = await db('appointments')
      .where('id', appointmentId)
      .where('doctor_id', doctor.id)
      .first();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // In a real implementation, you would integrate with a recording service
    // For now, we'll just log the action
    const recordingId = action === 'start' ? uuidv4() : null;

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: action === 'start' ? 'start_recording' : 'stop_recording',
      resourceType: 'video_consultation',
      resourceId: appointmentId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        recordingId,
        action
      }
    });

    res.json({
      success: true,
      message: `Recording ${action}ed successfully`,
      data: {
        recordingId,
        action
      }
    });

  } catch (error) {
    console.error('Record session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to control recording session'
    });
  }
});

module.exports = router;
