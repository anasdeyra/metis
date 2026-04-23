---
trigger: always_on
---

# Metis — AI Agent Rules

> These rules apply across all sub-projects of the Metis monorepo and must be followed strictly by any AI agent working on this codebase.

---

## 1. Monorepo Structure

The workspace is a **multi-service travel management platform** composed of six independent sub-projects:

| Directory | Role | Tech Stack |
|---|---|---|
| `api-aerial` | Aerial (flight) booking API | Node.js, Express, Sequelize, PostgreSQL |
| `api-dashboard` | Dashboard/back-office API | Node.js, Express, Sequelize, PostgreSQL |
| `api-hotel` | Hotel booking API | Node.js, Express, Sequelize, PostgreSQL |
| `api-rail` | Rail booking API | Node.js, Express, Sequelize, PostgreSQL |
| `front-dashboard` | Back-office frontend | Nuxt 3, Vue 3, Vuetify 3, Pinia, TypeScript |
| `front-reservation` | Booking/reservation frontend | Nuxt 3, Vue 3, Vuetify 3, Pinia, TypeScript |

**Never mix code between sub-projects.** Each has its own `src/`, `package.json`, and git history.

---

## 2. Package Manager

- All **backend** projects (`api-*`) use **npm** (no `pnpm-lock.yaml` present).
- All **frontend** projects (`front-*`) use **npm** by default (check for `pnpm-lock.yaml` before switching).
- Never use `yarn` unless the project already has a `yarn.lock`.

---

## 3. Backend APIs — Node.js / Express

### 3.1 Architecture (MVCS)

All backend projects follow a strict **Model → Controller → Service** pattern:

```
src/
├── models/          # Sequelize model definitions
├── migrations/      # Sequelize migration files
├── services/        # Business logic (DB interactions)
├── controllers/     # Route handlers (thin layer, delegates to services)
│   ├── base.controller.js    # Base class with CRUD + error helpers
│   └── <PROVIDER>/           # Sub-folder per airline/hotel/rail provider
├── utils/           # Pure helper functions & formatters
│   └── <PROVIDER>/           # Provider-specific utils
├── middleware/      # Express middleware
├── helpers/         # Shared helpers (errors, Joi, cors…)
├── types/           # JSDoc typedef files (.d.ts)
└── app.js           # Entry point — route loading is auto-discovered
```

### 3.2 Controllers

- All controllers **extend** `base.controller.js` via `const { Controller } = require("../base.controller")("serviceName")`.
- Only use **static async** methods on controller classes.
- Controllers must be **thin**: extract request data, call a service/util, then return a response — no business logic inside controllers.
- Always use `_createErrorResponse(res, statusCode, message)` for error responses — never craft raw error JSON inline.
- Every controller file must export a `setupRoute(app)` function that registers its routes, OR export a factory function `(app, GeneralError) => app` for legacy controllers.
- Place provider-specific controllers under `src/controllers/<PROVIDER>/` (uppercase: `AMADEUS`, `SABRE`, `AFKL`, etc.).

### 3.3 Services

- One file per entity: `<entity>.service.js`.
- Services interact with Sequelize models and must encapsulate all DB logic.
- Never import a model directly inside a controller — always go through a service.
- Provider-specific services go under `src/services/<PROVIDER>/`.

### 3.4 Models (Sequelize)

- Each model file exports a `(sequelize, DataTypes) => Model` factory.
- All associations are defined inside `static associate(models)`.
- Always define `tableName` and relevant `indexes` in the model init options.
- Use `DataTypes.TEXT` for variable-length strings (avoid `STRING` with length constraints unless strictly needed).
- Use `allowNull: true` only when the field is genuinely optional.

### 3.5 Utils

- Utility functions must be **pure** where possible (no side effects, deterministic output).
- Provider-specific utils go under `src/utils/<PROVIDER>/` (e.g., `src/utils/AMADEUS/order.utils.js`).
- XML parsing/building for AMADEUS always uses `xml-js` (`xml2js` for parsing, `js2xml` for building) with `{ compact: true }`.
- XML properties parsed from SOAP responses use the `_text` suffix to access text nodes (e.g., `node._text`).

