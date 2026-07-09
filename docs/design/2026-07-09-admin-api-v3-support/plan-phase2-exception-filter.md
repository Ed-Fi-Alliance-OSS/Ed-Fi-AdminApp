# Phase 2: V3 Exception Filter

> Part of [`plan.md`](./plan.md). Read that file first for Goal/Architecture/Global Constraints. Depends on [`plan-phase1-dtos.md`](./plan-phase1-dtos.md) being complete (not a hard code dependency, but keeps commit history linear).

**Files:**
- Create: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api-v3-exception.filter.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api-v3-exception.filter.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier phases (this file has no dependency on the V3 DTOs).
- Produces: `AdminApiV3ExceptionFilter` class, decorated `@Catch(AxiosError)`. Phase 4's `AdminApiControllerV3` applies it via `@UseFilters(new AdminApiV3ExceptionFilter())`.

The V1x filter (`../v1/admin-api-v1x-exception.filter.ts`, read in full — see reference content below) always collapses non-403/401/404 errors to a generic 500 `StatusResponse`. The V3 Admin API instead returns RFC 7807 problem-details bodies:

```ts
{ type?: string; title: string; status: number; detail?: string; errors?: Record<string, string[]> }
```

The V3 filter parses this shape directly and **preserves the upstream `status`** for non-auth/404 errors (unlike V1x, which always uses 500), so 400-class validation errors round-trip correctly to the frontend. 401/403 still map to 500 with an authorization-problem title (an SBAA-side misconfiguration, not an end-user error). 404 passes through as 404. Any other/unexpected body shape falls back to a generic 500.

There is no existing spec file for `admin-api-v1x-exception.filter.ts` to mirror stylistically (checked: none exists for any `starting-blocks/v1` or `v2` exception filter), so this task's spec is written fresh using NestJS's standard `ArgumentsHost`/`Response` mocking pattern.

### Task 1: Create `AdminApiV3ExceptionFilter`

- [ ] **Step 1: Write the failing spec**

Create `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api-v3-exception.filter.spec.ts`:

```typescript
import 'reflect-metadata';
import { ArgumentsHost } from '@nestjs/common';
import { AxiosError } from 'axios';
import { AdminApiV3ExceptionFilter } from './admin-api-v3-exception.filter';

describe('AdminApiV3ExceptionFilter', () => {
  let filter: AdminApiV3ExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AdminApiV3ExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  function makeAxiosError(status: number, data: unknown): AxiosError {
    return {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Request failed',
      config: {} as any,
      toJSON: () => ({}),
      response: {
        status,
        statusText: '',
        data,
        headers: {},
        config: {} as any,
      },
    } as unknown as AxiosError;
  }

  it('rethrows when the AxiosError has no response (e.g. network error)', () => {
    const error = { isAxiosError: true, response: undefined } as unknown as AxiosError;
    expect(() => filter.catch(error, host)).toThrow(error as unknown as Error);
  });

  it('maps a 401 to a 500 authorization-problem StatusResponse', () => {
    const error = makeAxiosError(401, { title: 'Unauthorized', status: 401 });
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Problem authorizing against Admin API',
      type: 'Error',
    });
  });

  it('maps a 403 to a 500 authorization-problem StatusResponse', () => {
    const error = makeAxiosError(403, { title: 'Forbidden', status: 403 });
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Problem authorizing against Admin API',
      type: 'Error',
    });
  });

  it('passes through a 404 as a 404 StatusResponse', () => {
    const error = makeAxiosError(404, { title: 'Not Found', status: 404 });
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Not found',
      type: 'Error',
    });
  });

  it('parses an RFC 7807 problem-details body with a validation errors map, preserving the upstream status', () => {
    const problemDetails = {
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      detail: 'Data validation failed',
      errors: {
        Name: ['A vendor with this name already exists.'],
      },
    };
    const error = makeAxiosError(400, problemDetails);
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'One or more validation errors occurred.',
      type: 'Error',
      message: 'Data validation failed',
      data: problemDetails.errors,
    });
  });

  it('parses an RFC 7807 problem-details body with no detail/errors', () => {
    const problemDetails = {
      title: 'Internal Server Error',
      status: 500,
    };
    const error = makeAxiosError(500, problemDetails);
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Internal Server Error',
      type: 'Error',
    });
  });

  it('falls back to a generic 500 for an unexpected non-problem-details body', () => {
    const error = makeAxiosError(502, 'Bad Gateway');
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'We encountered an unexpected error.',
      type: 'Error',
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx nx test api --testFile=admin-api-v3-exception.filter.spec.ts`
Expected: FAIL — `Cannot find module './admin-api-v3-exception.filter'`

