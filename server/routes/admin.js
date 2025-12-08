const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent, getAuditLogs, getUserAuditLogs, getResourceAuditLogs } = require('../utils/auditLogger');

const router = express.Router();

// @route   GET /api/admin/check-exists
// @desc    Check if any admin user exists
// @access  Public (needed for registration page)
router.get('/check-exists', async (req, res) => {
  try {
    const adminUser = await db('users').where('role', 'admin').first();
    console.log('Admin check result:', adminUser ? `Found: ${adminUser.email}` : 'No admin found');
    res.json({
      success: true,
      exists: !!adminUser,
      // Debug info (remove in production)
      debug: adminUser ? {
        email: adminUser.email,
        firstName: adminUser.first_name,
        createdAt: adminUser.created_at
      } : null
    });
  } catch (error) {
    console.error('Check admin exists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check admin status'
    });
  }
});

// All other admin routes require admin role
router.use(requireRole(['admin']));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    // Get user statistics by role
    const usersByRole = await db('users')
      .select('role')
      .count('* as count')
      .groupBy('role');

    const roleCount = usersByRole.reduce((acc, stat) => {
      acc[stat.role] = parseInt(stat.count);
      return acc;
    }, {});

    const totalUsers = await db('users').count('* as count').first();
    const activeUsers = await db('users').where('status', 'active').count('* as count').first();

    // Get users created this month
    const newThisMonth = await db('users')
      .whereRaw('created_at >= DATE_TRUNC(\'month\', CURRENT_DATE)')
      .count('* as count')
      .first();

    // Get appointment statistics by status
    const appointmentsByStatus = await db('appointments')
      .select('status')
      .count('* as count')
      .groupBy('status');

    const statusCount = appointmentsByStatus.reduce((acc, stat) => {
      acc[stat.status] = parseInt(stat.count);
      return acc;
    }, {});

    const totalAppointments = await db('appointments').count('* as count').first();
    const todayAppointments = await db('appointments')
      .whereRaw('DATE(scheduled_at) = CURRENT_DATE')
      .count('* as count')
      .first();

    // Get health records stats
    const totalHealthRecords = await db('health_records').count('* as count').first();
    const healthRecordsThisMonth = await db('health_records')
      .whereRaw('created_at >= DATE_TRUNC(\'month\', CURRENT_DATE)')
      .count('* as count')
      .first();

    // Get prescription stats
    const totalPrescriptions = await db('prescriptions').count('* as count').first();
    const activePrescriptions = await db('prescriptions')
      .where('status', 'active')
      .count('* as count')
      .first();
    const prescriptionsThisMonth = await db('prescriptions')
      .whereRaw('prescribed_date >= DATE_TRUNC(\'month\', CURRENT_DATE)')
      .count('* as count')
      .first();

    res.json({
      success: true,
      data: {
        userStats: {
          total: parseInt(totalUsers.count),
          patients: roleCount.patient || 0,
          doctors: roleCount.doctor || 0,
          admins: roleCount.admin || 0,
          activeUsers: parseInt(activeUsers.count),
          newThisMonth: parseInt(newThisMonth.count)
        },
        appointmentStats: {
          total: parseInt(totalAppointments.count),
          scheduled: statusCount.scheduled || 0,
          completed: statusCount.completed || 0,
          cancelled: statusCount.cancelled || 0,
          inProgress: statusCount.in_progress || 0,
          todayCount: parseInt(todayAppointments.count)
        },
        healthRecordsStats: {
          total: parseInt(totalHealthRecords.count),
          thisMonth: parseInt(healthRecordsThisMonth.count)
        },
        prescriptionStats: {
          total: parseInt(totalPrescriptions.count),
          active: parseInt(activePrescriptions.count),
          thisMonth: parseInt(prescriptionsThisMonth.count)
        }
      }
    });

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filtering
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const { 
      role, 
      status, 
      search, 
      page = 1, 
      limit = 20 
    } = req.query;
    const offset = (page - 1) * limit;

    let query = db('users')
      .select(
        'users.*',
        'doctors.specialization',
        'doctors.consultation_fee',
        'doctors.rating',
        'doctors.total_reviews'
      )
      .leftJoin('doctors', 'users.id', 'doctors.user_id')
      .orderBy('users.created_at', 'desc');

    // Apply filters
    if (role) {
      query = query.where('users.role', role);
    }
    
    if (status) {
      query = query.where('users.status', status);
    }
    
    if (search) {
      query = query.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }

    // Get total count with a separate simpler query
    let countQuery = db('users').count('* as count');

    if (role) {
      countQuery = countQuery.where('users.role', role);
    }

    if (status) {
      countQuery = countQuery.where('users.status', status);
    }

    if (search) {
      countQuery = countQuery.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const users = await query.limit(limit).offset(offset);

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          status: user.status,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
          profileImage: user.profile_image_url,
          lastLogin: user.last_login,
          createdAt: user.created_at,
          ...(user.role === 'doctor' && {
            specialization: user.specialization,
            consultationFee: user.consultation_fee,
            rating: user.rating,
            totalReviews: user.total_reviews
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
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status
// @access  Private (Admin only)
router.put('/users/:id/status', [
  body('status').isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status')
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
    const { id } = req.params;

    // Get current user data
    const currentUser = await db('users')
      .select('*')
      .where('id', id)
      .first();

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user status
    await db('users')
      .where('id', id)
      .update({ status });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'update_user_status',
      resourceType: 'user',
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        oldValues: { status: currentUser.status },
        newValues: { status }
      }
    });

    res.json({
      success: true,
      message: 'User status updated successfully'
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
});

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs with filtering
// @access  Private (Admin only)
router.get('/audit-logs', async (req, res) => {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const result = await getAuditLogs(filters, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit logs'
    });
  }
});

