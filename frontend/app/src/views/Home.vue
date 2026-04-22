<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowUpRight, RefreshCw } from 'lucide-vue-next'
import ImageCarousel from '../components/ImageCarousel.vue'
import { NewsService } from '../services/news'
import { UserService } from '../services/user'

defineOptions({ name: 'Home' })

const { t } = useI18n()
const router = useRouter()

const notice = ref(t('home.loadingNotice'))
const newsList = ref([])
const newsLoading = ref(false)

const rankingLoading = ref(false)
const rankingSyncAt = ref('')
const rankingRows = ref([])

let rankingTimer = null

const hasNews = computed(() => newsList.value.length > 0)

const rankList = computed(() => {
  const sorted = [...rankingRows.value]
  sorted.sort((a, b) => {
    if (b.goldGrams !== a.goldGrams) return b.goldGrams - a.goldGrams
    if (b.totalAsset !== a.totalAsset) return b.totalAsset - a.totalAsset
    return a.sequenceNo - b.sequenceNo
  })

  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1
  }))
})

const pyramidLayers = computed(() => rankList.value.slice(0, 6))

function getLayerStyle(index, total) {
  const topPositions = [29, 38, 47, 57, 67, 78]
  const widths = [23, 32, 50, 60, 70, 80]
  
  return {
    top: `${topPositions[index] || 50}%`,
    width: `${widths[index] || 60}%`,
  }
}

function formatSyncTime() {
  const now = new Date()
  rankingSyncAt.value = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

async function fetchNotice() {
  try {
    const noticeData = await UserService.getNotice()
    notice.value =
      noticeData.text ||
      (Array.isArray(noticeData) ? noticeData[0] : noticeData) ||
      t('home.noNotice')
  } catch (error) {
    console.error('首页公告加载失败:', error)
    notice.value = t('home.connectionFailed')
  }
}

async function fetchNews() {
  newsLoading.value = true
  try {
    const result = await NewsService.getNews(1, 5)
    newsList.value = (result?.data?.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      image: item.thumbnail || item.cover || '',
      summary: item.summary,
      date: item.date || item.createdAt || ''
    }))
  } catch (error) {
    console.error('首页新闻加载失败:', error)
    newsList.value = []
  } finally {
    newsLoading.value = false
  }
}

async function fetchRanking() {
  rankingLoading.value = true
  try {
    const result = await UserService.getLeaderboard()
    console.log('排行榜接口返回:', result)
    const rows = Array.isArray(result?.data?.items)
      ? result.data.items
      : Array.isArray(result?.data)
        ? result.data
        : []

    console.log('解析后的行数:', rows)
    rankingRows.value = rows.map((item, index) => ({
      rank: Number(item.rank || index + 1),
      sequenceNo: Number(item.sequenceNo || Number.MAX_SAFE_INTEGER),
      nickname: item.nickname || `${t('home.buyerRank', { index: index + 1 })}`,
      goldGrams: Number(item.goldGrams || 0),
      totalAsset: Number(item.totalAsset || item.investedAmount || 0),
    }))
    formatSyncTime()
  } catch (error) {
    console.error('排行榜加载失败:', error)
    rankingRows.value = []
  } finally {
    rankingLoading.value = false
  }
}

function goNewsDetail(id) {
  router.push(`/news/${id}`)
}

function goGoldChain() {
  router.push('/gold-chain')
}

onMounted(async () => {
  await Promise.all([fetchNotice(), fetchNews(), fetchRanking()])
  rankingTimer = setInterval(fetchRanking, 5000)
})

onBeforeUnmount(() => {
  if (rankingTimer) {
    clearInterval(rankingTimer)
    rankingTimer = null
  }
})
</script>

