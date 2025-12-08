const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/auditLogger');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'));
    }
  }
});

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await db('users')
      .select('*')
      .where('id', req.user.id)
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get role-specific profile data
    let profileData = {};
    if (user.role === 'patient') {
      const patient = await db('patients')
        .select('*')
        .where('user_id', req.user.id)
        .first();
      profileData = patient;
    } else if (user.role === 'doctor') {
      const doctor = await db('doctors')
        .select('*')
        .where('user_id', req.user.id)
        .first();
      profileData = doctor;
    }

    // Remove sensitive data
    delete user.password_hash;

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          dateOfBirth: user.date_of_birth,
          address: user.address,
          city: user.city,
          state: user.state,
          zipCode: user.zip_code,
          country: user.country,
          role: user.role,
          status: user.status,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
          profileImage: user.profile_image_url,
          preferences: user.preferences,
          lastLogin: user.last_login,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        profile: profileData
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('phone').optional().isMobilePhone(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('zipCode').optional().trim(),
  body('country').optional().trim()
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
      firstName,
      lastName,
      phone,
      dateOfBirth,
      address,
      city,
      state,
      zipCode,
      country,
      preferences
    } = req.body;

    // Get current user data for audit log
    const currentUser = await db('users')
      .select('*')
      .where('id', req.user.id)
      .first();

    // Update user basic info
    const updateData = {};
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (phone) updateData.phone = phone;
    if (dateOfBirth) updateData.date_of_birth = dateOfBirth;
    if (address) updateData.address = address;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (zipCode) updateData.zip_code = zipCode;
    if (country) updateData.country = country;
    if (preferences) updateData.preferences = preferences;

    if (Object.keys(updateData).length > 0) {
      await db('users')
        .where('id', req.user.id)
        .update(updateData);
    }

    // Update role-specific profile
    if (req.user.role === 'patient') {
      const {
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        insuranceProvider,
        insurancePolicyNumber,
        insuranceGroupNumber,
        bloodType,
        height,
        weight
      } = req.body;

      const patientUpdateData = {};
      if (emergencyContactName) patientUpdateData.emergency_contact_name = emergencyContactName;
      if (emergencyContactPhone) patientUpdateData.emergency_contact_phone = emergencyContactPhone;
      if (emergencyContactRelationship) patientUpdateData.emergency_contact_relationship = emergencyContactRelationship;
      if (insuranceProvider) patientUpdateData.insurance_provider = insuranceProvider;
      if (insurancePolicyNumber) patientUpdateData.insurance_policy_number = insurancePolicyNumber;
      if (insuranceGroupNumber) patientUpdateData.insurance_group_number = insuranceGroupNumber;
      if (bloodType) patientUpdateData.blood_type = bloodType;
      if (height) patientUpdateData.height = height;
      if (weight) patientUpdateData.weight = weight;

      if (Object.keys(patientUpdateData).length > 0) {
        await db('patients')
          .where('user_id', req.user.id)
          .update(patientUpdateData);
      }
    } else if (req.user.role === 'doctor') {
      const {
        specialization,
        bio,
        consultationFee,
        experienceYears,
        education,
        certifications,
        languages,
        availability
      } = req.body;

      const doctorUpdateData = {};
      if (specialization) doctorUpdateData.specialization = specialization;
      if (bio) doctorUpdateData.bio = bio;
      if (consultationFee) doctorUpdateData.consultation_fee = consultationFee;
      if (experienceYears) doctorUpdateData.experience_years = experienceYears;
      if (education) doctorUpdateData.education = education;
      if (certifications) doctorUpdateData.certifications = certifications;
      if (languages) doctorUpdateData.languages = languages;
      if (availability) doctorUpdateData.availability = availability;

      if (Object.keys(doctorUpdateData).length > 0) {
        await db('doctors')
          .where('user_id', req.user.id)
          .update(doctorUpdateData);
      }
    }

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'update',
      resourceType: 'user_profile',
      resourceId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: {
        oldValues: currentUser,
        newValues: req.body
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// @route   POST /api/users/upload-profile-image
// @desc    Upload profile image
// @access  Private
router.post('/upload-profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const profileImageUrl = `/uploads/profiles/${req.file.filename}`;

    // Update user profile image
    await db('users')
      .where('id', req.user.id)
      .update({ profile_image_url: profileImageUrl });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'update',
      resourceType: 'user_profile_image',
      resourceId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        profileImageUrl
      }
    });

  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image'
    });
  }
});

