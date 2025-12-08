const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// @route   POST /api/billing/create-payment-intent
// @desc    Create payment intent for appointment
// @access  Private
router.post('/create-payment-intent', [
  body('appointmentId').isUUID().withMessage('Valid appointment ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required')
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

    const { appointmentId, amount } = req.body;

    // Check if user is a patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Only patients can create payment intents'
      });
    }

    // Get patient and appointment details
    const patient = await db('patients')
      .select('patients.*', 'users.first_name', 'users.last_name', 'users.email')
      .join('users', 'patients.user_id', 'users.id')
      .where('patients.user_id', req.user.id)
      .first();

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    const appointment = await db('appointments')
      .select(
        'appointments.*',
        'doctors.consultation_fee',
        'users.first_name as doctor_first_name',
        'users.last_name as doctor_last_name'
      )
      .join('doctors', 'appointments.doctor_id', 'doctors.id')
      .join('users', 'doctors.user_id', 'users.id')
      .where('appointments.id', appointmentId)
      .where('appointments.patient_id', patient.id)
      .first();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if payment is already processed
    if (appointment.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed for this appointment'
      });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        appointmentId,
        patientId: patient.id,
        patientEmail: patient.email,
        doctorName: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`
      },
      description: `Telemedicine consultation with Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}`
    });

    // Update appointment with payment intent ID
    await db('appointments')
      .where('id', appointmentId)
      .update({ payment_intent_id: paymentIntent.id });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'create_payment_intent',
      resourceType: 'billing',
      resourceId: appointmentId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        amount,
        paymentIntentId: paymentIntent.id
      }
    });

    res.json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent'
    });
  }
});

// @route   POST /api/billing/confirm-payment
// @desc    Confirm payment and create invoice
// @access  Private
router.post('/confirm-payment', [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
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

    const { paymentIntentId, appointmentId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Get appointment details
    const appointment = await db('appointments')
      .select(
        'appointments.*',
        'patients.user_id as patient_user_id',
        'doctors.consultation_fee',
        'users.first_name as doctor_first_name',
        'users.last_name as doctor_last_name'
      )
      .join('patients', 'appointments.patient_id', 'patients.id')
      .join('doctors', 'appointments.doctor_id', 'doctors.id')
      .join('users', 'doctors.user_id', 'users.id')
      .where('appointments.id', appointmentId)
      .where('appointments.payment_intent_id', paymentIntentId)
      .first();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${appointmentId.slice(-8)}`;

    // Create billing record
    const [billing] = await db('billing')
      .insert({
        patient_id: appointment.patient_id,
        appointment_id: appointmentId,
        invoice_number: invoiceNumber,
        amount: appointment.consultation_fee,
        tax_amount: 0, // Calculate tax if needed
        discount_amount: 0,
        total_amount: appointment.consultation_fee,
        status: 'paid',
        payment_method: 'credit_card',
        payment_intent_id: paymentIntentId,
        transaction_id: paymentIntent.charges.data[0]?.id,
        paid_at: new Date(),
        line_items: [{
          description: `Telemedicine consultation with Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
          amount: appointment.consultation_fee,
          quantity: 1
        }]
      })
      .returning('*');

    // Update appointment payment status
    await db('appointments')
      .where('id', appointmentId)
      .update({ payment_status: 'paid' });

    // Log audit event
    await logAuditEvent({
      userId: appointment.patient_user_id,
      action: 'confirm_payment',
      resourceType: 'billing',
      resourceId: billing.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        amount: appointment.consultation_fee,
        invoiceNumber,
        paymentIntentId
      }
    });

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        billing: {
          id: billing.id,
          invoiceNumber: billing.invoice_number,
          amount: billing.amount,
          totalAmount: billing.total_amount,
          status: billing.status,
          paidAt: billing.paid_at
        }
      }
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
});

// @route   GET /api/billing/invoices
// @desc    Get user's billing invoices
// @access  Private
router.get('/invoices', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query;
    
    if (req.user.role === 'patient') {
      // Get patient invoices
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

      query = db('billing')
        .select(
          'billing.*',
          'appointments.scheduled_at',
          'appointments.type as appointment_type',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name'
        )
        .leftJoin('appointments', 'billing.appointment_id', 'appointments.id')
        .leftJoin('doctors', 'appointments.doctor_id', 'doctors.id')
        .leftJoin('users', 'doctors.user_id', 'users.id')
        .where('billing.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      // Get doctor's billing (for their appointments)
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

      query = db('billing')
        .select(
          'billing.*',
          'appointments.scheduled_at',
          'appointments.type as appointment_type',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name'
        )
        .join('appointments', 'billing.appointment_id', 'appointments.id')
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
      query = query.where('billing.status', status);
    }

    // Get total count with a separate simpler query
    let countQuery = db('billing').count('* as count');

    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery.where('billing.patient_id', patient.id);
    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();
      countQuery = countQuery
        .join('appointments', 'billing.appointment_id', 'appointments.id')
        .where('appointments.doctor_id', doctor.id);
    }

    if (status) {
      countQuery = countQuery.where('billing.status', status);
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const invoices = await query
      .orderBy('billing.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        invoices: invoices.map(invoice => ({
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          taxAmount: invoice.tax_amount,
          discountAmount: invoice.discount_amount,
          totalAmount: invoice.total_amount,
          status: invoice.status,
          paymentMethod: invoice.payment_method,
          dueDate: invoice.due_date,
          paidAt: invoice.paid_at,
          createdAt: invoice.created_at,
          appointmentDate: invoice.scheduled_at,
          appointmentType: invoice.appointment_type,
          ...(req.user.role === 'patient' ? {
            doctor: invoice.doctor_first_name ? {
              name: `${invoice.doctor_first_name} ${invoice.doctor_last_name}`
            } : null
          } : {
            patient: {
              name: `${invoice.patient_first_name} ${invoice.patient_last_name}`
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
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoices'
    });
  }
});

// @route   GET /api/billing/invoices/:id
// @desc    Get invoice details
// @access  Private
router.get('/invoices/:id', async (req, res) => {
  try {
    let query;
    
    if (req.user.role === 'patient') {
      const patient = await db('patients')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('billing')
        .select(
          'billing.*',
          'appointments.scheduled_at',
          'appointments.type as appointment_type',
          'appointments.duration_minutes',
          'users.first_name as doctor_first_name',
          'users.last_name as doctor_last_name',
          'users.email as doctor_email'
        )
        .leftJoin('appointments', 'billing.appointment_id', 'appointments.id')
        .leftJoin('doctors', 'appointments.doctor_id', 'doctors.id')
        .leftJoin('users', 'doctors.user_id', 'users.id')
        .where('billing.id', req.params.id)
        .where('billing.patient_id', patient.id);

    } else if (req.user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('id')
        .where('user_id', req.user.id)
        .first();

      query = db('billing')
        .select(
          'billing.*',
          'appointments.scheduled_at',
          'appointments.type as appointment_type',
          'appointments.duration_minutes',
          'users.first_name as patient_first_name',
          'users.last_name as patient_last_name',
          'users.email as patient_email'
        )
        .join('appointments', 'billing.appointment_id', 'appointments.id')
        .join('patients', 'appointments.patient_id', 'patients.id')
        .join('users', 'patients.user_id', 'users.id')
        .where('billing.id', req.params.id)
        .where('appointments.doctor_id', doctor.id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const invoice = await query.first();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          taxAmount: invoice.tax_amount,
          discountAmount: invoice.discount_amount,
          totalAmount: invoice.total_amount,
          status: invoice.status,
          paymentMethod: invoice.payment_method,
          transactionId: invoice.transaction_id,
          dueDate: invoice.due_date,
          paidAt: invoice.paid_at,
          notes: invoice.notes,
          lineItems: invoice.line_items,
          insuranceClaim: invoice.insurance_claim,
          createdAt: invoice.created_at,
          appointment: {
            date: invoice.scheduled_at,
            type: invoice.appointment_type,
            durationMinutes: invoice.duration_minutes
          },
          ...(req.user.role === 'patient' ? {
            doctor: invoice.doctor_first_name ? {
              name: `${invoice.doctor_first_name} ${invoice.doctor_last_name}`,
              email: invoice.doctor_email
            } : null
          } : {
            patient: {
              name: `${invoice.patient_first_name} ${invoice.patient_last_name}`,
              email: invoice.patient_email
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('Get invoice details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice details'
    });
  }
});

// @route   POST /api/billing/webhook
// @desc    Stripe webhook handler
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent succeeded:', paymentIntent.id);
      
      // Update appointment payment status
      await db('appointments')
        .where('payment_intent_id', paymentIntent.id)
        .update({ payment_status: 'paid' });
      
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('PaymentIntent failed:', failedPayment.id);
      
      // Update appointment payment status
      await db('appointments')
        .where('payment_intent_id', failedPayment.id)
        .update({ payment_status: 'failed' });
      
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
