/**
 * routes/auth.js
 * Authentication routes for Telemedicine platform
 *
 * Expected mount point in server.js: app.use('/api/auth', require('./routes/auth'));
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

const router = express.Router();

/* -----------------------
   Validation rules
   ----------------------- */

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('role').isIn(['patient', 'doctor']).withMessage('Role must be patient or doctor')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

/* -----------------------
   Helper - validation result
   ----------------------- */
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return true; // indicates errors exist
  }
  return false;
}

/* -----------------------
   POST /register-admin
   Create first super admin (requires secret key)
   ----------------------- */
router.post(
  '/register-admin',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('phone').isMobilePhone().withMessage('Valid phone number is required'),
    body('secretKey').notEmpty().withMessage('Secret key is required')
  ],
  async (req, res) => {
    try {
      if (handleValidationErrors(req, res)) return;

      const { email, password, firstName, lastName, phone, secretKey } = req.body;

      if (!process.env.SUPER_ADMIN_SECRET_KEY) {
        console.error('SUPER_ADMIN_SECRET_KEY not set in environment');
        return res.status(500).json({ success: false, message: 'Server not configured' });
      }

      if (secretKey !== process.env.SUPER_ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, message: 'Invalid secret key' });
      }

      const existingUser = await db('users').where('email', email).first();
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists with this email' });
      }

      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const [user] = await db('users')
        .insert({
          email,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          phone,
          role: 'admin',
          email_verified: true,
          status: 'active'
        })
        .returning(['id', 'email', 'first_name', 'last_name', 'role', 'email_verified']);

      await logAuditEvent({
        userId: user.id,
        action: 'register',
        resourceType: 'user',
        resourceId: user.id,
        details: { role: 'admin', method: 'super_admin_registration' }
      });

      return res.status(201).json({
        success: true,
        message: 'Super admin account created successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role
          }
        }
      });
    } catch (err) {
      console.error('Admin registration error:', err);
      return res.status(500).json({ success: false, message: 'Failed to create admin account' });
    }
  }
);

/* -----------------------
   POST /register
   Register a new user (patient or doctor)
   ----------------------- */
router.post('/register', registerValidation, async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { email, password, firstName, lastName, phone, role, dateOfBirth, address } = req.body;

    const existingUser = await db('users').where('email', email).first();
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userData = {
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      phone,
      role,
      date_of_birth: dateOfBirth && dateOfBirth.trim() !== '' ? dateOfBirth : null,
      address: address && address.trim() !== '' ? address : null,
      email_verified: false,
      status: 'active'
    };

    const [user] = await db('users')
      .insert(userData)
      .returning(['id', 'email', 'first_name', 'last_name', 'role', 'email_verified']);

    if (role === 'patient') {
      await db('patients').insert({ user_id: user.id });
    } else if (role === 'doctor') {
      const { specialization, consultationFee } = req.body;
      await db('doctors').insert({
        user_id: user.id,
        specialization: specialization && specialization.trim() !== '' ? specialization : 'General Practice',
        consultation_fee: consultationFee && consultationFee > 0 ? consultationFee : 100.00
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: 'auth' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Send verification email (fire-and-forget, but catch errors)
    try {
      await sendVerificationEmail(user.email, user.first_name);
    } catch (mailErr) {
      console.error('Verification email error:', mailErr);
    }

    await logAuditEvent({
      userId: user.id,
      action: 'register',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          emailVerified: user.email_verified
        },
        token
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

/* -----------------------
   POST /login
   Login user
   ----------------------- */
router.post('/login', loginValidation, async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { email, password } = req.body;

    const user = await db('users').select('*').where('email', email).first();
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }

    await db('users').where('id', user.id).update({ last_login: new Date() });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: 'auth' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await logAuditEvent({
      userId: user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          emailVerified: user.email_verified,
          profileImage: user.profile_image_url || null
        },
        token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

/* -----------------------
   POST /verify-email
   ----------------------- */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Verification token is required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'email_verification') {
      return res.status(400).json({ success: false, message: 'Invalid verification token' });
    }

    await db('users').where('id', decoded.userId).update({ email_verified: true });

    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
  }
});

/* -----------------------
   POST /forgot-password
   ----------------------- */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await db('users').where('email', email).first();
    if (!user) {
      return res.json({ success: true, message: 'If the email exists, a password reset link has been sent' });
    }

    const resetToken = jwt.sign({ userId: user.id, type: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    try {
      await sendPasswordResetEmail(user.email, user.first_name, resetToken);
    } catch (mailErr) {
      console.error('Password reset email error:', mailErr);
    }

    return res.json({ success: true, message: 'If the email exists, a password reset link has been sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send password reset email' });
  }
});

/* -----------------------
   POST /reset-password
   ----------------------- */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password are required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ success: false, message: 'Invalid reset token' });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await db('users').where('id', decoded.userId).update({ password_hash: passwordHash });

    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
  }
});

/* -----------------------
   GET /me
   ----------------------- */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'phone', 'role', 'status', 'email_verified', 'profile_image_url', 'created_at')
      .where('id', req.user.userId || req.user.id)
      .first();

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          status: user.status,
          emailVerified: user.email_verified,
          profileImage: user.profile_image_url,
          createdAt: user.created_at
        }
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get user information' });
  }
});

/* -----------------------
   POST /logout
   ----------------------- */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    await logAuditEvent({
      userId,
      action: 'logout',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.json({ success: true, message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

module.exports = router;