### 3.6 AMADEUS Integration

- All AMADEUS SOAP calls go through `createAmadeusService()` from `src/services/AMADEUS/amadeusServiceFactory.js`.
- Never hardcode AMADEUS credentials. Always fetch via `getSalesPoint(salesPointId)`.
- Session management: Always track `session` object across sequential SOAP calls. Increment `SequenceNumber` as required.
- Always call `Security_SignOut` to close SOAP sessions, even on error paths.
- Request/response XML is logged automatically by `writeLogsIncremental` inside the service factory — do not add extra file write logic.
- Use `createSuccessResponse(data)` / `createErrorResponse(message, status)` to return normalized results from service functions.

### 3.7 Error Handling

- Use `try/catch` blocks on all async operations.
- Pass errors to `next(error)` in standard CRUD controllers (base controller pattern).
- For provider-specific controllers, use `_createErrorResponse(res, code, description)`.
- Handle specific network error codes explicitly: `ECONNREFUSED` → 503, `ETIMEDOUT` / `ECONNABORTED` → 408, `ENOTFOUND` → 503.
- Never swallow errors silently. At minimum, log with `console.error`.
- Global process events (`uncaughtException`, `unhandledRejection`) are already handled in `app.js` — do not add duplicates.

### 3.8 ESLint & Code Style (Backend)

- Config: `airbnb-base` + `eslint-plugin-promise`.
- Always use arrow functions for callbacks: `prefer-arrow-callback` is enforced.
- Never nest promises: `promise/no-nesting` is an error.
- Disabled rules that the team has turned off: `consistent-return`, `global-require`, `import/no-dynamic-require`.
- Use `require()` for imports (the backends are CommonJS, not ESM).

### 3.9 Naming Conventions (Backend)

- File names: `kebab-case.service.js`, `kebab-case.controller.js`, `kebab-case.utils.js`.
- Model class names: `PascalCase`.
- Function/variable names: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for environment config references.
- Provider folder names: `UPPERCASE` (`AMADEUS`, `SABRE`, `AFKL`, `EK`, `IBERIA`, `TRANSAVIA`, `TURKISH_AIRLINES`, `GOKYTE`, `ACCELYA`).
- Unused parameters must be prefixed with `_` (e.g., `_next`).

### 3.10 Logging

- Use `console.log` / `console.error` / `console.warn` inline for now.
- Never use `logRequest` calls (these were removed). Do not re-introduce them.
- For AMADEUS XML traces, the `writeLogsIncremental` function handles logging — do not add extra log calls around SOAP calls.

---

## 4. Frontend Apps — Nuxt 3 / Vue 3

### 4.1 General

- Both frontends use **Nuxt 3 (v3.2.0)** with **Vue 3** and **Vuetify 3**.
- **No SSR**: `ssr: false` in `nuxt.config.ts`.
- TypeScript is enabled. All new files should be `.ts` or `.vue` with `<script setup lang="ts">`.
- Use the `@/` alias to reference `src/` root (configured by Nuxt auto-imports).
- Always translate all text to all langauges available see: front-reservation\src\utils\locales folder

### 4.2 Component Architecture

- Follow the **single-responsibility principle**: one component per file.
- Create reusable sub-components to avoid long single-file components.
- Group components by domain feature under `src/components/<feature>/`.
  - e.g., `components/booking/flight/`, `components/folder/`, `components/sbt/`.
- Component files: `PascalCase.vue`.
- Shared/generic UI components go in `components/s-components/` or `components/style-components/`.

### 4.3 State Management (Pinia)

