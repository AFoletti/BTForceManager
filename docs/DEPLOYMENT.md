# BattleTech Forces Manager - Deployment Guide

## GitHub Pages Deployment

### Prerequisites
- GitHub account
- Git installed locally
- Node.js and yarn installed

### Step 1: Prepare Your Repository

1. Create a new repository on GitHub (e.g., `battletech-forces-manager`)
2. Clone this project to your local machine
3. Initialize git (if not already done):
```bash
cd /app
git init
git add .
git commit -m "Initial commit - BattleTech Forces Manager"
```

### Step 2: Configure GitHub Pages

1. Update `package.json` with your repository info:
```json
{
  "homepage": "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME"
}
```

2. Install gh-pages package:
```bash
cd frontend
yarn add --dev gh-pages
```

3. Add deployment scripts to `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  }
}
```

### Step 3: Build and Deploy

```bash
cd frontend
yarn build
yarn deploy
```

Or manually:
```bash
cd frontend
yarn build
# Then copy the build folder to your gh-pages branch
```

### Step 4: Configure GitHub Repository

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under "Source", select:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
4. Click **Save**

### Step 5: Access Your App

Your app will be available at:
```
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME
```

## Alternative: Deploy Build Folder Manually

If you prefer manual deployment:

1. Build the app:
```bash
cd frontend
yarn build
```

2. The `build` folder contains your static site
3. Push the contents of `build` folder to `gh-pages` branch:
```bash
git checkout -b gh-pages
cp -r frontend/build/* .
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

## Important Notes

### Data Persistence
- All data is stored in **browser localStorage**
- Data persists between sessions on the same browser
- Clearing browser data will reset the app
- Use Export/Import to backup your forces

### Cross-Browser Compatibility
- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- LocalStorage must be enabled

### Mobile Support
- Fully responsive design
- Works on tablets and mobile devices
- Best experience on desktop/laptop screens

## Updating Your Deployment

Whenever you make changes:

1. Make your code changes
2. Test locally: `cd frontend && yarn start`
3. Build: `yarn build`
4. Deploy: `yarn deploy` (if using gh-pages)
5. Or manually push build folder to gh-pages branch

## Troubleshooting

### Build Fails
- Ensure all dependencies are installed: `yarn install`
- Check for syntax errors in your code
- Review build logs for specific errors

### GitHub Pages Shows 404
- Verify gh-pages branch exists
- Check GitHub Pages settings in repository
- Ensure homepage in package.json matches your repo URL
- Wait a few minutes after deployment for changes to propagate

### Data Not Persisting
- Check browser console for localStorage errors
- Verify browser allows localStorage
- Try using Export/Import as backup method

## Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `public` folder with your domain
2. Configure DNS settings with your domain provider
3. Follow GitHub's custom domain documentation

## Support

For issues or questions about deployment:
- Check GitHub Pages documentation
- Review React deployment guide
- Verify all paths are relative in your code
