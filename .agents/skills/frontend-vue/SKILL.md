---
name: frontend-vue
description: Expert guidance for building and maintaining Metis frontend applications using Nuxt 3, Vue 3, and Vuetify 3.
---

# Metis Frontend — Nuxt 3 / Vue 3 Skill

This skill provides mandatory guidelines and best practices for developing frontend applications within the Metis monorepo (`front-dashboard` and `front-reservation`).

## 1. Project Architecture (Nuxt 3 CSR)

Metis frontends are built with **Nuxt 3** in **Client-Side Rendering (CSR)** mode only.

- **Config**: `ssr: false` in `src/nuxt.config.ts`.
- **Root Directory**: All source code lives in the `src/` directory.
- **Entry Point**: `src/app.vue` handles layouts, global state initialization, and auth (Keycloak).

### Directory Structure
```
src/
├── components/          # Vue components (grouped by feature)
│   ├── s-components/    # Reusable shared UI components
│   └── <feature>/       # Domain-specific components
├── pages/               # Nuxt pages (file-based routing)
├── stores/              # Pinia state management
├── plugins/             # Nuxt plugins (Vuetify, Toast, Keycloak)
├── layouts/             # Page layouts
├── composables/         # Shared logic/hooks
├── services/            # API interaction logic (Axios)
├── types/               # TypeScript interfaces and types
├── assets/              # SCSS, images, fonts
└── nuxt.config.ts       # Nuxt configuration
```

## 2. Vue 3 & Component Development

### 2.1 script setup
Always use `<script setup lang="ts">` for all new components. Avoid the Options API.

### 2.2 Component Design
- **Single Responsibility**: One component per file.
- **Reusable Components**: Extract repeating UI patterns into `components/s-components/`.
- **PascalCase**: Component filenames must be `PascalCase.vue`.
- **Props/Emits**: Use `defineProps<{...}>()` and `defineEmits<{...}>()`.

```vue
<script setup lang="ts">
interface Props {
  title: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  (e: 'update:status', value: string): void;
}>();
</script>

<template>
  <v-card :title="props.title" :loading="props.loading">
    <slot />
  </v-card>
</template>
```

### 2.3 Local State Sync
Do not use `v-model` directly on Pinia state if it's deeply nested or requires validation. Copy to a local `ref` and sync via store actions.

## 3. Vuetify 3 Usage

- All UI should leverage **Vuetify 3** components (`v-app`, `v-main`, `v-container`, `v-btn`, etc.).
- Use Vuetify's utility classes for spacing (`ma-2`, `pa-4`) and alignment.
- **V-Model**: Bind `v-model` to local refs or reactive objects within components.

## 4. State Management (Pinia)

### 4.1 Store Structure
Stores live in `src/stores/` using the Options API style within `defineStore`.

```typescript
export const useMyStore = defineStore({
  id: 'myStore',
  state: () => ({ ... }),
  getters: {
    // Return a deep clone for mutable objects
    getDetails: (state) => JSON.parse(JSON.stringify(state.details)),
  },
  actions: {
    updateData(payload: any) { ... }
  },
  persist: { storage: persistedState.localStorage }
});
```

### 4.2 Guidelines
- **No Direct Mutation**: Never mutate store state directly from a component. Use actions.
- **Getters**: Always expose state through explicit getters.
- **Persistence**: Use `@pinia-plugin-persistedstate/nuxt` for state that must survive page refreshes.

## 5. API Interaction (Axios)

- **Proxies**: All API calls must go through the proxies defined in `nuxt.config.ts`.
  - `/aerial/` → `api-aerial`
  - `/api/` (dashboard) → `api-dashboard`
  - `/rail/` → `api-rail`
- **Axios**: Use the pre-configured Axios instance.
- **Error Handling**: Use `try/catch` and show feedback via `$stoast.error()`.

## 6. TypeScript Standards

- **No `any`**: Strictly enforce types. Define interfaces in `src/types/`.
- **Import Type**: Use `import type` for type-only imports to improve build performance.
- **Prefix Unused**: Prefix unused parameters with `_`.

## 7. Common Pitfalls
- **SSR**: Never assume Node.js environment; code must be browser-compatible.
- **Props Mutation**: Never mutate props; emit events to the parent.
- **Keycloak**: Ensure Keycloak is initialized (`app.vue`) before making protected API calls.
