# DevOps plans and tracking

This folder holds the planning and tracking documents for DevOps work on the Admin App CI/CD pipeline. One directory per Jira ticket, named after the ticket key.

| Directory | Scope |
| --- | --- |
| `DEVOPS-156/` | CI/CD review of this repository (epic DEVOPS-154): short-term items agreed with the developers, and the implementation plan that groups them into tickets. |

Inside a ticket directory:

- `short-term-items.md` (or the horizon under review): the item list with the verdict, priority and notes from the developer sessions.
- `implementation-plan.md`: the tickets proposed from those items, with a tracking table (Jira key, status, PRs) and the steps, verification and roll-back of each one.
- `jira-tickets-draft.md`: the ticket texts (context, evidence commands, fix steps, acceptance criteria) as they will be published to Jira, kept as a draft until reviewed.

Keep the tracking table current as pull requests open and merge. Add a line to the change log at the end of the plan when the grouping or the scope changes.

The long-form review documents (workflow review, executive brief, Dockerfile review, workflow-structure review) live in the workspace docs folder outside this repository and are not committed here. The findings and proposal, with the S/M/L catalogue and the ticket status, are published in Confluence: https://edfi.atlassian.net/wiki/spaces/OTD/pages/2964062209/Ed-Fi-AdminApp+CI+CD+Review+Findings+and+Proposal
