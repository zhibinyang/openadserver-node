<template>
  <v-card>
    <v-card-title>Campaign Status</v-card-title>
    <v-card-text>
      <div ref="chartRef" style="height: 250px"></div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  data: {
    type: Array,
    default: () => [
      { name: 'Active', value: 12 },
      { name: 'Paused', value: 5 },
      { name: 'Ended', value: 8 },
    ],
  },
})

const chartRef = ref(null)
let chart = null

const initChart = () => {
  if (!chartRef.value) return
  
  chart = echarts.init(chartRef.value, 'dark')
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(30, 30, 30, 0.9)',
      borderColor: '#333',
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#aaa' },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#1E1E1E',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'center',
          formatter: '{total}',
          fontSize: 24,
          fontWeight: 'bold',
          color: '#fff',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        labelLine: { show: false },
        data: [
          { value: props.data.find(d => d.name === 'Active')?.value || 0, name: 'Active', itemStyle: { color: '#4CAF50' } },
          { value: props.data.find(d => d.name === 'Paused')?.value || 0, name: 'Paused', itemStyle: { color: '#FF9800' } },
          { value: props.data.find(d => d.name === 'Ended')?.value || 0, name: 'Ended', itemStyle: { color: '#9E9E9E' } },
        ],
      },
    ],
  }
  
  chart.setOption(option)
  
  // Set total in center
  const total = props.data.reduce((sum, d) => sum + d.value, 0)
  chart.setOption({
    series: [{
      label: {
        formatter: `${total}\nTotal`,
      }
    }]
  })
}

const handleResize = () => {
  chart?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>
