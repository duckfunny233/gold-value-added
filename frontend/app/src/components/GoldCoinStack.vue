<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  count: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: '/影子金币10g黄金.png'
  },
  type: {
    type: String,
    default: 'gold' // 'gold' | 'silver'
  },
  // 新增买入动画触发器
  buyAnimationTrigger: {
    type: Number,
    default: 0
  },
  // 买入的克重
  buyGrams: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['animationComplete'])

// 金币堆叠配置
const MAX_VISIBLE_COINS = 5 // 最多显示5个金币堆叠
const COIN_OFFSET_Y = 12 // 每个金币的垂直偏移（像素）

// 动画状态
const isHovering = ref(false)
const buyAnimating = ref(false)
const flyingCoin = ref({
  show: false,
  y: 0,
  scale: 0.5,
  opacity: 0
})

// 数字跳动动画
const animatedCount = ref(props.count)
const countAnimating = ref(false)

// 监听数量变化，触发数字跳动
watch(() => props.count, (newVal, oldVal) => {
  if (newVal !== oldVal && !countAnimating.value) {
    animateCountChange(oldVal, newVal)
  }
})

// 监听买入动画触发
watch(() => props.buyAnimationTrigger, () => {
  if (props.buyGrams > 0) {
    triggerBuyAnimation()
  }
})

// 数字跳动动画
const animateCountChange = (from, to) => {
  countAnimating.value = true
  const duration = 600
  const start = performance.now()
  
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedCount.value = Math.round(from + (to - from) * eased)
    
    if (progress < 1) {
      requestAnimationFrame(tick)
    } else {
      animatedCount.value = to
      countAnimating.value = false
    }
  }
  requestAnimationFrame(tick)
}

// 买入飞入动画
const triggerBuyAnimation = () => {
  buyAnimating.value = true
  
  // 初始化飞入状态
  flyingCoin.value = {
    show: true,
    y: 120,
    scale: 0.6,
    opacity: 0
  }
  
  const duration = 900
  const start = performance.now()
  
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration)
    
    // 飞入 + 弹跳效果
    let eased
    if (progress < 0.6) {
      // 飞入阶段
      const p = progress / 0.6
      eased = 1 - Math.pow(1 - p, 3)
      flyingCoin.value.y = 120 * (1 - eased)
      flyingCoin.value.scale = 0.6 + 0.5 * eased
      flyingCoin.value.opacity = Math.min(1, p * 2)
    } else if (progress < 0.8) {
      // 弹跳上升
      const p = (progress - 0.6) / 0.2
      flyingCoin.value.y = -15 * Math.sin(p * Math.PI / 2)
      flyingCoin.value.scale = 1.1
    } else {
      // 回落稳定
      const p = (progress - 0.8) / 0.2
      flyingCoin.value.y = -15 * (1 - p)
      flyingCoin.value.scale = 1.1 - 0.1 * p
    }
    
    if (progress < 1) {
      requestAnimationFrame(tick)
    } else {
      // 动画完成，隐藏飞入金币，显示正常堆叠
      flyingCoin.value.show = false
      buyAnimating.value = false
      emit('animationComplete')
    }
  }
  requestAnimationFrame(tick)
}

// 计算可见金币数量（最多5个）
const visibleCoins = computed(() => {
  return Math.min(props.count, MAX_VISIBLE_COINS)
})

// 计算是否需要显示 "+N" 标记
const overflowCount = computed(() => {
  return props.count > MAX_VISIBLE_COINS ? props.count - MAX_VISIBLE_COINS : 0
})

// 获取金币样式
const getCoinStyle = (index) => {
  const baseDelay = index * 0.15
  return {
    transform: `translateY(${-index * COIN_OFFSET_Y}px)`,
    zIndex: MAX_VISIBLE_COINS - index,
    animationDelay: `${baseDelay}s`
  }
}
</script>

<template>
  <div 
    class="coin-stack-container"
    :class="{ 'is-hovering': isHovering, 'is-buying': buyAnimating }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- 金币堆叠 -->
    <div class="coin-stack">
      <!-- 飞入动画金币 -->
      <div
        v-if="flyingCoin.show"
        class="flying-coin"
        :style="{
          transform: `translateY(${flyingCoin.y}px) scale(${flyingCoin.scale})`,
          opacity: flyingCoin.opacity
        }"
      >
        <img :src="image" alt="coin" />
      </div>
      
      <!-- 堆叠的金币 -->
      <div 
        v-for="index in visibleCoins" 
        :key="index"
        class="stacked-coin"
        :class="[`coin-${index - 1}`, { 'bounce-in': buyAnimating && index === visibleCoins }]"
        :style="getCoinStyle(index - 1)"
      >
        <img :src="image" alt="coin" />
      </div>
      
      <!-- 溢出标记 -->
      <div v-if="overflowCount > 0" class="overflow-badge">
        +{{ overflowCount }}
      </div>
    </div>
    
    <!-- 持有数量显示 -->
    <div class="count-display" :class="{ 'count-pulse': countAnimating }">
      <span class="count-number">{{ animatedCount }}</span>
      <span class="count-label">份</span>
    </div>
  </div>
