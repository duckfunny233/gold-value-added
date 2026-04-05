<script setup>
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Loader2 } from 'lucide-vue-next'
import { ref, onMounted, onActivated } from 'vue'
import NewsCard from '../components/NewsCard.vue'
import { NewsService } from '../services/news'

defineOptions({ name: 'NewsList' })

const { t } = useI18n()
const router = useRouter()

const newsList = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(1)
const totalPages = ref(1)
const limit = 10
const scrollContainer = ref(null)
const savedScrollTop = ref(0)

onBeforeRouteLeave((to, from) => {
  if (scrollContainer.value) {
    savedScrollTop.value = scrollContainer.value.scrollTop
  }
})

onActivated(() => {
  if (scrollContainer.value && savedScrollTop.value > 0) {
    scrollContainer.value.scrollTop = savedScrollTop.value
  }
})

const fetchNews = async (isLoadMore = false) => {
  if (isLoadMore) {
    if (page.value >= totalPages.value) return
    loadingMore.value = true
    page.value++
  } else {
    loading.value = true
    page.value = 1
    newsList.value = []
  }

  try {
    const result = await NewsService.getNews(page.value, limit)
    if (isLoadMore) {
      newsList.value = [...newsList.value, ...(result.data?.items || [])]
    } else {
      newsList.value = result.data?.items || []
    }
    totalPages.value = result.data?.totalPages || 1
  } catch (error) {
    console.error('Failed to fetch news list:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  fetchNews()
})
</script>

<template>
  <div class="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col z-[100]">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-4 shrink-0 relative z-10">
      <button @click="router.back()" class="p-1 -ml-1 text-gray-600 dark:text-gray-400 btn-interact rounded-full">
        <ArrowLeft :size="24" />
      </button>
<h3 class="font-bold text-lg">{{ t('news.newsListTitle') }}</h3>
    </header>

    <!-- Content -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <!-- Loading State -->
      <div v-if="loading" class="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 class="animate-spin text-primary" :size="32" />
        <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">{{ t('news.loading') }}</p>
      </div>

      <!-- News List -->
      <template v-else>
        <NewsCard 
          v-for="news in newsList" 
          :key="news.id" 
          :item="news"
          show-summary
          @click="router.push(`/news/${news.id}`)"
        />

        <!-- Empty State -->
        <div v-if="newsList.length === 0" class="py-20 text-center text-gray-400 text-sm font-medium">
          {{ t('news.noContent') }}
        </div>

        <!-- Load More -->
        <div v-if="page < totalPages" class="pt-2 pb-8 text-center">
          <button 
            @click="fetchNews(true)" 
            :disabled="loadingMore"
            class="text-xs text-primary font-bold px-8 py-2.5 rounded-full border-2 border-primary/20 bg-primary/5 active:bg-primary/10 transition-all btn-interact disabled:opacity-50"
          >
            <span v-if="loadingMore" class="flex items-center gap-2">
              <Loader2 class="animate-spin" :size="14" />
              {{ t('common.loading') }}
            </span>
            <span v-else>{{ t('news.viewMore') }}</span>
          </button>
        </div>
        
        <!-- No More Data -->
        <div v-else-if="newsList.length > 0" class="pt-2 pb-8 text-center text-xs text-gray-400">
          {{ t('news.loadedAll') }}
        </div>
      </template>
    </div>
  </div>
</template>