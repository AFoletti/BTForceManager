# 🚀 Quick Deployment Guide

Your BattleTech Forces Manager is **ready to deploy** to GitHub Pages!

## ✅ Files Ready for Deployment

The following files are in the root directory and ready to serve:

```
/app/
├── index.html          ← Main entry point
├── static/             ← CSS and JavaScript bundles
│   ├── css/
│   └── js/
└── .nojekyll          ← GitHub Pages config
```

## 🎯 Deploy to GitHub Pages (3 Steps)

### Step 1: Push to GitHub

```bash
cd /app

# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Deploy BattleTech Forces Manager"

# Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to main branch
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under "Build and deployment":
   - **Source**: Deploy from a branch
   - **Branch**: `main`
   - **Folder**: `/ (root)`
5. Click **Save**

### Step 3: Access Your App

After 1-2 minutes, your app will be live at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

## ✨ That's It!

GitHub Pages will automatically serve:
- `index.html` as the main page
- `static/` folder with all assets
- `.nojekyll` prevents Jekyll processing

## 🔄 Updating Your Deployment

When you make changes:

1. Edit source code in `/frontend/src/`
2. Build: `cd frontend && yarn build`
3. Copy to root: `./build-deploy.sh`
4. Commit and push:
   ```bash
   git add .
   git commit -m "Update app"
   git push
   ```

GitHub Pages will automatically update your live site!

## 📱 Testing Locally

Before deploying, test the production build:

```bash
# Start a local server in the root directory
cd /app
python3 -m http.server 8000

# Open http://localhost:8000 in your browser
```

## 🎨 Customization

### Change Repository URL in README
Update the live demo link in `README.md`:
```markdown
**🚀 Live Demo:** [View on GitHub Pages](https://your-username.github.io/your-repo-name/)
```

### Add Custom Domain (Optional)
1. Create a file named `CNAME` in root with your domain:
   ```
   yourdomain.com
   ```
2. Configure DNS with your domain provider
3. Update GitHub Pages settings

## 🐛 Troubleshooting

**404 Error?**
- Verify you selected "/ (root)" folder, not "/docs"
- Check that `index.html` is in the root of your repository
- Wait 2-3 minutes after first deployment

**Blank Page?**
- Check browser console for errors
- Verify `.nojekyll` file exists in root
- Ensure `static/` folder contains css and js files

**Changes Not Showing?**
- Clear browser cache (Ctrl+Shift+R)
- Wait 1-2 minutes for GitHub to rebuild
- Verify your commit was pushed successfully

## 📚 Documentation

- **README.md** - Full feature documentation
- **docs/DEPLOYMENT.md** - Detailed deployment guide
- **docs/GETTING_STARTED.md** - User guide

## 🎉 Success!

Your BattleTech Forces Manager is production-ready with:
- ✅ Military tactical design
- ✅ Complete force management
- ✅ Warchest mission & repair system
- ✅ Data persistence & export/import
- ✅ Fully responsive
- ✅ GitHub Pages ready

Happy commanding! 🎖️
