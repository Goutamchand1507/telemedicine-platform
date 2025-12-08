# Admin Registration Guide

## Overview

Your telemedicine platform now has a Super Admin registration system that allows you to create the first administrator account securely.

## How It Works

1. **First Admin Registration**: Only ONE admin can register through this page
2. **Secret Key Protection**: Requires a secret key from environment variables
3. **Auto-Verification**: Admin accounts are automatically verified
4. **One-Time Use**: Once an admin exists, the page won't allow more registrations

## Step-by-Step Setup

### For Local Development:

#### 1. Set the Secret Key

The secret key is already in your `.env` file:
```
SUPER_ADMIN_SECRET_KEY=SuperSecretKey12345ChangeThisInProduction!
```

#### 2. Access the Registration Page

Go to: `http://localhost:3001/admin-register`

#### 3. Fill in the Form

- **Secret Key**: `SuperSecretKey12345ChangeThisInProduction!`
- **First Name**: Your first name
- **Last Name**: Your last name
- **Email**: Your email address
- **Phone**: Your phone number
- **Password**: At least 8 characters
- **Confirm Password**: Same as password

#### 4. Submit

Click "Create Super Admin Account" and you'll be redirected to login.

#### 5. Login as Admin

- Go to `/login`
- Use your new admin credentials
- After login, visit `/admin/dashboard`

### For Production (Vercel):

#### 1. Add Environment Variable on Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Key**: `SUPER_ADMIN_SECRET_KEY`
   - **Value**: Create a strong, unique secret key (e.g., use a password generator)
   - **Environment**: Production

#### 2. Redeploy

After adding the environment variable, redeploy your application or wait for the next deployment.

#### 3. Access the Registration Page

Go to: `https://telemedicine-platform-iota.vercel.app/admin-register`

#### 4. Register Your Admin

Use the secret key you set in Vercel environment variables.

## Security Notes

### ⚠️ IMPORTANT:

1. **Change the Secret Key**: The default secret key in `.env` is for development only
2. **Keep It Secret**: Never commit the production secret key to git
3. **Strong Passwords**: Use strong passwords for admin accounts
4. **One Admin Only**: The system only allows ONE super admin registration
5. **Store Safely**: Save your admin credentials in a password manager

### Production Secret Key Best Practices:

- Use a random, 32+ character string
- Include uppercase, lowercase, numbers, and special characters
- Don't reuse keys from other systems
- Store in a secure location (password manager, secrets vault)

Example strong key:
```
Xk9#mP2$vL7&nQ4@wR8!yT5^zU3*aB6%cD1
```

## What Happens After Registration?

1. ✅ Admin account is created with `role='admin'`
2. ✅ Email is automatically verified
3. ✅ Account status is set to 'active'
4. ✅ Audit log entry is created
5. ✅ You can now access the admin panel

## Admin Panel Access

After registration and login, you can access:

- **Dashboard**: `/admin/dashboard` - System overview and statistics
- **Users**: `/admin/users` - Manage all users
- **Appointments**: `/admin/appointments` - Monitor appointments
- **Audit Logs**: `/admin/audit-logs` - View system activity

## Troubleshooting

### "Invalid secret key" error
- Check that `SUPER_ADMIN_SECRET_KEY` is set in your environment
- Make sure you're using the exact value (no extra spaces)
- Restart your server after adding the environment variable

### "An admin account already exists" error
- This means an admin has already been created
- You can only create ONE admin through this page
- If you need to create more admins, use the Admin User Management page (coming soon)
- Or update the role directly in the database

### Page shows "Admin account already exists"
- This is expected if an admin was already created
- Use the existing admin account to login
- Admins can promote other users to admin from the user management page

## Alternative: Create Admin via Database

If you prefer to create an admin directly in the database:

```sql
-- Update existing user to admin
UPDATE users
SET role = 'admin', email_verified = true, status = 'active'
WHERE email = 'your-email@example.com';
```

## Next Steps

After creating your admin account:

1. ✅ Login with admin credentials
2. ✅ Access the admin dashboard
3. ⏳ Wait for admin pages to be fully built (Dashboard, Users, etc.)
4. ✅ Change your password from the profile page
5. ✅ Set up additional administrators (when user management is ready)

## Questions?

- **Can I create multiple super admins?** No, only one through this page. Additional admins can be created by existing admins in the user management section.
- **What if I forget the secret key?** Check your environment variables or `.env` file.
- **Can I change the secret key later?** Yes, but it won't affect existing admin accounts.
- **Is this secure?** Yes, as long as you keep the secret key private and use strong passwords.
