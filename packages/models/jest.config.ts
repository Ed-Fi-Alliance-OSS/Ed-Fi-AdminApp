// CommonJS export: this package's package.json sets "type": "commonjs", so Node won't load `export default` here.
module.exports = {
  displayName: 'models',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  setupFiles: ['./jest.setup.js'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/models',
  reporters: [
     'default',
     [
       'jest-junit',
       {
         outputDirectory: '<rootDir>/../../test-results',
         outputName: 'junit-models.xml',
       },
     ],
   ],
};
