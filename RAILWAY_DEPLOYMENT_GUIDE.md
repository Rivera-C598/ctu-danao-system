# Railway Deployment Guide - CTU Room Management System

## ✅ Pre-Deployment Checklist

- [ ] GitHub account created
- [ ] Your code pushed to GitHub
- [ ] Changed admin password (NOT admin123)
- [ ] Tested locally one more time
- [ ] Backed up your data.json

---

## 📋 Step 1: Push Code to GitHub

If not already done:

```powershell
cd c:\Ctu-system-2026
git init
git add .
git commit -m "CTU System Ready for Production"
git remote add origin https://github.com/YOUR_USERNAME/ctu-system-2026.git
git push -u origin main
```

---

## 🚀 Step 2: Deploy on Railway

### 2.1 Create Railway Account
1. Go to **https://railway.app**
2. Click "Start New Project"
3. Sign in with GitHub (easiest)

### 2.2 Create New Project
1. Click "Create a new project" or "Deploy from GitHub"
2. Select your `ctu-system-2026` repository
3. Railway auto-detects Node.js

### 2.3 Add Database
**Option A: Using MySQL (Recommended)**
1. In Railway dashboard, click "+ Add Service"
2. Click "MySQL"
3. Railway creates a database automatically
4. Copy connection details

**Option B: Using PostgreSQL**
1. In Railway dashboard, click "+ Add Service"
2. Click "PostgreSQL"
3. Railway creates a database automatically

---

## 🔧 Step 3: Configure Environment Variables

In Railway Dashboard:

1. Go to your **ctu-system-2026** service
2. Click **"Variables"** tab
3. Add these variables:

```
NODE_ENV              = production
DB_HOST               = (Railway MySQL host)
DB_USER               = (Railway MySQL user)
DB_PASSWORD           = (Railway MySQL password)
DB_NAME               = ctu_room_management
DB_PORT               = 3306
ADMIN_USERNAME        = admin
ADMIN_PASSWORD        = (NEW STRONG PASSWORD)
```

**To get MySQL details:**
1. Click on your MySQL service in Railway
2. Go to "Connect" tab
3. Copy Host, User, Password

---

## 🌐 Step 4: Deploy

1. Railway auto-deploys when you push to GitHub
2. OR manually deploy by clicking "Deploy"
3. Wait 2-3 minutes
4. View logs to check for errors
5. Once "Running ✅" - it's live!

---

## 📍 Step 5: Access Your System

Railway gives you a unique URL:
```
https://ctu-system-2026-production.up.railway.app
```

(Your actual URL will be different)

### Access From:
- **Desktop/Laptop:** Open the Railway URL in browser
- **Mobile on same network:** Same URL works
- **Mobile on different network:** Also works (it's on the internet!)

---

## 🔐 Security Checklist

After deployment:

- [ ] Login works with new credentials
- [ ] Test room status updates sync across 2 devices
- [ ] Test on mobile device
- [ ] Check `/health` endpoint works
- [ ] Verify no console errors
- [ ] Test real-time notifications

---

## ⚠️ Important Notes

### Data Persistence
- Your `data.json` will be used locally but **NOT persisted** on Railway
- **Solution:** Use the MySQL database (highly recommended)
- OR accept data resets on app restarts

### SSL/HTTPS
- Railway automatically provides HTTPS
- Your system will be secure by default ✅

### Uptime
- Railway keeps your app running 24/7
- If it crashes, it auto-restarts
- 99.9% uptime guarantee

### Cost
- Free tier: Limited hours
- Pay-as-you-go: ~$5-10/month for typical usage
- Plenty for a campus system

---

## 🐛 If Something Goes Wrong

### Check Railway Logs
1. Click your service in Railway
2. Go to "Logs" tab
3. Look for error messages

### Common Issues

**"Connection refused"**
- Check DATABASE credentials in Variables
- Verify MySQL service is running

**"Port already in use"**
- Railway assigns PORT automatically
- Don't hardcode port 5501 in production

**"Socket.io not connecting"**
- Check browser console for errors
- Verify CORS settings (already configured ✅)

**"Real-time sync not working"**
- Check Socket.io connection in browser DevTools
- Verify websocket/polling both enabled

---

## 📞 Need Help?

- Railway Support: https://railway.app/support
- Socket.io Docs: https://socket.io/docs/
- Node.js Docs: https://nodejs.org/docs/

---

## ✨ You're Now in Production! 🎉

Your CTU Room Management System is live and accessible 24/7.

Monitor it at: https://railway.app (check logs anytime)

Good luck with your deployment! 🚀
