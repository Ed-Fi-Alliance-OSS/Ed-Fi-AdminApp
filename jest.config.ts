import { getJestProjects } from '@nx/jest';

export default {
  globalSetup: './jest-global-setup.js',
  projects: getJestProjects(),
};
