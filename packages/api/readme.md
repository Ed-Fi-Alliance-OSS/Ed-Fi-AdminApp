# API Package

One of the more brittle pieces of this is the `@nestjs/swagger` setup. A couple things to call out:

- It provides a CLI plugin which is configured in the `Nx` build settings and scans the project for DTO schemas. Importantly, it looks for filenames with `.dto` in them. So if you create a DTO class in a file otherwise named, it'll be blank in the Open API spec.
- It relies on metadata set by the `@Param` decorators when constructing Open API path parameters. For this reason each controller method includes parameters for each path segment variable even if they are logically unused by that method. There ought to be a way to configure this in the `RouterModule` but we haven't found it.
