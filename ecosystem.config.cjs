module.exports = {
  apps: [
    {
      name: process.env.APP_NAME || "app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: process.env.DEPLOY_PATH || __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 80,
      },
      watch: false,
      max_memory_restart: "2G",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      exp_backoff_restart_delay: 500,
      max_restarts: 15,
      min_uptime: "30s",
      kill_timeout: 5000,
      autorestart: true,
    },
  ],
};
