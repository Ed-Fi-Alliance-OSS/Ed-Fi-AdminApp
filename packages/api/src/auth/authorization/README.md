# Authorization

Each action in the app is gated behind one or more privileges applied to one or more resources. The app has several mechanisms for applying privileges:

- User's global role in the app. Typical users have a no global privileges beyond reading their own profile.
- User's roles in one or more app teams. Typical users will be members of one team.
- Role applied to team's ownership of an environment, ODS, or ed-org.

There are three levels of authorization context in the app:

- Global: does the user have a sufficient global role?
- Team: does the user have a sufficient global role _or_ team role?
- Team&ndash;environment: does the user have a sufficient global or team role, _and_ does the team have a sufficient ownership role?

Ownership of a whole environment carries with it ownership of each ODS and ed-org within that environment. However, ownership of just an ODS or ed-org also carries privileges _up_ the hierarchy for the purpose of wayfinding. In practice all this means is that if you own and ODS then you can also see the name of the environment it's part of.

## Team ownership cache

Because of the way that permissions bleed both up and down the resource hierarchy from the actual owned item, derivation of the full permission set for a given resource involves tracing the graph all over the place and is quite expensive. In fact, deriving it for one resource basically involves deriving it for all resources. So that's what we do, and then we cache the result.

The cached item for a given privilege can be one of two things:

- A set of IDs, which means the privilege is granted for only the resources whose IDs are present there.
- A boolean `true` value, which means not that there are _no_ restrictions, but rather that it's the business logic's responsibility to implement them. More on this later, but for now suffice it to say it's used for basically two things:
  - When a team really does have access to "all" items within some general scope such as an EdfiTenant
  - When the operation involves some kind of business-logic-specific validation that it wouldn't make sense to even attempt to cache, such as payload validation on POST routes.

```js
cache = {
  // team-level resources
  'team.ownership:read': true,
  'team.role:read': true,
  'team.user:read': true,
  'team.user-team-membership:read': true,
  'team.sb-environment.edfi-tenant:read': new Set([1, 2]),

  // EdfiTenant-level resources are an object keyed by edfiTenantId
  'team.sb-environment.edfi-tenant.ods:read': {
    1: true,
    2: new Set([7, 8]),
  },
  // Application caches actually get educationorganizationids rather than Application ids. This allows us to avoid querying the Admin API when building the cache, because we can get those from Edorgs.
  'team.sb-environment.edfi-tenant.ods.edorg.application:read': {
    1: true,
    2: new Set([4, 5, 6]),
  },
};
```

In the case of the first kind of usage of the `[privilege]: true` result (two kinds listed above the code block), it's used purely for convenience. For instance, Applications are naturally retrieved by `edfiTenantId` anyway. If that's all the filtering we have to do then we might as well not cache a bunch of individual IDs. In general this case will almost always be one of two basic `where` clauses:

- `where edfiTenantId = :edfiTenantId`, or
- `where teamId = :teamId`.

On the other hand, the second kind of usage of the `true` result is not for logic that's simple, so much as it's for logic that is too tangled up in business behavior to reasonably be owned by the authorization service. You might have several relational IDs in a single POST payload, all of which need to be validated against the team's ownerships. The controller or service will likely refer to the cache for those related resources, but in principle the logic could be arbitrary. The cache for the creation action would just be `true`, but that doesn't mean there are no restrictions.

### Ownership cache technical notes

Memory size:

- There are about 1,200 LEAs in Texas, and 11,000 Schools. We don't plan to load any Edorgs below the level of School, so call it 12,200 in total... actually just call it 10k.
- A `Set` of 10,000 numbers in JavaScript is about 280 kB.
- Say there are six copies of the 10,000 IDs, five for Application privileges and one for `edorg:read`. That would be about 1.7 MB of memory. Not a disaster.
- In conclusion, memory size doesn't seem like a major concern.

Upon receipt of a request by a team whose cache is not already loaded, we need to load the cache. Once that load has started, we don't want to re-start it if another request for that team comes in before it's done. This necessitates statefulness. The current solution is to use an in-memory JavaScript cache which supports promises. This is significantly nicer to use than one which necessitates polling, but has the downside of not really supporting multi-instance deployments. So far we haven't scaled horizontally and haven't needed to address it.

The least-performant part of the whole thing at the moment is the way in which the front end requests the user's cache in order to get the info needed for its own authorization logic. Each privilege is requested separately. This is a refactor waiting to happen but just hasn't made it to #1 on the JIRA board yet. Maybe the global privileges are one request and then each team&ndash;environment is another.

## User session cache

Users inherit their SB resource access from the teams they're members of, with privileges possibly narrowed further by their own team user role. The team ownerships are only cached once for each team, but that means each user must have their own unique privileges cached separately &mdash; with the two caches being combined to yield the true final authorization grant for the user. The user cache doesn't involve any of the complicated graph-tracing or privilege derivation that's necessary for the team ownership cache; rather, it just holds a basic map of tenant IDs to the user's tenant privileges.

## Using the caches