</template>

<style scoped>
.coin-stack-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: 140px;
}

.coin-stack {
  position: relative;
  width: 80px;
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

/* 堆叠的金币 */
.stacked-coin {
  position: absolute;
  width: 60px;
  height: 60px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: float 3s ease-in-out infinite;
}

.stacked-coin img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4)) 
          drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  transition: all 0.3s ease;
}

/* 3D阴影效果 */
.stacked-coin::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 50px;
  height: 12px;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, transparent 70%);
  border-radius: 50%;
  transition: all 0.3s ease;
}

/* 常态微动动画 - 上下浮动 */
@keyframes float {
  0%, 100% {
    transform: translateY(var(--float-y, 0)) rotate(0deg);
  }
  25% {
    transform: translateY(calc(var(--float-y, 0) - 3px)) rotate(0.5deg);
  }
  50% {
    transform: translateY(var(--float-y, 0)) rotate(0deg);
  }
  75% {
    transform: translateY(calc(var(--float-y, 0) + 3px)) rotate(-0.5deg);
  }
}

/* 每个金币不同的浮动延迟 */
.coin-0 { --float-y: 0px; animation-delay: 0s; }
.coin-1 { --float-y: -12px; animation-delay: 0.2s; }
.coin-2 { --float-y: -24px; animation-delay: 0.4s; }
.coin-3 { --float-y: -36px; animation-delay: 0.6s; }
.coin-4 { --float-y: -48px; animation-delay: 0.8s; }

/* 悬浮效果 - 放大 + 边缘发光 */
.coin-stack-container.is-hovering .stacked-coin {
  animation-play-state: paused;
}

.coin-stack-container.is-hovering .stacked-coin img {
  transform: scale(1.15);
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5))
          drop-shadow(0 0 20px rgba(255, 193, 7, 0.6))
          drop-shadow(0 0 40px rgba(255, 193, 7, 0.3));
}

.coin-stack-container.is-hovering .stacked-coin::after {
  width: 60px;
  height: 16px;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 0%, transparent 70%);
}

/* 买入弹跳动画 */
@keyframes bounceIn {
  0% {
    transform: translateY(80px) scale(0.5);
    opacity: 0;
  }
  50% {
    transform: translateY(-20px) scale(1.2);
    opacity: 1;
  }
  70% {
    transform: translateY(5px) scale(0.95);
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.bounce-in {
  animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards !important;
}

/* 飞入动画金币 */
.flying-coin {
  position: absolute;
  width: 60px;
  height: 60px;
  z-index: 100;
  pointer-events: none;
}

.flying-coin img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5))
          drop-shadow(0 0 30px rgba(255, 193, 7, 0.8));
}

/* 溢出标记 */
.overflow-badge {
  position: absolute;
  top: -5px;
  right: -10px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(238, 90, 90, 0.4);
  z-index: 10;
}

/* 持有数量显示 */
.count-display {
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  gap: 4px;
  transition: transform 0.2s ease;
}

.count-number {
  font-size: 24px;
  font-weight: bold;
  color: #f2c24a;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  font-variant-numeric: tabular-nums;
}

.count-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

/* 数字跳动效果 */
.count-pulse .count-number {
  animation: countPulse 0.6s ease;
}

@keyframes countPulse {
  0% {
    transform: scale(1);
    color: #f2c24a;
  }
  50% {
    transform: scale(1.3);
    color: #fff;
    text-shadow: 0 0 20px rgba(242, 194, 74, 0.8);
  }
  100% {
    transform: scale(1);
    color: #f2c24a;
  }
}

/* 白银样式 */
:deep(.silver) .stacked-coin img {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))
          drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

:deep(.silver) .coin-stack-container.is-hovering .stacked-coin img {
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5))
          drop-shadow(0 0 20px rgba(192, 192, 192, 0.6))
          drop-shadow(0 0 40px rgba(192, 192, 192, 0.3));
}

:deep(.silver) .count-number {
  color: #c0c0c0;
}

:deep(.silver) .count-pulse .count-number {
  color: #c0c0c0;
}

:deep(.silver) .count-pulse .count-number {
  50% {
    color: #fff;
    text-shadow: 0 0 20px rgba(192, 192, 192, 0.8);
  }
  100% {
    color: #c0c0c0;
  }
}
</style>
