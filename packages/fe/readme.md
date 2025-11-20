# FE notes

## Error-handling

There are a bunch of error handling patterns to cover all the bases:

- Re-authentication trigger
- Component error boundaries and fallbacks
- Global error display banner using Context
- Form error state and display

We'll follow the journey of a few doomed requests to hit each of these.

**Form:**

1. Request is sent by a form submission handler.
1. Failure response comes back to axios.
1. Axios checks if it's a `401`. If so, it redirects you to login. If not it passes through. Suppose it's not.
1. The react-query mutation `onError` is invoked. In the form setup this has been provided by `mutationErrHandler`, which will parse the error and dump it into the form state.
1. The mutation swallows the final rejection in order to not break react-hook-form.

**Non-form mutation:**

1. Request is sent by an action button.
1. Failure response comes back to axios.
1. Axios checks if it's a `401`. If so, it redirects you to login. If not it passes through. Suppose it's not.
1. The react-query mutation `onError` is invoked. In the action config this has been provided by `mutationErrHandler`, which will parse the error and dump it into the global error banner context.

**Query:**

1. Request is triggered and subscribed to by a component's `useQuery` invocation.
1. Failure response comes back to axios.
1. Axios checks if it's a `401`. If so, it redirects you to login. If not it passes through. Suppose it's not.
1. The error is surfaced by `useQuery` by throwing it in the component function. If there are multiple components subscribed to this query, then their subscribers all do this independently.
1. The render error gets passed to the nearest error boundary which then renders its fallback.