The reason all the main routes are team-specific is to make authorization easier. When a team request comes in, we build out the user's privilege cache like this:

```ts
// pseudocode

userCache = intersection(userPrivilegesCache, teamPrivilegesCache);
```

And their CASL abilities like this:

```ts
define.can('read', 'team.sb-environment.edfi-tenant.vendor', {
  teamId: '<id>',
  edfiTenantId: '<id>',
  id: {
    $in: [
      '__filtered__', // special keyword used later
      /* ...values from userCache */
    ],
  },
});
```

Each route has an authorization request configured like this:

```ts
@Get('teams/:teamId/edfi-tenants/:edfiTenantId/vendors/:vendorId')
@Authorize({
  privilege: Privilege['team.sb-environment.edfi-tenant.vendor:read'], // enum of known privileges
  subject: {
    teamId: 'teamId', // These strings are NestJS path parameter names
    edfiTenantId:'edfiTenantId',
    id: 'vendorId',
  }
})
handler(
  // params...
) {
  // logic...
}
```

Or, for GET-all routes, like this:

```ts
@Get('teams/:teamId/edfi-tenants/:edfiTenantId/vendors')
@Authorize({
  privilege: Privilege['team.sb-environment.edfi-tenant.vendor:read'],
  subject: {
    teamId: 'teamId',
    edfiTenantId:'edfiTenantId',
    id: '__filtered__', // Tell CASL that the controller will take care of this attribute
  }
})
handler(
  @InjectFilter(Privilege['team.sb-environment.edfi-tenant.vendor:read']) vendorIds: number[] | true, // Then filter using this array
  // params...
) {
  // logic...
}
```

The `Authorize` and `Injectfilter` implementations aren't shown here, but this is the concept:

- `Authorize`: Uses the `subject` config to construct an object with the right attribute values from the current URL path parameters, and uses that plus the `privilege` config to construct and execute a complete CASL request including action and subject.
- `InjectFilter`: Uses its privilege parameter to look up the appropriate values in the cache and inject them into the handler for use there. It returns an empty array if the privilege isn't present for the user, but the request will be denied by the `Authorize`-configured guard before the handler would use that empty array anyway.

One of the major things to notice is that CASL isn't being given the _real_ entities, as would usually be the case. Instead, it's being given only the authorization-related attributes, and in a format which may or may not really be available in the underlying data model. For example, a Vendor from the Admin API has no such thing as an `edfiTenantId` attribute. The information does exist (in that a Vendor is owned by an EdfiTenant), but _not like that_. So anyway, the attributes in the `subject` parameter are a mixture of real relational data model attributes, and synthetic ones created by our business logic.

A wholly different alternative way of implementing authorization would be to retrieve the requested resources from a service, augment the actual return values with the necessary authorization-related attributes discussed above, and then pass the result to CASL for it to be either denied or filtered as appropriate. The problem with that approach is that it would be gratuitously inefficient in certain situations. For example, suppose the entire state of Texas has a single EdfiTenant, and each of the thousand districts has their own ODS. That single ODS is all a district is granted ownership of, but this app's routing tree only goes as far as EdfiTenant. So each tenant will send requests such as `GET /edfi-tenants/:edfiTenantId/edorgs`. If filtering were done _after_ retrieval, we'd be querying an extra 10,000 records. There's no particular reason to do that, because it's perfectly easy to set up the filtering on the way _in_, as described above.

## Creating CASL abilities

We use the cache to create CASL abilities for all the things a user can do. Some of these things come from their global privileges, and some are team-scoped. The team-scoped abilities are defined by referencing the team ownerships cache. The key contribution of the logic that deals specifically with tenant-scoped privileges is that it defines conditions on the CASL _subject_, in the sense of attribute-based access control. For example, the _subject_ will at a minimum be defined with a `tenantId`, and will often also have an `edfiTenantId`:

```ts
{
  teamId: '<team ID>',
  edfiTenantId: '<EdfiTenant ID>',
}
```

If the ID values cache for a given resource is a `Set` (rather than the `true` value), then the _subject_ gets an "in" operator with that list. Also included in the "in" list is the special `__filtered__` value. If the cache is just a `true` value, then there's no additional attribute beyond what's shown above.

```ts
{
  teamId: '<team ID>',
  edfiTenantId: '<EdfiTenant ID>',
  id: {
    $in: [1, 2, '__filtered__'],
  },
}
```

The `__filtered__` option is necessitated by the way CASL works and how we use it. In particular, for `GET all` requests we check CASL once, at the route level, and all we want to know is "do they have the privilege to get _some_ row here". The filtering for _which_ rows is handled outside CASL. We also use the `__filtered__` option for the `GET one` application route, because although we do have the `applicationId` from the route path parameter, we actually cache the `edorgId` instead, and we don't know _that_ value until we get the application back from the Admin API. So that particular single-item route functions like a many-item route.

## Other implementation details

One thing to note about the cache is that even if there aren't any entities for a user to access, we still want the relevant cache item to be present (but empty of course) if they have the relevant privilege. This ensures that they can hit the API route and see the UI page, even if the result is empty data.
