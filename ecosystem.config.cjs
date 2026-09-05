module.exports = {
  apps: [
    {
      name: "poosefilm-web",
      script: "npm",
      args: "run start",
      env: { NODE_ENV: "production" },
    },
    {
      name: "poosefilm-filter-worker",
      script: "npm",
      args: "run worker",
      env: { NODE_ENV: "production" },
    },
  ],
};