// @route   GET /api/users/doctors
// @desc    Get list of doctors
// @access  Private
router.get('/doctors', async (req, res) => {
  try {
    const { specialization, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('doctors')
      .select(
        'doctors.*',
        'users.first_name',
        'users.last_name',
        'users.profile_image_url',
        'users.email'
      )
      .join('users', 'doctors.user_id', 'users.id')
      .where('doctors.is_available', true)
      .where('users.status', 'active');

    // Apply filters
    if (specialization) {
      query = query.where('doctors.specialization', 'ilike', `%${specialization}%`);
    }

    if (search) {
      query = query.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('doctors.specialization', 'ilike', `%${search}%`);
      });
    }

    // Get total count with a separate simpler query
    let countQuery = db('doctors')
      .join('users', 'doctors.user_id', 'users.id')
      .where('doctors.is_available', true)
      .where('users.status', 'active')
      .count('* as count');

    if (specialization) {
      countQuery = countQuery.where('doctors.specialization', 'ilike', `%${specialization}%`);
    }

    if (search) {
      countQuery = countQuery.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('doctors.specialization', 'ilike', `%${search}%`);
      });
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const doctors = await query
      .orderBy('doctors.rating', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        doctors: doctors.map(doctor => ({
          id: doctor.id,
          userId: doctor.user_id,
          name: `${doctor.first_name} ${doctor.last_name}`,
          specialization: doctor.specialization,
          bio: doctor.bio,
          consultationFee: doctor.consultation_fee,
          experienceYears: doctor.experience_years,
          rating: doctor.rating,
          totalReviews: doctor.total_reviews,
          profileImage: doctor.profile_image_url,
          languages: doctor.languages,
          availability: doctor.availability
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
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get doctors'
    });
  }
});

// @route   GET /api/users/doctors
// @desc    Get list of doctors
// @access  Private
router.get('/doctors', async (req, res) => {
  try {
    const { specialization, search, page = 1, limit } = req.query;

    // Allow unlimited doctors by default
    const finalLimit = limit ? parseInt(limit) : 1000;
    const offset = (page - 1) * finalLimit;

    let query = db('doctors')
      .select(
        'doctors.*',
        'users.first_name',
        'users.last_name',
        'users.profile_image_url',
        'users.email'
      )
      .join('users', 'doctors.user_id', 'users.id')
      .where('doctors.is_available', true)
      .where('users.status', 'active');

    // Filter by specialization
    if (specialization) {
      query = query.where('doctors.specialization', 'ilike', `%${specialization}%`);
    }

    // Search filter
    if (search) {
      query = query.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('doctors.specialization', 'ilike', `%${search}%`)
          .orWhere('doctors.bio', 'ilike', `%${search}%`);
      });
    }

    // Count total records
    let countQuery = db('doctors')
      .join('users', 'doctors.user_id', 'users.id')
      .where('doctors.is_available', true)
      .where('users.status', 'active')
      .count('* as count');

    if (specialization) {
      countQuery = countQuery.where('doctors.specialization', 'ilike', `%${specialization}%`);
    }

    if (search) {
      countQuery = countQuery.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('doctors.specialization', 'ilike', `%${search}%`)
          .orWhere('doctors.bio', 'ilike', `%${search}%`);
      });
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Fetch doctors
    const doctors = await query
      .orderBy('doctors.rating', 'desc')
      .limit(finalLimit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        doctors: doctors.map(doctor => ({
          id: doctor.id,
          userId: doctor.user_id,
          name: `${doctor.first_name} ${doctor.last_name}`,
          specialization: doctor.specialization,
          bio: doctor.bio,
          consultationFee: doctor.consultation_fee,
          experienceYears: doctor.experience_years,
          rating: doctor.rating,
          totalReviews: doctor.total_reviews,
          profileImage: doctor.profile_image_url,
          languages: doctor.languages,
          availability: doctor.availability
        })),
        pagination: {
          page: parseInt(page),
          limit: finalLimit,
          total: totalCount,
          pages: Math.ceil(totalCount / finalLimit)
        }
      }
    });

  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get doctors'
    });
  }
});


// @route   GET /api/users/patients
// @desc    Get list of patients (for doctors to create prescriptions)
// @access  Private (Doctor only)
router.get('/patients', requireRole(['doctor']), async (req, res) => {
  try {
    const { search, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('patients')
      .select(
        'patients.id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.phone',
        'users.profile_image_url'
      )
      .join('users', 'patients.user_id', 'users.id')
      .where('users.status', 'active');

    // Apply search filter
    if (search) {
      query = query.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    let countQuery = db('patients')
      .join('users', 'patients.user_id', 'users.id')
      .where('users.status', 'active')
      .count('* as count');

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
    const patients = await query
      .orderBy('users.last_name', 'asc')
      .orderBy('users.first_name', 'asc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        patients: patients.map(patient => ({
          id: patient.id,
          name: `${patient.first_name} ${patient.last_name}`,
          email: patient.email,
          phone: patient.phone,
          profileImage: patient.profile_image_url
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
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patients'
    });
  }
});

module.exports = router;
