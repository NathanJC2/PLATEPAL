# APDEV-MCO

- Quick Setup Guide for PlatePal
  Prerequisites
  - Node.js (v14+)
  - MongoDB (local or Atlas)
  
- Setup Steps
  1. Navigate to project folder: cd "CCAPDEV-PHASE2-GROUP6"
  2. Install dependencies: npm install
  3. Start MongoDB service (local): net start MongoDB
  4. Seed database (optional): node seed.js
  5. Run application: node app.js

- Access
  Open browser to: http://localhost:3000
  
- Sample Accounts (Usernames/Password)
  chelsea / 1234
  alex / 1234
  jamie / 1234
  mika / 1234
  ryan / 1234
  
- Notes
  Uses MongoDB at mongodb://127.0.0.1:27017/PlatePalDB
  Port: 3000
  For MongoDB Atlas, update connection string in app.js
