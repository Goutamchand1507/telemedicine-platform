const jwt = require('jsonwebtoken');

// Check if email is configured
const isEmailConfigured = () => {
  return process.env.SMTP_USER && process.env.SMTP_PASS;
};

// Create email transporter
const createTransporter = () => {
  // Only require nodemailer if email is configured
  if (!isEmailConfigured()) {
    return null;
  }

  const nodemailer = require('nodemailer');
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Send email verification email
 * @param {string} email - Recipient email
 * @param {string} firstName - Recipient first name
 */
async function sendVerificationEmail(email, firstName) {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      console.log(`⚠️  Email not configured. Skipping verification email to ${email}`);
      console.log(`ℹ️  In development, email verification is optional.`);
      return true; // Return success to not block registration
    }

    const transporter = createTransporter();

    // Generate verification token
    const verificationToken = jwt.sign(
      {
        email,
        type: 'email_verification',
        userId: null // Will be set when user is created
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@telemedicine.com',
      to: email,
      subject: 'Verify Your Email - Telemedicine Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Welcome to Telemedicine Platform!</h2>
          <p>Hello ${firstName},</p>
          <p>Thank you for registering with our telemedicine platform. To complete your registration, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #7f8c8d;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account with us, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // In development, don't throw error - just log and continue
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  Continuing without email in development mode`);
      return true;
    }
    throw error;
  }
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {string} resetToken - Password reset token
 */
async function sendPasswordResetEmail(email, firstName, resetToken) {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      console.log(`⚠️  Email not configured. Skipping password reset email to ${email}`);
      console.log(`ℹ️  In development, password reset emails are optional.`);
      return true;
    }

    const transporter = createTransporter();

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@telemedicine.com',
      to: email,
      subject: 'Password Reset - Telemedicine Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Password Reset Request</h2>
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password for your Telemedicine Platform account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #7f8c8d;">${resetUrl}</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  Continuing without email in development mode`);
      return true;
    }
    throw error;
  }
}

/**
 * Send appointment confirmation email
 * @param {string} email - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {Object} appointment - Appointment details
 */
async function sendAppointmentConfirmation(email, firstName, appointment) {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      console.log(`⚠️  Email not configured. Skipping appointment confirmation email to ${email}`);
      console.log(`ℹ️  In development, appointment confirmation emails are optional.`);
      return true;
    }

    const transporter = createTransporter();

    const appointmentDate = new Date(appointment.scheduled_at).toLocaleString();
    const meetingUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/video-call/${appointment.id}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@telemedicine.com',
      to: email,
      subject: 'Appointment Confirmation - Telemedicine Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Appointment Confirmed</h2>
          <p>Hello ${firstName},</p>
          <p>Your appointment has been confirmed. Here are the details:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Date & Time:</strong> ${appointmentDate}</p>
            <p><strong>Duration:</strong> ${appointment.duration_minutes} minutes</p>
            <p><strong>Type:</strong> ${appointment.type}</p>
            <p><strong>Doctor:</strong> ${appointment.doctor_name}</p>
            <p><strong>Specialization:</strong> ${appointment.doctor_specialization}</p>
          </div>
          <p>To join your video consultation, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${meetingUrl}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Join Video Call</a>
          </div>
          <p><strong>Important:</strong></p>
          <ul>
            <li>Please join the call 5 minutes before your scheduled time</li>
            <li>Ensure you have a stable internet connection</li>
            <li>Test your camera and microphone before the call</li>
            <li>Have your health records and questions ready</li>
          </ul>
          <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Appointment confirmation sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send appointment confirmation:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  Continuing without email in development mode`);
      return true;
    }
    throw error;
  }
}

/**
 * Send appointment reminder email
 * @param {string} email - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {Object} appointment - Appointment details
 */
async function sendAppointmentReminder(email, firstName, appointment) {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      console.log(`⚠️  Email not configured. Skipping appointment reminder email to ${email}`);
      return true;
    }

    const transporter = createTransporter();

    const appointmentDate = new Date(appointment.scheduled_at).toLocaleString();
    const meetingUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/video-call/${appointment.id}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@telemedicine.com',
      to: email,
      subject: 'Appointment Reminder - Tomorrow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Appointment Reminder</h2>
          <p>Hello ${firstName},</p>
          <p>This is a friendly reminder that you have an appointment tomorrow:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Date & Time:</strong> ${appointmentDate}</p>
            <p><strong>Duration:</strong> ${appointment.duration_minutes} minutes</p>
            <p><strong>Doctor:</strong> ${appointment.doctor_name}</p>
            <p><strong>Specialization:</strong> ${appointment.doctor_specialization}</p>
          </div>
          <p>To join your video consultation, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${meetingUrl}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Join Video Call</a>
          </div>
          <p><strong>Pre-appointment checklist:</strong></p>
          <ul>
            <li>✓ Test your internet connection</li>
            <li>✓ Check camera and microphone</li>
            <li>✓ Prepare your health questions</li>
            <li>✓ Have your medications list ready</li>
          </ul>
          <p>If you need to reschedule, please contact us as soon as possible.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Appointment reminder sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send appointment reminder:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  Continuing without email in development mode`);
      return true;
    }
    throw error;
  }
}

/**
 * Send prescription notification email
 * @param {string} email - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {Object} prescription - Prescription details
 */
async function sendPrescriptionNotification(email, firstName, prescription) {
  try {
    const transporter = createTransporter();

    const prescribedDate = new Date(prescription.prescribed_date).toLocaleDateString();

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@telemedicine.com',
      to: email,
      subject: 'New Prescription Available - Telemedicine Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">New Prescription</h2>
          <p>Hello ${firstName},</p>
          <p>Your doctor has prescribed a new medication. Here are the details:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Medication:</strong> ${prescription.medication_name}</p>
            <p><strong>Dosage:</strong> ${prescription.dosage}</p>
            <p><strong>Instructions:</strong> ${prescription.instructions}</p>
            <p><strong>Quantity:</strong> ${prescription.quantity}</p>
            <p><strong>Refills:</strong> ${prescription.refills_allowed}</p>
            <p><strong>Prescribed Date:</strong> ${prescribedDate}</p>
            ${prescription.pharmacy_name ? `<p><strong>Pharmacy:</strong> ${prescription.pharmacy_name}</p>` : ''}
          </div>
          <p><strong>Important:</strong></p>
          <ul>
            <li>Please follow the dosage instructions carefully</li>
            <li>Contact your doctor if you experience any side effects</li>
            <li>Keep track of your medication schedule</li>
            <li>Store medications as directed</li>
          </ul>
          <p>You can view your complete prescription history in your patient portal.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Prescription notification sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send prescription notification:', error);
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendPrescriptionNotification
};
