<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Share2, Calendar, Eye } from 'lucide-vue-next'
import { ref, onMounted } from 'vue'
import { NewsService } from '../services/news'
import { UserService } from '../services/user'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const newsId = route.params.id
const isActivity = route.path.includes('/activity/')

const newsDetail = ref(null)
const loading = ref(true)
const error = ref(null)

const fetchNewsDetail = async () => {
  try {
    loading.value = true
    const result = isActivity 
      ? await UserService.getActivityDetail(newsId)
      : await NewsService.getNewsDetail(newsId)
    const data = result?.data || {}
    newsDetail.value = {
      ...data,
      date: data.date || data.createdAt || '',
      image: data.image || data.cover || '',
    }
  } catch (err) {
    console.error('Failed to fetch detail:', err)
    error.value = err.message || t('news.loadFailed')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchNewsDetail()
})
</script>

<template>
  <div class="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col z-[100]">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between shrink-0 relative z-10">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-1 -ml-1 text-gray-600 dark:text-gray-400 btn-interact rounded-full">
          <ArrowLeft :size="24" />
        </button>
        <h3 class="font-bold text-lg truncate max-w-[200px]">{{ isActivity ? t('news.activityDetail') : t('news.newsDetail') }}</h3>
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar">
<div v-if="loading" class="flex flex-col items-center justify-center py-20 space-y-4">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">{{ t('news.loadingDetail') }}</p>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div class="text-gray-300 dark:text-gray-700 mb-4">
          <Share2 :size="48" class="opacity-20" />
        </div>
        <p class="text-gray-500 font-medium">{{ error }}</p>
        <button @click="router.back()" class="mt-6 px-8 py-2.5 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 btn-interact">{{ t('news.returnList') }}</button>
      </div>

      <div v-else-if="newsDetail" class="px-4 py-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
          {{ newsDetail.title }}
        </h1>

        <div class="flex items-center gap-4 text-[10px] text-gray-400 font-bold mb-8 pb-4 border-b border-gray-100 dark:border-gray-800 uppercase tracking-wider">
          <div class="flex items-center gap-1">
            <Calendar :size="12" />
            {{ newsDetail.date }}
          </div>
          <div class="flex items-center gap-1">
            <Eye :size="12" />
            {{ newsDetail.views }} {{ t('news.views') }}
          </div>
          <div class="text-primary">{{ newsDetail.author }}</div>
        </div>

        <!-- Main Image -->
        <div v-if="newsDetail.image" class="mb-8 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-800">
          <img :src="newsDetail.image" class="w-full h-auto object-cover" :alt="newsDetail.title" />
        </div>

        <div class="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed font-normal" v-html="newsDetail.content">
        </div>

<!-- Footer Placeholder -->
        <div class="mt-12 mb-8 text-center text-xs text-gray-400">
          {{ t('common.noMore') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose :deep(p) {
  margin-bottom: 1rem;
}
</style>
