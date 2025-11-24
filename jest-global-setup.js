// eslint-disable-next-line @typescript-eslint/no-unused-vars
module.exports = async function (globalConfig, projectConfig) {
  /* edfi docker setup can only easily be run with mandatory
  tls, but we want to be able to use self-signed certs for
  testing. This is done here because Jest proxys process.env
  and the line below won't work if it's at e.g. the top of a
  .spec.ts file. */
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
};
