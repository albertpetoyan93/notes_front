module.exports = {
  apps: [
    {
      name: 'hyeid-admin',
      script: 'npm',
      args: 'run preview',
      env: {
        PORT: 3001
      }
    }
  ]
};
