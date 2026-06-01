# Setup Guide â€” Step by Step

This walks you through everything from installing tools to a live URL. Estimated time: 30-45 minutes the first time.

## Step 1: Install the tools you need

You'll need three things on your computer:

### Node.js
Go to https://nodejs.org and download the LTS version. Run the installer with default settings.

To verify, open a terminal (Terminal on Mac, Command Prompt on Windows) and type:
```
node --version
```
You should see something like `v20.10.0`.

### Git
**Mac:** Open Terminal and type `git --version`. If it asks to install developer tools, say yes.

**Windows:** Download from https://git-scm.com/download/win and run the installer with default settings.

### A code editor (optional but recommended)
Download VS Code from https://code.visualstudio.com. This makes editing files much easier than a plain text editor.

## Step 2: Get the project files onto your computer

1. Download the `eiq-pmo-dashboard` folder I built (it should be available as a download in your chat)
2. Move it somewhere easy to find, like your Documents folder
3. Open Terminal/Command Prompt and navigate to it:
```
cd ~/Documents/eiq-pmo-dashboard
```
(On Windows: `cd C:\Users\YourName\Documents\eiq-pmo-dashboard`)

## Step 3: Test it locally first

Before pushing to GitHub, make sure it works:
```
npm install
npm run dev
```

The first command downloads the libraries it needs (takes a minute or two). The second starts a local server. You'll see a message like:
```
âžœ  Local:   http://localhost:5173/
```

Open that URL in your browser. You should see the full dashboard. Press `Ctrl+C` in the terminal to stop it when you're done.

## Step 4: Create the GitHub repository

1. Go to https://github.com and log in
2. Click the green "New" button (or the `+` icon in the top right, then "New repository")
3. Repository name: `eiq-pmo-dashboard` (this exact name matters â€” it's what shows up in your URL)
4. Description: "Interactive PMO dashboard for ENFRA Solutions"
5. Set it to **Public** (required for free GitHub Pages) or **Private** if you have a paid plan
6. **Do NOT** check "Add a README" â€” your project already has one
7. Click "Create repository"

GitHub will show you a page with setup commands. Keep this tab open.

## Step 5: Connect your local folder to GitHub

In your terminal (still in the eiq-pmo-dashboard folder), run these commands one at a time. Replace `YOUR-USERNAME` with your actual GitHub username.

First time using Git? Configure it with your info:
```
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Then initialize and push:
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/eiq-pmo-dashboard.git
git push -u origin main
```

The first time you push, GitHub will ask you to log in. On modern Git, this opens a browser window â€” sign in with your GitHub account.

## Step 6: Update the base path

Open `vite.config.js` in your editor. If your repo name is different from `eiq-pmo-dashboard`, change the `base` line to match. For example:
```js
base: '/your-repo-name/',
```

If you kept the name `eiq-pmo-dashboard`, you don't need to change anything.

Save the file, then push the change:
```
git add vite.config.js
git commit -m "Update base path"
git push
```

## Step 7: Turn on GitHub Pages

1. On your GitHub repo page, click "Settings" (top right of the repo nav bar)
2. In the left sidebar, click "Pages"
3. Under "Build and deployment" â†’ "Source", select **GitHub Actions**
4. That's it â€” no other settings needed

## Step 8: Watch it deploy

1. Click the "Actions" tab at the top of your repo
2. You should see a workflow running called "Deploy to GitHub Pages"
3. Wait for it to finish (usually 1-2 minutes â€” green checkmark when done)
4. Your dashboard is now live at:
```
https://YOUR-USERNAME.github.io/eiq-pmo-dashboard/
```

If anything goes wrong, click the workflow run to see the error message. The most common issue is a typo in the base path in `vite.config.js`.

## Step 9: Making updates later

Anytime you want to update the dashboard:

1. Edit files in your local folder
2. In terminal, in the project folder:
```
git add .
git commit -m "describe what you changed"
git push
```
3. GitHub Actions automatically rebuilds and redeploys within a minute

## Troubleshooting

**"git: command not found"** â€” Git isn't installed. See Step 1.

**"npm: command not found"** â€” Node.js isn't installed. See Step 1.

**404 page after deploy** â€” The base path in `vite.config.js` doesn't match your repo name. See Step 6.

**Workflow fails with "permission denied"** â€” Go to Settings â†’ Actions â†’ General â†’ Workflow permissions, and select "Read and write permissions".

**Page is blank** â€” Open browser dev tools (F12) and check the Console tab for errors. Often a base path issue.

## When you're ready for Phase 2

Come back and we'll add:
- User authentication so only your team and approved clients can see it
- Live data from the EaaS App API
- Per-client filtering so each client sees only their own projects