- [ ] **Step 3: Implement `AdminApiV3ExceptionFilter`**

Create `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api-v3-exception.filter.ts`:

```typescript
import { StatusResponse } from '@edanalytics/utils';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { AxiosError } from 'axios';
import { Response } from 'express';
import type { AdminApiControllerV3 } from './admin-api.v3.controller';
import type { AdminApiServiceV3 } from './admin-api.v3.service';

/**
 * Problem-details body shape returned by the Admin API V3, per RFC 7807.
 * `errors` is a map of field name to a list of validation messages, present
 * on 400-class validation failures (e.g. from ASP.NET Core model validation).
 */
interface AdminApiV3ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

function isAdminApiV3ProblemDetails(body: unknown): body is AdminApiV3ProblemDetails {
  return (
    typeof body === 'object' &&
    body !== null &&
    'title' in body &&
    typeof (body as { title: unknown }).title === 'string'
  );
}

/**
 * Catch AxiosErrors from Admin API V3 and convert them to StatusResponses.
 *
 * See {@link AdminApiServiceV3 } and {@link AdminApiControllerV3 } for
 * more details, but basically the pattern is that any "original" exceptions
 * (not HttpExceptions from Nest) that make it to this filter can be assumed
 * to have arisen in the route's ultimate Admin API call of interest. Other
 * exceptions (e.g. Admin API login, SBAA form validation, other intermediate
 * Admin API calls) are caught and handled in the service/controller.
 *
 * Unlike {@link AdminApiV1xExceptionFilter}, this filter parses the Admin
 * API V3's RFC 7807 problem-details error shape and preserves the upstream
 * HTTP status for non-auth/404 errors, so 400-class validation errors
 * round-trip correctly to the frontend.
 */
@Catch(AxiosError)
export class AdminApiV3ExceptionFilter implements ExceptionFilter {
  catch(exception: AxiosError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // If it's not a failed Admin API response, we don't do anything here.
    if (!exception.response) throw exception;

    const status = exception.response.status;
    const body = exception.response.data;

    if (status === 403 || status === 401) {
      const result: StatusResponse = {
        title: 'Problem authorizing against Admin API',
        type: 'Error',
      };
      response.status(500).json(result);
      return;
    } else if (status === 404) {
      const result: StatusResponse = {
        title: 'Not found',
        type: 'Error',
      };
      response.status(404).json(result);
      return;
    } else if (isAdminApiV3ProblemDetails(body)) {
      const result: StatusResponse = {
        title: body.title,
        type: 'Error',
        ...(body.detail ? { message: body.detail } : {}),
        ...(body.errors ? { data: body.errors as object } : {}),
      };
      response.status(status).json(result);
      return;
    }
    const result: StatusResponse = {
      title: 'We encountered an unexpected error.',
      type: 'Error',
    };
    response.status(500).json(result);
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx nx test api --testFile=admin-api-v3-exception.filter.spec.ts`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api-v3-exception.filter.ts packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api-v3-exception.filter.spec.ts
git commit -m "feat: add Admin API V3 exception filter"
```

Next: [`plan-phase3-service.md`](./plan-phase3-service.md)
