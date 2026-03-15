<template>
  <v-card>
    <v-card-text>
      <div class="d-flex align-center justify-space-between">
        <div>
          <div class="text-caption text-medium-emphasis">{{ title }}</div>
          <div class="text-h4 font-weight-bold" :class="colorClass">{{ formattedValue }}</div>
          <div v-if="trend !== null" class="text-caption mt-1">
            <v-icon :color="trend >= 0 ? 'success' : 'error'" size="small">
              {{ trend >= 0 ? 'mdi-trending-up' : 'mdi-trending-down' }}
            </v-icon>
            <span :class="trend >= 0 ? 'text-success' : 'text-error'">
              {{ Math.abs(trend) }}%
            </span>
            <span class="text-medium-emphasis"> vs last period</span>
          </div>
        </div>
        <v-avatar :color="iconBgColor" size="48">
          <v-icon :icon="icon" :color="iconColor" size="24" />
        </v-avatar>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  value: { type: [Number, String], required: true },
  icon: { type: String, default: 'mdi-chart-bar' },
  color: { type: String, default: 'primary' },
  trend: { type: Number, default: null },
  format: { type: String, default: 'number' }, // number, currency, percent
})

const colorClass = computed(() => `text-${props.color}`)

const iconBgColor = computed(() => `${props.color}-lighten-4`)

const iconColor = computed(() => props.color)

const formattedValue = computed(() => {
  if (props.format === 'currency') {
    return '$' + Number(props.value).toLocaleString()
  }
  if (props.format === 'percent') {
    return props.value + '%'
  }
  return Number(props.value).toLocaleString()
})
</script>
