const nxPreset = require('@nx/jest/preset').default;

module.exports = { globalSetup: '../../jest-global-setup.js', ...nxPreset };
