import { createAllComponentFiles } from './createAllComponentFiles.mjs';
import { createIndexFile } from './createIndexFile.mjs';
import { createStorybookConstantsFile } from './createStorybookConstantsFile.mjs';

const iconGroups = createAllComponentFiles();
createIndexFile();
createStorybookConstantsFile(iconGroups);
