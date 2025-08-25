# Design: Making Yopass Integration Optional

## Overview

Yopass is a core integration in v4 Admin system for safely sending an ODS API key and secret. In previous versions of the application, keys and secrets were displayed directly to the user, albeit temporarily. We aim to restore this way of handling key and secret delivery, if desired, to eliminate the dependency on another integration and service in the system.

## Implementation

Changing the Yopass integration to be configurable requires introducing the configuration, updating the API to return a different response based on this configuration, and updating the UI to reflect the contents of the response (plus all the code in between).

### Configuration

Introduce a configuration flag for whether Yopass should be used to transmit secret values:

- Add a boolean flag `USE_YOPASS` to `IConfig`
  - Update for environment files - default to true
- Update `checkEnv.ts` to only check for `YOPASS_URL` when the new flag is `true`

### Response Model

TypeScript's union types are a good fit for representing the valid possibilities of the response containing a Yopass link or the key/secret directly. Since there are two versions of the Response per Admin API there will be two new union types.

Create two new union types (one per AdminAPI version) which are an "OR" union between:

- A Yopass Link & ID (the current implementation)
  - ie `ApplicationYopassResponseDto`
- An Ed-Fi Application Key & Secret
  - (ie `PostApplicationResponseDto` or `PostApplicationResponseDtoV2`)

`switch`ing on each arm of the new type will be simpler with an indicating enum, such as "`SecretSharingMethod`" with values "Yopass" and "Direct." Add a new Property to `ApplicationYopassResponseDto` and `PostApplicationResponseDtoBase` for this enum, hard-coded to return the appropriate value. TypeScript will infer the commonality of this property, a base type between the ResponseDtos is not required.

This type will be used as the response body throughout the call stack, instead, replacing current usages of `ApplicationYopassResponseDto`.

#### API

Change the signatures of the below functions to return the appropriate new response union (for v1 or v2) instead of `ApplicationYopassResponseDto`. Then,  based on configuration, return either `ApplicationYopassResponseDto` or `PostApplicationResponseDtoV[N]`.

- AdminApiControllerv1.postApplication
- AdminApiControllerv1.resetApplicationCredentials
- AdminApiControllerv2.postApplication
- AdminApiControllerv2.resetApplicationCredentials

#### Front-End

The front-end "queries" must be updated to ingest this new API to correspond with the above API changes, replacing usages of `ApplicationYopassResponseDto` with the new union type. These can be found in `queries.ts` and `queries.v7.ts`.

- applicationQueriesV1.post
- applicationQueriesV1.put(resetCreds)
- applicationQueriesV2.post
- applicationQueriesV2.put(resetCreds)

Update the `Reset` action which set the view state on the pages to set more than just `link` to state.

- `Application/useApplicationActions.tsx`
- `ApplicationV2/useApplicationActions.tsx`

Finally, on the `ApplicationPage` replace the used `state` (currently a simple `url` value) to instead key off of the returned type to either display the existing content, or a view with the Application Key and Secret directly. Include a message regarding the sensitivity of the key and secret, and its limited lifetime.

Components from `SecretPage` and `SecretValue` can be reused to display the key and secret. Note the field configuration is passed in as JSON in a particular format.

## Mockup

The prompts and screen in the user flow _before_ resetting the credentials should remain the same.
After confirmation, the results returned will differ.

### With Yopass (Current)

![Mockup of UI When Yopass is enabled](./20250821_Disabling_Yopass_Key_and_Secret_Link_(Current).jpg)

### Without Yopass (New)

![Mockup of UI When Yopass is disabled](./20250821_Disabling_Yopass_Key_and_Secret_Inline_(New).jpg)
