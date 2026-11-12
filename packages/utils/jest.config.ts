// CommonJS export: this package's package.json sets "type": "commonjs", so Node won't load `export default` here.
module.exports = {
  displayName: 'utils',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/utils',
  reporters: [
     'default',
     [
       'jest-junit',
       {
         outputDirectory: '<rootDir>/../../test-results',
         outputName: 'junit-utils.xml',
       },
     ],
   ],
};
