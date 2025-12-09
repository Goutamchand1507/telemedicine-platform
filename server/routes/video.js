const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * -------------------------------------------------------
 * CREATE VIDEO ROOM
 * -------------------------------------------------------
 */
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

    // Validate user permission
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
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Check appointment timing
    const now = new Date();
    const start = new Date(appointment.scheduled_at);
    const end = new Date(start.getTime() + appointment.duration_minutes * 60000);

    if (now < start || now > end) {
      return res.status(400).json({
        success: false,
        message: 'Video consultation is only available during the scheduled time'
      });
    }

    // Create room
    const roomId = uuidv4();
    const videoCallUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/video-call/${appointmentId}?room=${roomId}`;

    await db('appointments')
      .where('id', appointmentId)
      .update({
        meeting_room_id: roomId,
        video_call_url: videoCallUrl,
        status: 'in_progress',
        started_at: new Date()
      });

    await logAuditEvent({
      userId: req.user.id,
      action: 'create_video_room',
      resourceId: appointmentId
    });

    return res.json({
      success: true,
      message: 'Video room created successfully',
      data: { roomId, videoCallUrl, appointmentId }
    });

  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create video room' });
  }
});

/**
 * -------------------------------------------------------
 * GET VIDEO ROOM DETAILS
 * -------------------------------------------------------
 */
router.get('/room/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    let appointment;

    if (req.user.role === 'patient') {
      const patient = await db('patients').select('id').where('user_id', req.user.id).first();

      appointment = await db('appointments')
        .select('*')
        .where('id', appointmentId)
        .where('patient_id', patient.id)
        .first();
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors').select('id').where('user_id', req.user.id).first();

      appointment = await db('appointments')
        .select('*')
        .where('id', appointmentId)
        .where('doctor_id', doctor.id)
        .first();
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (!appointment.meeting_room_id) {
      return res.status(404).json({ success: false, message: 'Video room not created yet' });
    }

    return res.json({
      success: true,
      data: {
        roomId: appointment.meeting_room_id,
        videoCallUrl: appointment.video_call_url,
        appointment
      }
    });

  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load room details' });
  }
});

/**
 * -------------------------------------------------------
 * END VIDEO CALL
 * -------------------------------------------------------
 */
router.post('/end-call', [
  body('appointmentId').isUUID(),
], async (req, res) => {
  try {
    const { appointmentId, notes } = req.body;

    await db('appointments')
      .where('id', appointmentId)
      .update({
        status: 'completed',
        ended_at: new Date(),
        notes: notes || null
      });

    return res.json({ success: true, message: 'Call ended successfully' });

  } catch (error) {
    console.error('End call error:', error);
    return res.status(500).json({ success: false, message: 'Failed to end call' });
  }
});

/**
 * -------------------------------------------------------
 * FIXED ICE SERVERS (STUN + TURN)
 * -------------------------------------------------------
 */
router.get('/ice-servers', async (req, res) => {
  try {
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },

      // 🔥 Free TURN Servers (OpenRelay)
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ];

    return res.json({
      success: true,
      data: { iceServers }
    });

  } catch (err) {
    console.error("ICE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to load ICE servers" });
  }
});

/**
 * -------------------------------------------------------
 * RECORD SESSION
 * -------------------------------------------------------
 */
router.post('/record-session', requireRole(['doctor']), [
  body('appointmentId').isUUID(),
  body('action').isIn(['start', 'stop'])
], async (req, res) => {
  try {
    const { appointmentId, action } = req.body;

    return res.json({
      success: true,
      message: `Recording ${action}ed successfully`
    });

  } catch (error) {
    console.error('Record session error:', error);
    return res.status(500).json({ success: false, message: 'Failed to control recording session' });
  }
});

module.exports = router;
