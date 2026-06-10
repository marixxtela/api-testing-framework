# 0003. Zod for shared schemas

- Status: Accepted
- Date: 2026-05-25
- Deciders: QA team

## Context

The target API needs to validate the request body at runtime, generate the matching TypeScript types, and export schemas for use in tests (response assertions) and in OpenAPI contracts. Keeping three parallel definitions (TS type, runtime schema, JSON Schema) breeds divergence and subtle bugs. The schema library choice directly affects maintainability.

Requirements considered:

1. TS type inference from the schema, no duplication.
2. Structured and readable error messages.
3. Support for transforms and custom refinements.
4. Ability to convert to JSON Schema (for Fastify and OpenAPI).
5. Acceptable performance in the validation hot path.

## Decision

Adopt Zod 3 as the single source of truth for schemas in the application layer.

Implications:

- Schemas live in `src/api/schemas.ts` (routes) and `src/schemas/` (test assertions).
- Types derived via `z.infer<typeof schema>` replace manual interfaces.
- Fastify uses inline JSON Schema declared on the route for fast serialization. Zod handles the logical body validation. The duplication is acceptable because the route JSON Schema is ergonomic to read and does not need custom transforms.

## Consequences

Positive:

- Types always coherent with runtime. Refactoring a schema fails at compile time wherever it is used.
- The composition API (`extend`, `merge`, `pick`, `omit`, `partial`) reduces boilerplate when entities share fields.
- `safeParse` returns a discriminated `{ success, data | error }`, ideal for explicit handling without try/catch.
- Faker + Zod in builders becomes trivial: types guided by the IDE.

Negative:

- Zod to JSON Schema conversion via `zod-to-json-schema` adds an extra dependency when needed. Acceptable.
- Zod is slower than raw ajv in microbenchmarks. On API body validation the cost is irrelevant (microseconds vs milliseconds of the query).
- Version 3 already signals breaking changes coming in 4. The upgrade will need attention when 4 stabilizes.

## Alternatives considered

Yup: similar API, but TS type inference is weak and requires parallel declaration in common cases. No first-class support for discriminated unions. Rejected.

Joi: historical standard in the Node ecosystem, no native TS type inference. Typings available via `@types/joi`, but force you to keep a separate interface. Rejected.

Plain ajv with JSON Schema: fast, official JSON Schema standard, but forces verbose schema writing and does not generate a TS type. Boilerplate grows quickly. Used internally by Fastify for serialization, but not as the application's schema API.

class-validator + class-transformer: forces decorators and classes. Couples the schema to an OO contract, hurts functional composition. Rejected.

Typebox: generates JSON Schema and TS type simultaneously, superior performance. Excellent technical alternative. Rejected for smaller mindshare and a less ergonomic API for complex refinements compared to Zod.
