// Ensure node-config finds the API config directory and loads testing.js overrides
process.env.NODE_CONFIG_DIR = require('path').resolve(__dirname, 'config');
process.env.NODE_ENV = 'testing';
