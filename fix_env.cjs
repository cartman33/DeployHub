const fs = require('fs');

let viteConfig = fs.readFileSync('vite.config.js', 'utf8');
viteConfig = viteConfig.replace("env.VITE_API_BASE_URL || 'http://localhost:8080'", "env.VITE_API_PROXY_TARGET || 'http://localhost:8080'");
fs.writeFileSync('vite.config.js', viteConfig);

fs.writeFileSync('.env', 'VITE_API_PROXY_TARGET=http://223.130.132.72:8080\n');