<template>
  <div class="home-page">
    <section class="notice-section">
      <div class="notice-bar">
        <span class="notice-brand">mGQK SERVER</span>
        <div class="notice-text-marquee">
          <span class="notice-text-track">{{ notice }}</span>
        </div>
      </div>
    </section>

    <section class="carousel-section">
      <ImageCarousel
        v-if="hasNews"
        :items="newsList"
        item-class="rounded-2xl overflow-hidden shadow-[0_12px_24px_rgba(2,8,18,0.24)] snap-center border border-[#ffffff0d] bg-[#152535]"
        class="rounded-2xl overflow-hidden"
      >
        <template #default="{ item }">
          <div @click="goNewsDetail(item.id)" class="news-slide btn-interact">
            <div
              class="news-bg"
              :style="item.image ? { backgroundImage: `url(${item.image})` } : {}"
              :class="{ 'news-bg-fallback': !item.image }"
            ></div>
            <div class="news-mask"></div>
            <div class="news-content">
              <h3 class="news-title">{{ item.title }}</h3>
            </div>
          </div>
        </template>
      </ImageCarousel>

      <div v-else class="card-empty">
        {{ newsLoading ? t('home.newsLoading') : t('home.noNewsAutoRefresh') }}
      </div>
    </section>

    <section class="ranking-panel">
      <div class="panel-head">
        <div>
          <h2 class="section-title">{{ t('home.pyramidTitle') }}</h2>
          <p class="panel-subtitle">{{ t('home.pyramidSubtitle') }}</p>
        </div>
        <div class="sync-mark">
          <RefreshCw :size="14" class="sync-icon" :class="{ spinning: rankingLoading }" />
          <span>{{ rankingSyncAt ? t('home.updatedAt', { time: rankingSyncAt }) : t('home.syncing') }}</span>
        </div>
      </div>

      <div class="pyramid-wrap">
        <div v-if="rankList.length === 0" class="card-empty">{{ t('home.noRanking') }}</div>

        <div v-else class="pyramid-container">
          <div class="pyramid-image-stage">
            <img class="pyramid-image" src="/金字塔.png" :alt="t('home.pyramidTitle')" />
            <div
              v-for="(item, index) in pyramidLayers"
              :key="item.sequenceNo"
              class="pyramid-layer-label"
              :class="{ 'first-rank': item.rank === 1 }"
              :style="getLayerStyle(index, pyramidLayers.length)"
            >
              <template v-if="item.rank === 1">
                <span class="rank-badge rank-gold">金主：第一名</span>
                <div class="tier-info">
                  <span class="tier-grams">{{ item.goldGrams.toFixed(2) }} g：</span>
                  <span class="tier-nick">{{ item.nickname }}</span>
                </div>
              </template>
              <template v-else>
                <div class="tier-top">
                  <span class="rank-badge">#{{ item.rank }}</span>
                  <span class="tier-nick">{{ item.nickname }}</span>
                </div>
                <span class="tier-grams">{{ item.goldGrams.toFixed(2) }} g</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </section>

    <button class="gold-chain-entry btn-interact" @click="goGoldChain" :aria-label="t('home.goldChainAria')">
      <ArrowUpRight :size="20" />
      <span>{{ t('home.goldChainEntry') }}</span>
    </button>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100%;
  padding: 0 0 6.8rem;
  background:
    radial-gradient(circle at 15% 10%, rgba(193, 133, 28, 0.14), transparent 24%),
    radial-gradient(circle at 85% 22%, rgba(191, 148, 63, 0.08), transparent 28%),
    linear-gradient(180deg, #0b1624 0%, #0b1826 42%, #0c1723 100%);
}

.hero-section,
.ranking-panel {
  margin: 0 1rem;
}

.notice-section {
  margin: 0 0 0.65rem;
}

.notice-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 2rem;
  padding: 0 0.45rem;
  background: linear-gradient(180deg, rgba(38, 48, 50, 0.72), rgba(24, 34, 40, 0.58));
  border-top: 1px solid rgba(198, 145, 44, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.notice-brand {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  color: rgba(191, 148, 63, 0.74);
  letter-spacing: 0.03em;
}

.notice-text-marquee {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.notice-text-track {
  display: inline-block;
  padding-right: 1rem;
  font-size: 10px;
  font-weight: 600;
  color: rgba(191, 148, 63, 0.74);
  white-space: nowrap;
  will-change: transform;
  animation: notice-marquee 14s linear infinite;
}

@keyframes notice-marquee {
  0% {
    transform: translateX(100%);
  }
  18% {
    transform: translateX(0);
  }
  32% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-100%);
  }
}

.carousel-section {
  margin: 0 1rem 1.15rem;
}