// @route   GET /api/admin/appointments
// @desc    Get all appointments with filtering
// @access  Private (Admin only)
router.get('/appointments', async (req, res) => {
  try {
    const {
      status,
      type,
      doctorId,
      patientId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;
    const offset = (page - 1) * limit;

    let query = db('appointments')
      .select(
        'appointments.*',
        'p_users.first_name as patient_first_name',
        'p_users.last_name as patient_last_name',
        'p_users.email as patient_email',
        'd_users.first_name as doctor_first_name',
        'd_users.last_name as doctor_last_name',
        'd_users.email as doctor_email',
        'doctors.specialization'
      )
      .join('patients', 'appointments.patient_id', 'patients.id')
      .join('users as p_users', 'patients.user_id', 'p_users.id')
      .join('doctors', 'appointments.doctor_id', 'doctors.id')
      .join('users as d_users', 'doctors.user_id', 'd_users.id')
      .orderBy('appointments.scheduled_at', 'desc');

    // Apply filters
    if (status) {
      query = query.where('appointments.status', status);
    }
    
    if (type) {
      query = query.where('appointments.type', type);
    }
    
    if (doctorId) {
      query = query.where('appointments.doctor_id', doctorId);
    }
    
    if (patientId) {
      query = query.where('appointments.patient_id', patientId);
    }
    
    if (startDate) {
      query = query.where('appointments.scheduled_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('appointments.scheduled_at', '<=', endDate);
    }

    // Get total count with a separate simpler query
    let countQuery = db('appointments').count('* as count');

    if (status) {
      countQuery = countQuery.where('appointments.status', status);
    }

    if (type) {
      countQuery = countQuery.where('appointments.type', type);
    }

    if (doctorId) {
      countQuery = countQuery.where('appointments.doctor_id', doctorId);
    }

    if (patientId) {
      countQuery = countQuery.where('appointments.patient_id', patientId);
    }

    if (startDate) {
      countQuery = countQuery.where('appointments.scheduled_at', '>=', startDate);
    }

    if (endDate) {
      countQuery = countQuery.where('appointments.scheduled_at', '<=', endDate);
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const appointments = await query.limit(limit).offset(offset);

    res.json({
      success: true,
      data: {
        appointments: appointments.map(appointment => ({
          id: appointment.id,
          scheduledAt: appointment.scheduled_at,
          durationMinutes: appointment.duration_minutes,
          type: appointment.type,
          status: appointment.status,
          consultationFee: appointment.consultation_fee,
          paymentStatus: appointment.payment_status,
          startedAt: appointment.started_at,
          endedAt: appointment.ended_at,
          notes: appointment.notes,
          createdAt: appointment.created_at,
          patient: {
            name: `${appointment.patient_first_name} ${appointment.patient_last_name}`,
            email: appointment.patient_email
          },
          doctor: {
            name: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
            email: appointment.doctor_email,
            specialization: appointment.specialization
          }
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

// @route   GET /api/admin/billing
// @desc    Get billing statistics and invoices
// @access  Private (Admin only)
router.get('/billing', async (req, res) => {
  try {
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;
    const offset = (page - 1) * limit;

    let query = db('billing')
      .select(
        'billing.*',
        'p_users.first_name as patient_first_name',
        'p_users.last_name as patient_last_name',
        'd_users.first_name as doctor_first_name',
        'd_users.last_name as doctor_last_name'
      )
      .leftJoin('appointments', 'billing.appointment_id', 'appointments.id')
      .leftJoin('patients', 'appointments.patient_id', 'patients.id')
      .leftJoin('users as p_users', 'patients.user_id', 'p_users.id')
      .leftJoin('doctors', 'appointments.doctor_id', 'doctors.id')
      .leftJoin('users as d_users', 'doctors.user_id', 'd_users.id')
      .orderBy('billing.created_at', 'desc');

    // Apply filters
    if (status) {
      query = query.where('billing.status', status);
    }
    
    if (startDate) {
      query = query.where('billing.created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('billing.created_at', '<=', endDate);
    }

    // Get total count with a separate simpler query
    let countQuery = db('billing').count('* as count');

    if (status) {
      countQuery = countQuery.where('billing.status', status);
    }

    if (startDate) {
      countQuery = countQuery.where('billing.created_at', '>=', startDate);
    }

    if (endDate) {
      countQuery = countQuery.where('billing.created_at', '<=', endDate);
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const invoices = await query.limit(limit).offset(offset);

    res.json({
      success: true,
      data: {
        invoices: invoices.map(invoice => ({
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          totalAmount: invoice.total_amount,
          status: invoice.status,
          paymentMethod: invoice.payment_method,
          paidAt: invoice.paid_at,
          createdAt: invoice.created_at,
          patient: invoice.patient_first_name ? {
            name: `${invoice.patient_first_name} ${invoice.patient_last_name}`
          } : null,
          doctor: invoice.doctor_first_name ? {
            name: `${invoice.doctor_first_name} ${invoice.doctor_last_name}`
          } : null
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
    console.error('Get billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get billing data'
    });
  }
});

// @route   POST /api/admin/system/maintenance
// @desc    Toggle system maintenance mode
// @access  Private (Admin only)
router.post('/system/maintenance', [
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  body('message').optional().trim()
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

    const { enabled, message } = req.body;

    // In a real application, you would store this in a database or cache
    // For now, we'll just log the action
    console.log(`System maintenance mode ${enabled ? 'enabled' : 'disabled'}: ${message || 'No message'}`);

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'toggle_maintenance',
      resourceType: 'system',
      resourceId: null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        enabled,
        message
      }
    });

    res.json({
      success: true,
      message: `System maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Toggle maintenance mode error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle maintenance mode'
    });
  }
});

module.exports = router;