- All global state lives in `src/stores/`.
- Store files: `camelCase.ts` (e.g., `bookingFlowStore.ts`).
- Define stores with `defineStore({ id, state, getters, actions })` — options API style (not setup stores).
- Getters that return mutable data must use `JSON.parse(JSON.stringify(...))` to return deep clones and avoid mutations.
- Expose all state through explicit getters — never let components access raw store state directly when it can be mutated.
- For persistent stores, use `persist: { storage: persistedState.localStorage }`.
- Avoid using `any` in store interfaces — define proper TypeScript interfaces for all state shapes when possible. Use `[key: string]: any` only as a last resort for truly dynamic data.

### 4.4 TypeScript

- **Never use `any` as a type** unless interfacing with third-party untyped data that genuinely cannot be typed.
- Define domain types/interfaces in `src/types/<domain>.ts`.
- Export types from a central barrel when multiple files need them (see `dossier.ts` pattern).
- Use `import type` for type-only imports.
- Unused parameters must be prefixed with `_`.

### 4.6 API Calls (Frontend)

- Use `axios` for all HTTP calls.
- All API routes are proxied via `nuxt.config.ts` proxy config:
  - `/aerial/` → `api-aerial`
  - `/dashboard/` → `api-dashboard`
  - `/hotel/` → `api-hotel`
  - `/rail/` → `api-rail`
- Never hardcode full backend URLs in components or composables.
- Always handle errors in `try/catch` and show user feedback via `$stoast.error(...)`.

### 4.7 Vue & Template Conventions

- Use `<script setup lang="ts">` for all new components.
- Do not use the Options API for new code.
- Props must be typed with `defineProps<{...}>()` — no runtime validators.
- Emits must be typed with `defineEmits<{...}>()`.
- For `v-for` loops, always provide a `:key` with a unique, stable identifier (never index in dynamic lists that can reorder).
- Template conditions: use `v-if`/`v-else-if`/`v-else` (not `v-show`) for elements that should not render at all when hidden.


## 5. Migrations (Sequelize)

- Every schema change **must** be accompanied by a migration file in `src/migrations/`.
- Migration filenames use the pattern: `YYYYMMDDHHMMSS-description.js`.
- Always implement both `up` and `down` methods.
- Never edit existing migration files once merged — always create new ones.
- Use `queryInterface.addColumn`, `removeColumn`, `changeColumn` etc. — never raw SQL in migrations unless absolutely necessary.
- Apply by running sequelize:aerial:migrate
- **Important**: Whenever a database migration is created or modified and pushed to an MR, you must automatically add the `"DB migration"` label to the Gitlab Merge Request (using `glab mr update <MR_ID> --label "DB migration"`).

---

## 6. Environment Variables

- Environment files live in `src/.environment/` (backends) or `src/.environments/` (frontends).
- Never hardcode secrets, passwords, tokens, or API keys in source code.
- Always use `process.env.VAR_NAME` with a fallback or guard for optional vars.
- Public frontend env vars go in `runtimeConfig.public` in `nuxt.config.ts`.
- Private/server-only vars go in `runtimeConfig` (root-level) in `nuxt.config.ts`.

---

## 7. Common Pitfalls to Avoid

1. **Do NOT** add `logRequest()` calls — they were intentionally removed.
2. **Do NOT** use `any` types in TypeScript without justification.
3. **Do NOT** directly access the `_text` property on XML nodes without checking for `undefined` — XML-parsed objects are deeply nested and properties may be missing.
4. **Do NOT** sign out of an AMADEUS session before all planned steps are complete — sign out must be the last call.
5. **Do NOT** create new controller patterns outside the established `base.controller` inheritance.
6. **Do NOT** mix ESM (`import/export`) and CommonJS (`require/module.exports`) in the same backend file.
7. **Do NOT** store API credentials or secrets in source code or `git`-tracked files.
8. **Do NOT** mutate Pinia store state directly from components — always use defined actions.
9. **Do NOT** use `v-model` directly on a Pinia state value — copy to a local `ref` and sync via actions.
10. **Do NOT** add global `uncaughtException` or `unhandledRejection` handlers — they exist in `app.js` already.