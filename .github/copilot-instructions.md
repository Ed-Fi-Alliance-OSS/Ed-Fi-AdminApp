# Admin App - GitHub Copilot Instructions

## Overview

The Admin App is a centralized management system for Ed-Fi Technology Suite deployments. It provides a unified interface for managing multiple Ed-Fi API instances across on-premises, cloud, or Starting Blocks environments.

## Architecture

- **Frontend**: React 18.3.1 with TypeScript, Chakra UI, and Vite
- **Backend**: NestJS with TypeScript, TypeORM, and Express
- **Database**: PostgreSQL (primary) with optional MSSQL support
- **Monorepo**: Nx workspace with multiple packages
- **Testing**: Jest for unit tests, Cypress for E2E
- **Authentication**: OpenID Connect (OIDC) with configurable identity providers
- **Cloud**: AWS services integration (Lambda, Secrets Manager)

## Project Structure

```
packages/
├── api/           # NestJS backend application
├── fe/            # React frontend application
├── common-ui/     # Shared UI components with Storybook
├── models/        # Shared TypeScript models/types
├── models-server/ # Server-side specific models
└── utils/         # Shared utilities
```

## Key Technologies & Dependencies

### Frontend Stack

- **React 18.3.1** with TypeScript 5.9.3
- **Chakra UI 2.8.2** for component library
- **Vite 5.4.20** for build tooling
- **TanStack Query 5.90.5** for data fetching
- **React Router DOM 6.14.0** for routing
- **React Hook Form 7.65.0** for form management
- **Jotai 2.15.0** for state management

### Backend Stack

- **NestJS 10.4.19** framework
- **TypeORM 0.3.27** for database ORM
- **PostgreSQL** as primary database
- **Express Session** for session management
- **Passport** for authentication
- **AWS SDK** for cloud integration

### Development Tools

- **Nx 19.8.12** for monorepo management
- **ESLint 8.57.0** with TypeScript support
- **Prettier 2.6.2** for code formatting
- **Jest 29.4.1** for testing
- **Storybook 8.6.14** for component development

### Key Commands

- `npm run build:fe` - Build frontend
- `npm run build:api` - Build API
- `npm run migrations:generate -- MigrationName` - Generate database migration
- `npm run migrations:run` - Run pending migrations
- `npm run test:api` - Run API tests
- `npm run test:fe` - Run frontend tests
- `npm run lint:check` - Check linting
- `npm run storybook` - Start Storybook

## Development Guidelines

### Code Organization

- **Monorepo**: Use Nx workspace structure with clear package boundaries
- **Shared Code**: Common utilities in `utils/`, UI components in `common-ui/`
- **Models**: Separate client (`models/`) and server (`models-server/`) models
- **TypeScript**: Strict typing throughout the codebase

### Database Management

- **Migrations**: Always generate migrations for schema changes
- **TypeORM**: Use decorators and entities for database modeling
- **Multiple DBs**: Support for both PostgreSQL and MSSQL

### Authentication & Security

- **OIDC Integration**: Configurable identity providers
- **Session Management**: Express sessions with database storage
- **Machine Users**: Support for M2M authentication via Auth0
- **Encryption**: Sensitive data encrypted at rest

### AWS Integration

- Never modify AWS files in the `cloudformation` directory

### Testing Strategy

- **Unit Tests**: Jest for both frontend and backend
- **E2E Tests**: Cypress for integration testing
- **Storybook**: Component testing and documentation
- **Test Coverage**: Maintain good coverage across packages

### Code Quality

- **ESLint**: Enforce coding standards with TypeScript rules
- **Prettier**: Consistent code formatting
- **Semantic Release**: Automated versioning based on commit messages
- **PR Guidelines**: Use semantic commit messages (feat:, fix:, docs:, etc.)

## Common Development Tasks

### Adding New Features

1. **Plan**: Break down into smaller concepts
2. **Models**: Define TypeScript interfaces in appropriate packages
3. **Database**: Create migrations if schema changes needed
4. **Backend**: Implement NestJS controllers, services, DTOs
5. **Frontend**: Create React components, hooks, and pages
6. **Tests**: Add unit and integration tests
7. **Documentation**: Update relevant docs

### Working with Database

```bash
# Generate migration
npm run migrations:generate -- AddNewFeature

# Run migrations
npm run migrations:run

# Revert last migration
npm run migrations:revert
```

### Component Development

```bash
# Start Storybook
npm run storybook

# Build Storybook
npm run build-storybook:common-ui
```

## Contributing

### Commit Message Format

Use semantic commit messages for automated versioning:

- `feature:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `docs:` - Documentation updates (no version bump)
- `refactor:` - Code improvements (patch version bump)
- `test:` - Test updates (no version bump)
- `chore:` - Maintenance tasks (no version bump)

### Pull Request Process

1. Create feature branch from `develop`
2. Use semantic commit messages
3. Include unit tests for new functionality
4. Update documentation as needed
5. Ensure all checks pass
