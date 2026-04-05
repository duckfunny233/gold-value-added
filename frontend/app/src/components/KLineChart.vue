<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { init, dispose } from 'klinecharts'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  type: {
    type: String,
    default: 'candle' // 'candle' or 'area'
  }
})

const chartContainer = ref(null)
let chart = null

onMounted(() => {
  if (chartContainer.value) {
    chart = init(chartContainer.value)
    // 閸╄櫣顢呴柊宥囩枂
    updateStyles()
    
    if (props.data && props.data.length > 0) {
      chart.applyNewData(props.data)
    }
  }
})

const updateStyles = () => {
  if (!chart) return
  chart.setStyles({
    grid: {
      show: true,
      horizontal: {
        show: true,
        size: 1,
        color: '#f0f0f0',
        style: 'dash',
        dashValue: [2, 2]
      },
      vertical: {
        show: false
      }
    },
    candle: {
      type: props.type === 'area' ? 'area' : 'candle_solid',
      area: {
        lineSize: 2,
        lineColor: '#da9e31',
        value: 'close',
        fillColor: [{
          offset: 0,
          color: 'rgba(218, 158, 49, 0.2)'
        }, {
          offset: 1,
          color: 'rgba(218, 158, 49, 0)'
        }]
      },
      bar: {
        upColor: '#ef4444',
        downColor: '#22c55e',
        noChangeColor: '#888888',
        upBorderColor: '#ef4444',
        downBorderColor: '#22c55e',
        noChangeBorderColor: '#888888',
        upWickColor: '#ef4444',
        downWickColor: '#22c55e',
        noChangeWickColor: '#888888'
      },
      tooltip: {
        showRule: 'follow_cross',
        showType: 'rect',
        labels: ['时间', '开', '收', '高', '低', '成交量'],
        values: null,
        defaultValue: 'n/a',
        rect: {
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 6,
          offsetLeft: 8,
          offsetTop: 8,
          offsetRight: 8,
          borderRadius: 4,
          borderSize: 1,
          borderColor: '#f2f3f5',
          backgroundColor: '#ffffff'
        }
      }
    }
  })
}

watch(() => props.type, () => {
  updateStyles()
})

watch(() => props.data, (newData) => {
  if (chart && newData && newData.length > 0) {
    chart.applyNewData(newData)
  }
}, { deep: true })

onUnmounted(() => {
  if (chart) {
    dispose(chartContainer.value)
  }
})
</script>

<template>
  <div ref="chartContainer" class="w-full h-full"></div>
</template>

<style scoped>
:deep(.klinecharts-container) {
  font-size: 10px !important;
}
</style>
