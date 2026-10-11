// pm2 process file for the astrikos.xyz server.  Usage (from repo root, after building app/dist):
//   pm2 start ecosystem.config.cjs && pm2 save
//
// Frontend: when `script` is the literal name 'serve', pm2 launches its BUILT-IN static file server and
// configures it through the PM2_SERVE_* env vars below (so `args` would be ignored). This needs only pm2 itself.
// Because it is the same port and the same dist/, it is interchangeable with the guide's form:
//   cd app && pm2 start serve --name "techm-construction_3333" -- ./dist -s -p 3333     (uses global `serve`)
// Use ONE of the two forms, not both (same pm2 name / port).
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'techm-construction_3333', // <poc>_<fport>
      script: 'serve',
      cwd: path.join(__dirname, 'app'),
      env: {
        PM2_SERVE_PATH: path.join(__dirname, 'app', 'dist'),
        PM2_SERVE_PORT: 3333,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html',
      },
    },
    {
      name: 'techm-construction_be_4333', // <poc>_be_<bport>
      script: 'index.js',
      cwd: path.join(__dirname, 'server'),
      env: { PORT: 4333, NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
