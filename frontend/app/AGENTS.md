# GoldValueAdded - Agent Guidelines

This document provides guidelines and commands for AI agents working in this repository.

---

## Project Commands

### Development
```bash
npm run dev          # Start Vite dev server (port 1420)
npm run mock         # Start mock API server (port 3000)
npm run tauri        # Run Tauri desktop app
```

### Build & Lint
```bash
npm run build        # Production build with Vite
npm run preview      # Preview production build
```
Note: No dedicated lint command exists. Use `npm run build` to check for errors.

### Testing
```bash
npm run test         # Run tests in watch mode
npm run test:run    # Run tests once
```

**Running a single test file:**
```bash
npx vitest run src/utils/request.test.js
```

**Running a single test:**
```bash
npx vitest run src/utils/request.test.js -t "should handle 401 response"
```

**Running tests in specific directory:**
```bash
npx vitest run src/components/
```

---

## Code Style Guidelines

### Imports
- Use absolute imports with `@/` alias (configured in vite.config.js)
- Order: Vue imports → external libs → internal modules
- Use `import` statements, avoid `require()`

```javascript
// Good
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/utils/request'
import { MarketService } from '@/services/market'

// Bad
import * as marketService from '@/services/market'
const foo = require('foo')
```

### Naming Conventions
- **Components**: PascalCase (`DropdownButton.vue`, `KLineChart.vue`)
- **Composables**: camelCase with `use` prefix (`useChatScroll.js`, `useToast.js`)
- **Services**: PascalCase with `Service` suffix (`AuthService`, `MarketService`)
- **Utilities**: camelCase (`request.js`, `formatDate.js`)
- **Constants**: SCREAMING_SNAKE_CASE

### Formatting
- 2 spaces for indentation
- No semicolons at end of statements
- Single quotes for strings
- Trailing commas in objects/arrays
- Maximum line length: 100 characters

### Vue 3 Composition API
- Use `<script setup>` syntax for all Vue components
- Use `defineProps` and `defineEmits` with object syntax
- Use `ref` for primitives, `reactive` for objects
- Prefer composition functions over mixins

```vue
<script setup>
const props = defineProps({
  items: { type: Array, default: () => [] },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'update:visible'])
const show = ref(false)
</script>
```

### Error Handling
- Always wrap async API calls in try/catch
- Use global `showToast` from `useToast` for user-facing errors
- Log errors to console with context

```javascript
try {
  const data = await apiFetch('/api/data')
  return data
} catch (error) {
  console.error('Failed to fetch data:', error)
  showToast(error.message || 'Operation failed')
  throw error
}
```

### Services Pattern
All API calls go through services in `src/services/`:
```javascript
export const AuthService = {
  login(username, password) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  }
}
```

### Component Structure
Order: Props → Reactive state → Computed → Methods → Lifecycle hooks → Template → Styles

### Tailwind CSS
- Use utility classes in templates
- Dark mode support with `dark:` prefix
- Custom components in `src/components/common/`

### Testing
- Test files colocated: `Component.vue` → `Component.test.js`
- Use Vitest + Vue Test Utils + jsdom
- Mock external dependencies
- Test interactions with `.trigger('click')`

---

## Project Structure

```
src/
├── assets/          # Static assets, images
├── components/      # Vue components (common/ for shared)
├── composables/    # Vue composition functions (useXxx.js)
├── layouts/        # Layout components
├── locales/        # i18n JSON files (en.json, zh.json)
├── router/         # Vue Router config
├── services/       # API service modules (XxxService)
├── utils/          # Utility functions
└── views/          # Page components (auth/, Home.vue, etc.)
```

---

## Key Dependencies

- Vue 3.5 with Composition API
- Vue Router 5, Vue I18n 11
- Tailwind CSS 4, KLineCharts
- Lucide Vue Next (icons), Vitest (testing), MSW (mocking)

---

## Mock API Server

Mock server runs on `http://localhost:3000`. Add endpoints in `mock/mock-server.js`.

## API Base URL

Development: `http://localhost:3000`

All API calls go through `src/utils/request.js` which handles:
- Authorization header injection
- 401 authentication errors
- Global error handling with Toast notifications
