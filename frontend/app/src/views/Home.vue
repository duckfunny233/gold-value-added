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

const localRankingSeed = ref([
  { nickname: '金海逐光', goldGrams: 1280.65, investedAmount: 998600, sequenceNo: 1 },
  { nickname: '沪上买手', goldGrams: 1150.2, investedAmount: 892500, sequenceNo: 2 },
  { nickname: '北城风控', goldGrams: 972.88, investedAmount: 761000, sequenceNo: 3 },
  { nickname: '长安金客', goldGrams: 845.42, investedAmount: 665900, sequenceNo: 4 },
  { nickname: '晨雾交易员', goldGrams: 724.9, investedAmount: 571300, sequenceNo: 5 },
  { nickname: '海角拾金', goldGrams: 610.34, investedAmount: 482900, sequenceNo: 6 },
  { nickname: '西岭观金', goldGrams: 508.56, investedAmount: 402500, sequenceNo: 7 },
  { nickname: '天府买点', goldGrams: 430.1, investedAmount: 340400, sequenceNo: 8 },
  { nickname: '南城定投', goldGrams: 352.86, investedAmount: 280900, sequenceNo: 9 },
  { nickname: '塔尖操盘', goldGrams: 288.66, investedAmount: 230200, sequenceNo: 10 }
])

const hasNews = computed(() => newsList.value.length > 0)

const rankList = computed(() => {
  const sorted = [...rankingRows.value]
  sorted.sort((a, b) => {
    if (b.investedAmount !== a.investedAmount) return b.investedAmount - a.investedAmount
    if (b.goldGrams !== a.goldGrams) return b.goldGrams - a.goldGrams
    return a.sequenceNo - b.sequenceNo
  })

  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1
  }))
})

const pyramidLayers = computed(() => rankList.value.slice(0, 10))

const pyramidBaseWidth = computed(() => {
  if (pyramidLayers.value.length === 0) return 240

  return Math.max(
    ...pyramidLayers.value.map((item, index) => getLayerWidth(item, index))
  )
})

function getLayerWidth(item, index) {
  const baseWidth = 164 + index * 46
  const contentWidth = 168 + item.nickname.length * 16
  return Math.max(baseWidth, contentWidth)
}

function formatSyncTime() {
  const now = new Date()
  rankingSyncAt.value = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

function evolveLocalRanking() {
  localRankingSeed.value = localRankingSeed.value.map((item) => {
    const deltaCash = Math.random() * 3800
    const deltaGrams = deltaCash / 780

    return {
      ...item,
      investedAmount: Number((item.investedAmount + deltaCash).toFixed(2)),
      goldGrams: Number((item.goldGrams + deltaGrams).toFixed(2))
    }
  })

  rankingRows.value = localRankingSeed.value
  formatSyncTime()
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
      image: item.thumbnail,
      summary: item.summary,
      date: item.date
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
    const items = result?.data?.items || result?.data || []

    if (Array.isArray(items) && items.length > 0) {
      rankingRows.value = items.map((item, index) => ({
        nickname: item.nickname || t('home.buyerRank', { index: index + 1 }),
        goldGrams: Number(item.goldGrams || 0),
        investedAmount: Number(item.investedAmount || item.goldGrams || 0),
        sequenceNo: Number(item.sequenceNo || index + 1)
      }))
      formatSyncTime()
      return
    }

    evolveLocalRanking()
  } catch (error) {
    console.error('排行榜加载失败，使用本地实时模拟数据:', error)
    evolveLocalRanking()
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

        <div v-else class="pyramid-scroll">
          <div class="trapezoid-pyramid" :style="{ '--pyramid-width': `${pyramidBaseWidth}px` }">
            <article
              v-for="(item, index) in pyramidLayers"
              :key="item.sequenceNo"
              class="pyramid-layer"
              :class="{ top: item.rank === 1 }"
              :style="{ '--layer-width': `${getLayerWidth(item, index)}px` }"
            >
              <div class="layer-face">
                <span class="rank-no">#{{ item.rank }}</span>
                <span class="nick">{{ item.nickname }}</span>
                <span class="grams">{{ item.goldGrams.toFixed(2) }} g</span>
              </div>
            </article>
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
}

.pyramid-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.45rem 0 0.4rem;
  -webkit-overflow-scrolling: touch;
}

.pyramid-scroll::-webkit-scrollbar {
  height: 4px;
}

.pyramid-scroll::-webkit-scrollbar-thumb {
  background: rgba(203, 213, 225, 0.35);
  border-radius: 999px;
}

.trapezoid-pyramid {
  width: var(--pyramid-width);
  min-width: var(--pyramid-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.pyramid-layer {
  position: relative;
  width: var(--layer-width);
  margin-top: -1px;
}

.layer-face {
  position: relative;
  height: 3.65rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 1.1rem;
  clip-path: polygon(10% 0, 90% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, #f5e2a8 0%, #d8a84f 46%, #8d5a16 100%);
  border-top: 1px solid rgba(209, 213, 219, 0.95);
  border-bottom: 1px solid rgba(156, 163, 175, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 -8px 12px rgba(120, 76, 19, 0.18),
    0 5px 12px rgba(55, 30, 8, 0.18);
  white-space: nowrap;
}

.layer-face::before,
.layer-face::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 18%;
  pointer-events: none;
}

.layer-face::before {
  left: 0;
  clip-path: polygon(55% 0, 100% 0, 72% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(255, 249, 222, 0.55), rgba(170, 104, 20, 0.08));
}

.layer-face::after {
  right: 0;
  clip-path: polygon(0 0, 45% 0, 100% 100%, 28% 100%);
  background: linear-gradient(180deg, rgba(122, 74, 17, 0.18), rgba(255, 248, 220, 0.04));
}

.pyramid-layer.top .layer-face {
  clip-path: polygon(14% 0, 86% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, #fff5ce 0%, #e9bf67 50%, #9b6216 100%);
}

.rank-no {
  flex: 0 0 auto;
  font-size: 0.74rem;
  color: #6b7280;
  text-shadow: none;
}

.nick {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  margin: 0;
  font-size: 0.84rem;
  color: #1f2937;
  overflow: visible;
}

.grams {
  flex: 0 0 auto;
  margin-top: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: #6b3f09;
  text-shadow: none;
}

@media (max-width: 640px) {
  .layer-face {
    height: 3.3rem;
    padding: 0 0.9rem;
    gap: 0.55rem;
  }

  .nick {
    font-size: 0.78rem;
  }

  .grams,
  .rank-no {
    font-size: 0.72rem;
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
}

.gold-chain-entry span {
  margin-top: 0.08rem;
  font-size: 0.58rem;
  line-height: 1;
  font-weight: 700;
}
</style>
