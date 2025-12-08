# Admin Panel Access Guide

## How to Access Admin Panel

**Admin Panel URL**:
- Local: `http://localhost:3001/admin/dashboard`
- Production: `https://telemedicine-platform-iota.vercel.app/admin/dashboard`

## Creating an Admin User

You need an admin user account to access the admin panel. Here are three methods:

### Method 1: Using the Create Admin Script (Recommended)

Run this command from the server directory:

```bash
cd server
npm run create-admin
```

This will create an admin user with default credentials:
- **Email**: `admin@telemedicine.com`
- **Password**: `Admin@123456`

**Custom credentials:**
```bash
npm run create-admin your-email@example.com YourPassword123 FirstName LastName
```

### Method 2: Using Database Seed

Run the seed file to create the default admin user:

```bash
cd server
npm run db:seed
```

This creates the same default admin user as Method 1.

### Method 3: Manual Database Update

If you already have a user account, you can promote it to admin:

```sql
-- Update existing user to admin
UPDATE users
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Default Admin Credentials

**⚠️ IMPORTANT: Change these after first login!**

- **Email**: `admin@telemedicine.com`
- **Password**: `Admin@123456`

## Admin Panel Features

Once logged in as admin, you can access:

1. **Admin Dashboard** (`/admin/dashboard`)
   - System overview and statistics
   - Recent activity

2. **User Management** (`/admin/users`)
   - View all users (patients, doctors, admins)
   - Manage user accounts
   - Verify doctors
   - Suspend/activate accounts

3. **Appointment Management** (`/admin/appointments`)
   - View all appointments
   - Monitor appointment activity
   - Generate reports

4. **Audit Logs** (`/admin/audit-logs`)
   - Track system activities
   - Monitor security events
   - View user actions

## Security Notes

1. **Change Default Password**: Always change the default password immediately after first login
2. **Use Strong Passwords**: Admin accounts should use strong, unique passwords
3. **Limited Access**: Only create admin accounts for trusted personnel
4. **Regular Audits**: Review audit logs regularly for suspicious activity
5. **Environment Variables**: Store admin credentials securely in environment variables for production

## Troubleshooting

### Cannot Login
- Verify the user exists in the database
- Check that the user's role is set to 'admin'
- Ensure email is verified (`email_verified = true`)
- Check user status is 'active'

### Script Not Working
```bash
# Make sure you're in the server directory
cd server

# Install dependencies if needed
npm install

# Check database connection
npm run db:migrate

# Try creating admin again
npm run create-admin
```

### Access Denied
- The admin routes require the `admin` role
- Check your JWT token has the correct role claim
- Try logging out and logging back in

## Admin Route Protection

All admin routes are protected by:
1. Authentication (JWT token required)
2. Role-based access (admin role required)

The middleware checks both before allowing access to admin pages.
