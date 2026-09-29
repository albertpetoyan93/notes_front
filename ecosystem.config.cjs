module.exports = {
  apps: [
    {
      name: "notes-frontend",
      script: "npm",
      args: "run preview",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
