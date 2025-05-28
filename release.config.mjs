/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        // Defaults: https://github.com/semantic-release/commit-analyzer/blob/master/lib/default-release-rules.js
        releaseRules: [
          { type: 'feature', release: 'minor' },
          { type: 'refactor', release: 'patch' },
          { type: 'performance', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'style', release: 'patch' },
          { type: 'revert', release: 'patch' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            // What commit types show up in the changelog file
            { type: 'feature', section: 'Features' },
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'performance', section: 'Performance Improvements' },
            { type: 'perf', section: 'Performance Improvements' },
            { type: 'revert', section: 'Reverts' },
            { type: 'docs', section: 'Documentation' },
            { type: 'style', section: 'Styles' },
            { type: 'chore', section: 'Miscellaneous Chores', hidden: true },
            { type: 'refactor', section: 'Code Refactoring' },
            { type: 'test', section: 'Tests' },
            { type: 'build', section: 'Build System' },
            { type: 'ci', section: 'Continuous Integration' },
          ],
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogTitle: '# Changelog',
      },
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
};
