# Quick Start Deployment Guide

## 🚀 Deploy to Railway (Recommended - FREE)

Railway is the easiest and best free option for this project because it supports WebSockets (required for video calls).

### Steps:

1. **Push your code to GitHub**
   ```bash
   git push origin main
   ```
   (You'll need to authenticate with GitHub first)

2. **Sign up for Railway**
   - Go to https://railway.app
   - Sign up with GitHub (free)
   - You get $5 free credit per month

3. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your `telemedicine-platform` repository
   - Railway will detect docker-compose.yml automatically

4. **Add PostgreSQL Database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically create DATABASE_URL environment variable

5. **Configure Environment Variables**
   - Click on your server service
   - Go to "Variables" tab
   - Add these variables:
     ```
     NODE_ENV=production
     JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-chars
     CORS_ORIGIN=https://your-app-url.railway.app
     ```

6. **Deploy**
   - Railway will automatically build and deploy
   - You'll get URLs like:
     - Server: `https://your-server.railway.app`
     - Client: `https://your-client.railway.app`

7. **Update Client Environment**
   - Go to client service → Variables
   - Add:
     ```
     REACT_APP_API_URL=https://your-server.railway.app/api
     REACT_APP_SOCKET_URL=https://your-server.railway.app
     ```

8. **Redeploy**
   - Click "Deploy" button to restart with new variables

### That's it! Your app is live! 🎉

---

## 🏠 Local Development with Docker

If you want to test locally first:

```bash
# 1. Create environment file
cp .env.example .env

# 2. Run deployment script
./deploy.sh

# 3. Access your app
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
```

---

## 🔐 Important Security Notes

Before going to production:

1. **Change JWT_SECRET** to a strong random string (at least 32 characters)
   ```bash
   # Generate a secure secret
   openssl rand -base64 32
   ```

2. **Change DB_PASSWORD** to a strong password

3. **Configure CORS_ORIGIN** with your actual domain

4. **Set up email** (optional, but recommended for production)

---

## 🐛 Troubleshooting

### Video calls not working?
- Make sure WebSocket connections are allowed (Railway supports this by default)
- Check browser console for WebRTC errors
- Verify CORS settings include your domain

### Database connection issues?
- Check that DATABASE_URL environment variable is set
- Verify database service is running
- Check server logs for connection errors

### Frontend not connecting to backend?
- Verify REACT_APP_API_URL is correct
- Verify REACT_APP_SOCKET_URL is correct
- Check CORS settings on server

---

## 📊 Free Tier Limits (Railway)

- $5 credit per month (resets monthly)
- Approximately:
  - 500 hours of usage
  - Enough for a development app with moderate traffic
  - WebSocket support included

---

## 🆘 Need Help?

Check the detailed guide: [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)

## ✅ Pre-Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Railway account created
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] JWT_SECRET changed from default
- [ ] CORS_ORIGIN set to your domain
- [ ] Client environment variables updated
- [ ] Services deployed and healthy
- [ ] Test video call functionality
- [ ] Test appointment booking
- [ ] Test user registration and login

---

## 🎯 Alternative Free Platforms

If Railway doesn't work for you, check out:

1. **Render** - Free tier, sleeps after 15 min inactivity
2. **Fly.io** - Free tier, 3 VMs with 256MB RAM
3. **DigitalOcean** - $200 free credit for 60 days

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for detailed instructions for each platform.
