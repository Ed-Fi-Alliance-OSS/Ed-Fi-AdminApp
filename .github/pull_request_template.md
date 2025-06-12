## Description

<!-- Please include a summary of the changes and the related Jira ticket -->

## Regular PR Instructions

1. Add a semantic prefix to the PR title. These are listed in the [README](README.md##naming-pull-requests-prs-and-the-semantic-workflow)
   - The most common are `feature`, `fix`, `refactor`, `build`, and `chore`
2. If a relevant Jira ticket exists, add it to the PR title, either after the prefix or at the end.
   - Example titles would be `feature: TICKET-123 add a nav item` or `feature: add a nav item (TICKET-123)`
3. When merging PRs into `develop`, always click `Squash and merge`.

## Release PR Instructions

1. Name the PR `chore: cut release`
2. When merging a release PR, **always** click `Create a merge commit`
   1. This ensures that each commit gets individually added to the git history
