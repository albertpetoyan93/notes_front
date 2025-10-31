# Setup Guide - Notes Application

Follow these steps to get your notes application up and running.

## Step 1: Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

## Step 2: Setup MySQL Database

1. Make sure MySQL is installed and running
2. Create a new database:

```sql
CREATE DATABASE notes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Step 3: Configure Environment Variables

Create `server/env/development.env`:

```env
NODE_ENV=development
PORT=5000

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=notes_db
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Cookie Configuration
COOKIE_SECRET=your_super_secret_cookie_key_change_this
```

**Important:** Change the secret keys to your own random strings!

## Step 4: Initialize Database Tables

The application will automatically create tables on first run, or you can use Sequelize migrations:

```bash
cd server
npm run migrate
```

## Step 5: Start the Application

### Development Mode

Open two terminal windows:

**Terminal 1 - Backend:**

```bash
cd server
npm run dev
```

Backend will start on `http://localhost:5000`

**Terminal 2 - Frontend:**

```bash
npm run dev
```

Frontend will start on `http://localhost:5173`

### Production Mode

```bash
# Build frontend
npm run build

# Build backend
cd server
npm run build

# Start server
npm start
```

## Step 6: Create Your First User

1. Open `http://localhost:5173` in your browser
2. Click "Register" or navigate to `/auth/register`
3. Fill in:
   - Username
   - Email
   - Password
   - Full Name (optional)
4. Click "Register"
5. You'll be automatically logged in

## Step 7: Start Creating Notes!

1. Click "New Note" button
2. Fill in:
   - Title
   - Category (Note, Password, Login, Command, Other)
   - Content
   - Tags (optional)
   - Mark as favorite (optional)
3. Click "Create"

## Troubleshooting

### Database Connection Error

**Problem:** `SequelizeConnectionError: Access denied for user`

**Solution:**

- Check your MySQL username and password in `development.env`
- Make sure MySQL server is running
- Verify the database exists: `SHOW DATABASES;`

### Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use :::5000`

**Solution:**

- Change the PORT in `server/env/development.env` to another port (e.g., 5001)
- Or kill the process using that port

### Module Not Found Errors

**Problem:** `Cannot find module 'X'`

**Solution:**

```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install

# Same for server
cd server
rm -rf node_modules
npm install
```

### CORS Errors

**Problem:** `Access to XMLHttpRequest has been blocked by CORS policy`

**Solution:**

- Make sure backend is running on port 5000
- Check `src/configs/axios.ts` baseURL matches your backend URL

## Default Configuration

- **Frontend Port:** 5173 (Vite default)
- **Backend Port:** 5000
- **Database:** MySQL on port 3306
- **API Base URL:** `http://localhost:5000/api`

## Verification Checklist

- [ ] MySQL is installed and running
- [ ] Database `notes_db` is created
- [ ] Environment variables are set in `server/env/development.env`
- [ ] Backend dependencies installed (`server/node_modules` exists)
- [ ] Frontend dependencies installed (`node_modules` exists)
- [ ] Backend server is running (check `http://localhost:5000/api`)
- [ ] Frontend app is running (check `http://localhost:5173`)
- [ ] Can register a new user
- [ ] Can login
- [ ] Can create a note

## Useful Commands

```bash
# Check if MySQL is running
mysql -u root -p

# View all databases
SHOW DATABASES;

# Use notes database
USE notes_db;

# View tables
SHOW TABLES;

# View users
SELECT * FROM users;

# View notes
SELECT * FROM notes;
```

## Need Help?

Check the main README.md for more information or open an issue on GitHub.

Happy note-taking! 📝
