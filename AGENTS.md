## about

Polarish is a open-source SDK for building AI workflows where users bring their own AI subscriptions

- It has two parts that work in tandam to work 
- @package/ai - it is a ai-sdk that help you to build ai workflows
- @polarish/cli - the cli help users to connect their ai subs , bridge run those complex workflows

## Rule

- Alway run the typecheck and the lint command on evey file that you edit 
- Alway add the Jsdocs commet to the new function or the types or schema that you have created while writing the commets , keep the language simple and like this function does this and this is the shape of the request that we are expecting
- Alway use bun not npm or pnpm
- When writing the plan to edit or change file , i suggest you to first read those particualr files so that you actaully know what is the current state they are in so you can plan thing better , instead of assuming thing

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.