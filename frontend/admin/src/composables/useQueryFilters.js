import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useQueryFilters(state, keys) {
  const route = useRoute()
  const router = useRouter()

  keys.forEach((key) => {
    if (route.query[key] != null) {
      state[key] = route.query[key]
    }
  })

  watch(
    () => keys.map((k) => state[k]),
    () => {
      const nextQuery = { ...route.query }
      keys.forEach((key) => {
        if (state[key] === '' || state[key] == null) {
          delete nextQuery[key]
        } else {
          nextQuery[key] = state[key]
        }
      })
      router.replace({ query: nextQuery })
    },
  )

  return {
    hasActiveFilters: computed(() => keys.some((k) => !!state[k])),
  }
}
