# Notes Application# React + TypeScript + Vite

A modern, full-stack personal notes management application. Keep track of your notes, passwords, login credentials, commands, and other important information in one secure place.This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## FeaturesCurrently, two official plugins are available:

- 📝 **Multiple Note Categories**: Notes, Passwords, Logins, Commands, Other- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh

- ⭐ **Favorites**: Mark important notes- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

- 🔍 **Search & Filter**: Find notes quickly

- 🏷️ **Tags**: Organize with custom tags## Expanding the ESLint configuration

- 🔐 **Authentication**: Secure login/registration

- 🎨 **Modern UI**: Built with Ant DesignIf you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- 📱 **Responsive**: Works on all devices

- Configure the top-level `parserOptions` property like this:

## Tech Stack

```js

**Frontend:** React 18, TypeScript, Vite, Ant Design, Zustand, React Routerexport default tseslint.config({

  languageOptions: {

**Backend:** Node.js, Express, TypeScript, Sequelize, MySQL, JWT, bcrypt    // other options...

    parserOptions: {

## Quick Start      project: ['./tsconfig.node.json', './tsconfig.app.json'],

      tsconfigRootDir: import.meta.dirname,

### Prerequisites    },

- Node.js v16+  },

- MySQL database})

```

### Installation

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`

```bash- Optionally add `...tseslint.configs.stylisticTypeChecked`

# Install frontend dependencies- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

npm install

```js

# Install backend dependencies// eslint.config.js

cd server && npm install && cd ..import react from 'eslint-plugin-react'

```

export default tseslint.config({

### Configuration // Set the react version

settings: { react: { version: '18.3' } },

Create `server/env/development.env`: plugins: {

````env // Add the react plugin

NODE_ENV=development    react,

PORT=5000  },

DB_HOST=localhost  rules: {

DB_USER=your_db_user    // other rules...

DB_PASSWORD=your_db_password    // Enable its recommended rules

DB_NAME=notes_db    ...react.configs.recommended.rules,

DB_PORT=3306    ...react.configs['jsx-runtime'].rules,

JWT_SECRET=your_jwt_secret  },

JWT_EXPIRE=7d})

COOKIE_SECRET=your_cookie_secret```

````

Create database:

```sql
CREATE DATABASE notes_db;
```

### Run

```bash
# Terminal 1: Start backend
cd server && npm run dev

# Terminal 2: Start frontend
npm run dev
```

Open `http://localhost:5173`

## API Endpoints

**Auth:** `/api/auth/register`, `/api/auth/login`, `/api/auth/me`

**Notes:** `/api/notes` (GET, POST), `/api/notes/:id` (GET, PUT, DELETE), `/api/notes/stats`

## License

MIT