.section-head,
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: #f8fbff;
}

.news-slide {
  position: relative;
  height: 100%;
  cursor: pointer;
}

.news-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.news-bg-fallback {
  background-image: linear-gradient(135deg, #3d2d11 0%, #7e5b1d 35%, #d7a345 100%);
}

.news-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.06));
}

.news-content {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 1.5rem;
  color: #fff;
}

.news-title {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.35;
  text-shadow: 0 3px 18px rgba(0, 0, 0, 0.4);
}

.ranking-panel {
  position: relative;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
    linear-gradient(180deg, #102031 0%, #0d1a28 100%);
  border-radius: 1rem;
  padding: 1rem 0.95rem 1.05rem;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 16px 32px rgba(3, 9, 18, 0.42);
  overflow: hidden;
}

.ranking-panel::before {
  content: '';
  position: absolute;
  left: 0.95rem;
  top: 0.95rem;
  width: 7.5rem;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.03));
}

.panel-subtitle {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  color: rgba(208, 217, 227, 0.74);
}

.sync-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: rgba(196, 167, 110, 0.86);
}

.sync-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.pyramid-wrap {
  margin-top: 0.95rem;
  padding: 0.5rem 0 0.5rem;
}

.pyramid-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 360px;
}

.pyramid-image-stage {
  position: relative;
  width: 100%;
  max-width: 360px;
  height: clamp(360px, 100vw, 520px);
  overflow: hidden;
}

.pyramid-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(1.05);
  transform-origin: center center;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

.pyramid-layer-label {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: calc(100% - 1rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0;
  border-radius: 0;
  border: none;
  background: transparent;
  backdrop-filter: none;
  color: #d4af37;
  text-shadow: 
    1px 1px 0 rgba(255, 255, 255, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.2),
    0 0 8px rgba(212, 175, 55, 0.6),
    0 0 15px rgba(212, 175, 55, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pyramid-layer-label.first-rank {
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.pyramid-layer-label.first-rank .rank-badge {
  font-size: 0.75rem;
  margin-bottom: 2px;
  transform: translateY(8px);
}

.pyramid-layer-label.first-rank .tier-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.pyramid-layer-label.first-rank .tier-nick {
  text-align: center;
}

.pyramid-layer-label.first-rank .tier-grams {
  transform: translateY(2px);
}

.tier-top {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.rank-badge {
  flex: 0 0 auto;
  font-size: 0.75rem;
  font-weight: 700;
  color: inherit;
  background: transparent;
  padding: 0;
  border-radius: 0;
  text-shadow: inherit;
}

.rank-gold {
  color: #c79954ff;
  text-shadow: 
    1px 1px 0 rgba(255, 255, 255, 0.6),
    -1px -1px 0 rgba(0, 0, 0, 0.3),
    0 0 8px rgba(153, 101, 21, 0.8),
    0 0 15px rgba(153, 101, 21, 0.4);
}

.tier-nick {
  font-weight: 600;
  font-size: 0.85rem;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: inherit;
}

.tier-grams {
  font-size: 0.55rem;
  font-weight: 400;
  color: inherit;
  margin-top: -2px;
  line-height: 1;
  text-shadow: inherit;
}

@media (max-width: 640px) {
  .pyramid-container {
    min-height: 340px;
  }

  .pyramid-layer-label {
    gap: 0.1rem;
    padding: 0;
  }

  .tier-top {
    gap: 0.25rem;
  }

  .rank-badge {
    font-size: 0.65rem;
    padding: 0;
  }

  .tier-nick {
    font-size: 0.75rem;
  }

  .tier-grams {
    font-size: 0.45rem;
    font-weight: 400;
  }
}

.card-empty {
  border-radius: 0.8rem;
  padding: 1.1rem 0.9rem;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(207, 215, 224, 0.82);
  background: rgba(255, 255, 255, 0.03);
}

.gold-chain-entry {
  position: fixed;
  right: 1rem;
  bottom: 5.2rem;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  color: #111827;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 22px rgba(245, 158, 11, 0.35);
  z-index: 9999;
}

.gold-chain-entry span {
  margin-top: 0.08rem;
  font-size: 0.58rem;
  line-height: 1;
  font-weight: 700;
}
</style>
