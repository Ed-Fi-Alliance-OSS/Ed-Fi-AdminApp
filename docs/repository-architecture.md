# Repository Architecture

This document provides an overview of the structure and organization of the repository.

## Root Directory

- **babel.config.json, tsconfig.base.json, eslint.config.mjs, jest.config.ts, etc.**: Project-wide configuration files for build, linting, and testing.
- **docker-compose.yml, Dockerfile, Dockerrun.aws.template.json**: Docker and deployment configuration files.
- **nx.json, package.json**: Monorepo and package management configuration (Nx, npm).
- **README.md**: Project overview and instructions.

## Main Folders

### `cloudformation/`

Infrastructure-as-code templates for AWS resources and deployment. Contains:

- **lambdas/**: Lambda layer zips and related artifacts.
- **templates/**: CloudFormation YAML templates for various AWS services (WAF, RDS, S3, Lambda, etc.).

### `docs/`

Project documentation, including architecture diagrams, TODOs, and technical notes.

### `e2e/`

End-to-end test resources:

- **docker-compose.yml**: E2E test environment setup.
- **test-populate.sql**: Test data for database.
- **ssl/**: SSL certificates for testing.
- **templates/**: Nginx or other service configuration templates.

### `packages/`

Monorepo packages, each with its own configuration and source code:

- **api/**: Backend API (NestJS), with configs, source, and assets.
- **common-ui/**: Shared UI components.
- **fe/**: Frontend application (likely React or similar), with Vite config.
- **models/**: Shared data models.
- **models-server/**: Server-side logic for models.
- **utils/**: Utility functions and helpers.

### `scripts/`

Utility scripts for development and build automation.

### `types/`

Global TypeScript type definitions.

## Additional Notes

- The repository uses Nx for monorepo management.
- Each package is independently testable and buildable.
- CI/CD and deployment are managed via configuration files and scripts at the root and in relevant subfolders.

---

For more details on each package or configuration, refer to the respective README files or documentation within each folder.
