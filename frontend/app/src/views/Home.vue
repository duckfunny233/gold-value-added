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
  { nickname: '华尔街之狼', goldGrams: 2568.50, investedAmount: 1998600, sequenceNo: 1 },
  { nickname: '黄金猎手', goldGrams: 2150.35, investedAmount: 1692500, sequenceNo: 2 },
  { nickname: '金牛骑士', goldGrams: 1872.88, investedAmount: 1461000, sequenceNo: 3 },
  { nickname: '金手指', goldGrams: 1545.42, investedAmount: 1205900, sequenceNo: 4 },
  { nickname: '点金成金', goldGrams: 1324.90, investedAmount: 1035300, sequenceNo: 5 },
  { nickname: '淘金者', goldGrams: 1110.34, investedAmount: 862900, sequenceNo: 6 },
  { nickname: '金元宝', goldGrams: 908.56, investedAmount: 702500, sequenceNo: 7 },
  { nickname: '金山银山', goldGrams: 780.10, investedAmount: 600400, sequenceNo: 8 },
  { nickname: '金戈铁马', goldGrams: 652.86, investedAmount: 500900, sequenceNo: 9 },
  { nickname: '金碧辉煌', goldGrams: 528.66, investedAmount: 410200, sequenceNo: 10 }
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
  if (pyramidLayers.value.length === 0) return 380
  return 380
})

function getClipPathPoints(item, index) {
  const totalLayers = pyramidLayers.value.length
  const maxWidth = 360
  const minWidth = 130
  const widthStep = (maxWidth - minWidth) / (totalLayers - 1)
  
  const topWidth = minWidth + index * widthStep
  
  const topLeft = ((maxWidth - topWidth) / 2 / maxWidth) * 100
  const topRight = 100 - topLeft
  
  let bottomLeft = 0
  let bottomRight = 100
  
  if (index < totalLayers - 1) {
    const bottomWidth = minWidth + (index + 1) * widthStep
    bottomLeft = ((maxWidth - bottomWidth) / 2 / maxWidth) * 100
    bottomRight = 100 - bottomLeft
  }
  
  return `${topLeft}% 0%, ${topRight}% 0%, ${bottomRight}% 100%, ${bottomLeft}% 100%`
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
    const deltaCash = Math.random() * 8500 - 1200
    const deltaGrams = deltaCash / 780

    const newGrams = Math.max(100, item.goldGrams + deltaGrams)
    const newAmount = newGrams * 780

    return {
      ...item,
      investedAmount: Number(newAmount.toFixed(2)),
      goldGrams: Number(newGrams.toFixed(2))
    }
  })

  localRankingSeed.value.sort((a, b) => {
    if (b.investedAmount !== a.investedAmount) return b.investedAmount - a.investedAmount
    if (b.goldGrams !== a.goldGrams) return b.goldGrams - a.goldGrams
    return a.sequenceNo - b.sequenceNo
  })

  localRankingSeed.value = localRankingSeed.value.map((item, index) => ({
    ...item,
    sequenceNo: index + 1
  }))

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
    evolveLocalRanking()
  } catch (error) {
    console.error('排行榜加载失败:', error)
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

        <div v-else class="pyramid-container">
          <div class="pyramid-a-shape">
            <div
              v-for="(item, index) in pyramidLayers"
              :key="item.sequenceNo"
              class="pyramid-trapezoid"
              :class="{ top: item.rank === 1, bottom: index === pyramidLayers.length - 1 }"
              :style="{ 
                '--tier-index': index
              }"
            >
              <div 
                class="trapezoid-face"
                :style="{ clipPath: `polygon(${getClipPathPoints(item, index)})` }"
              >
                <div class="tier-content">
                  <span class="rank-badge">#{{ item.rank }}</span>
                  <div class="tier-text">
                    <span class="tier-nick">{{ item.nickname }}</span>
                    <span class="tier-grams">{{ item.goldGrams.toFixed(2) }} g</span>
                  </div>
                </div>
              </div>
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
  padding: 1.5rem 0 1rem;
}

.pyramid-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 380px;
}

.pyramid-a-shape {
  position: relative;
  width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.pyramid-trapezoid {
  position: relative;
  width: 360px;
  height: 68px;
  margin-bottom: -2px;
  z-index: calc(30 - var(--tier-index));
}

.pyramid-trapezoid.top {
  height: 76px;
}

.pyramid-trapezoid.bottom {
  margin-bottom: 0;
}

.trapezoid-face {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 1.2rem;
  background: linear-gradient(180deg, #fef3c7 0%, #f59e0b 45%, #b45309 100%);
  box-shadow: 
    inset 0 2px 0 rgba(255, 255, 255, 0.8),
    inset 0 -6px 16px rgba(120, 53, 15, 0.35),
    0 4px 16px rgba(0, 0, 0, 0.25);
}

.tier-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
}

.tier-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.rank-badge {
  flex: 0 0 auto;
  font-size: 0.75rem;
  font-weight: 800;
  color: #451a03;
  background: rgba(255, 255, 255, 0.4);
  padding: 3px 8px;
  border-radius: 6px;
}

.pyramid-trapezoid.top .rank-badge {
  font-size: 0.82rem;
  background: rgba(255, 255, 255, 0.55);
}

.tier-nick {
  font-weight: 700;
  font-size: 0.88rem;
  color: #1f2937;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.4);
}

.pyramid-trapezoid.top .tier-nick {
  font-size: 0.95rem;
  color: #111827;
}

.tier-grams {
  font-size: 0.82rem;
  font-weight: 800;
  color: #451a03;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
}

.pyramid-trapezoid.top .tier-grams {
  font-size: 0.9rem;
  color: #3f1f02;
}

@media (max-width: 640px) {
  .pyramid-container {
    min-height: 480px;
  }

  .pyramid-trapezoid {
    height: 58px;
  }

  .pyramid-trapezoid.top {
    height: 66px;
  }

  .trapezoid-face {
    padding: 0.3rem 0.8rem;
  }

  .rank-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
  }

  .tier-nick {
    font-size: 0.8rem;
  }

  .tier-grams {
    font-size: 0.76rem;
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
