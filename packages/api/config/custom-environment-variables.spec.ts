const customEnvironmentVariables = require('./custom-environment-variables.js');

describe('custom-environment-variables.js', () => {
  it('maps SESSION_SECRET_VALUE using the __name/__format keys config v5 requires', () => {
    // The plain `name`/`format` keys look plausible but are silently ignored by
    // config v5 (node_modules/config/lib/util.js expects __name/__format), which
    // breaks JSON parsing of the matching environment variable - this bit
    // SESSION_SECRET_VALUE in AC-637.
    expect(customEnvironmentVariables.SESSION_SECRET_VALUE).toEqual({
      __name: 'SESSION_SECRET_VALUE',
      __format: 'json',
    });
  });
});
