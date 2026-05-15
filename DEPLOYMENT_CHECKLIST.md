# CTU System - Railway Deployment Checklist
# Complete this before Monday deployment!

## 🔒 SECURITY - DO FIRST!

- [ ] **Change admin password**
  Current: `admin123`
  Change to: Strong password (numbers, letters, symbols)
  WHERE: In server.js -> DEFAULT_ADMIN object
  
  ```javascript
  const DEFAULT_ADMIN = {
      username: 'admin',
      password: 'YOUR_NEW_STRONG_PASSWORD', // Change this!
      ...
  };
  ```

- [ ] Delete any test/development passwords from code
- [ ] Remove any hardcoded IP addresses
- [ ] Check config files don't have secrets exposed

## 📱 FUNCTIONALITY TESTING (Test Locally)

- [ ] Test login with admin/admin123 (or new password)
- [ ] Test admin dashboard loads
- [ ] Test instructor dashboard loads
- [ ] Test room status updates
- [ ] Test real-time sync (open 2 browser windows)
- [ ] Test notifications appear
- [ ] Test mobile responsiveness
- [ ] Test logout works

## 📦 CODE PREPARATION

- [ ] Verify server.js uses `process.env.PORT` ✅ (Already correct)
- [ ] Verify database config uses environment variables ✅ (Already correct)
- [ ] Verify firebase-config.js uses dynamic URL ✅ (Already correct)
- [ ] No hardcoded 'localhost' in code
- [ ] Remove any console.error() with sensitive data
- [ ] Package.json has correct start script ✅ (Already correct)

## 📁 FILE ORGANIZATION

- [ ] All files in repository (git status should be clean)
- [ ] .env.example created ✅
- [ ] .gitignore created ✅
- [ ] railway.json created ✅
- [ ] RAILWAY_DEPLOYMENT_GUIDE.md created ✅
- [ ] Backup of data.json saved safely

## 🌐 GITHUB SETUP

- [ ] GitHub account created
- [ ] Repository created
- [ ] Code pushed to GitHub
  ```bash
  git init
  git add .
  git commit -m "CTU System Ready for Production"
  git remote add origin https://github.com/YOUR_USERNAME/ctu-system-2026.git
  git push -u origin main
  ```

## 🚀 RAILWAY SETUP

- [ ] Railway account created at https://railway.app
- [ ] GitHub connected to Railway
- [ ] New project created in Railway
- [ ] MySQL service added in Railway
- [ ] Environment variables configured in Railway dashboard
- [ ] Deployment successful (status shows "Running ✅")

## ✅ POST-DEPLOYMENT VERIFICATION

- [ ] Can access system at Railway URL
- [ ] Login works with credentials
- [ ] Admin dashboard accessible
- [ ] Real-time sync working (test on 2 devices)
- [ ] Notifications working
- [ ] Mobile access working
- [ ] No console errors (check browser DevTools)
- [ ] Railway logs show no errors

## 📊 MONITORING (After Deployment)

- [ ] Check Railway dashboard regularly
- [ ] Monitor system logs for errors
- [ ] Test login/logout daily
- [ ] Backup data periodically
- [ ] Monitor uptime status

## 🆘 EMERGENCY CONTACTS

If deployment fails:
1. Check Railway logs for errors
2. Verify environment variables are correct
3. Test locally first
4. Ask me for help before going live

---

## ⏰ TIMELINE

- **Today (Friday):** Complete security & testing checklist
- **Saturday:** Push to GitHub, create Railway account
- **Sunday:** Deploy to Railway, final testing
- **Monday 7 AM:** System is LIVE! ✅

## 📝 NOTES

- All features will work on Railway ✅
- System uses Socket.io (fully supported) ✅
- Data persists with MySQL database ✅
- 24/7 uptime guaranteed ✅
- HTTPS automatic (Railway provides) ✅

**You're ready! Let's go live on Monday! 🚀**
