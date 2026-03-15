<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <span>{{ title }}</span>
      <v-btn-toggle v-model="period" density="compact" mandatory>
        <v-btn value="7d" size="small">7D</v-btn>
        <v-btn value="30d" size="small">30D</v-btn>
      </v-btn-toggle>
    </v-card-title>
    <v-card-text>
      <div ref="chartRef" style="height: 300px"></div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  title: { type: String, default: 'Trend' },
  series: { type: Array, default: () => [] },
})

const chartRef = ref(null)
const period = ref('7d')
let chart = null

const generateMockData = (days) => {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      impressions: Math.floor(Math.random() * 10000) + 1000,
      clicks: Math.floor(Math.random() * 500) + 50,
      spend: Math.floor(Math.random() * 500) + 100,
    })
  }
  return data
}

const initChart = () => {
  if (!chartRef.value) return
  
  chart = echarts.init(chartRef.value, 'dark')
  
  const days = period.value === '7d' ? 7 : 30
  const data = generateMockData(days)
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30, 30, 30, 0.9)',
      borderColor: '#333',
    },
    legend: {
      data: ['Impressions', 'Clicks', 'Spend'],
      textStyle: { color: '#aaa' },
      top: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888' },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Count',
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888' },
        splitLine: { lineStyle: { color: '#333' } },
      },
      {
        type: 'value',
        name: 'Spend ($)',
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Impressions',
        type: 'line',
        smooth: true,
        data: data.map(d => d.impressions),
        itemStyle: { color: '#1976D2' },
      },
      {
        name: 'Clicks',
        type: 'line',
        smooth: true,
        data: data.map(d => d.clicks),
        itemStyle: { color: '#4CAF50' },
      },
      {
        name: 'Spend',
        type: 'bar',
        yAxisIndex: 1,
        data: data.map(d => d.spend),
        itemStyle: { color: '#FF9800', opacity: 0.6 },
      },
    ],
  }
  
  chart.setOption(option)
}

const handleResize = () => {
  chart?.resize()
}

watch(period, () => {
  initChart()
})

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>
