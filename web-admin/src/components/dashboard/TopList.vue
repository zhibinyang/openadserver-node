<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <span>{{ title }}</span>
      <v-select
        v-model="sortBy"
        :items="sortOptions"
        density="compact"
        hide-details
        style="max-width: 150px"
      />
    </v-card-title>
    <v-list>
      <v-list-item
        v-for="(item, index) in sortedItems"
        :key="item.id"
        :to="item.link"
      >
        <template #prepend>
          <v-avatar :color="getRankColor(index)" size="32">
            {{ index + 1 }}
          </v-avatar>
        </template>
        <v-list-item-title>{{ item.name }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ item.advertiser || item.status }}
        </v-list-item-subtitle>
        <template #append>
          <div class="text-right">
            <div class="font-weight-bold">{{ formatValue(item[sortBy]) }}</div>
            <div class="text-caption text-medium-emphasis">{{ sortBy }}</div>
          </div>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Top Items' },
  items: { type: Array, default: () => [] },
})

const sortBy = ref('spend')
const sortOptions = ['spend', 'impressions', 'clicks']

const sortedItems = computed(() => {
  return [...props.items]
    .sort((a, b) => (b[sortBy.value] || 0) - (a[sortBy.value] || 0))
    .slice(0, 5)
})

const getRankColor = (index) => {
  const colors = ['amber', 'grey-lighten-1', 'orange-darken-2']
  return colors[index] || 'surface-variant'
}

const formatValue = (value) => {
  if (sortBy.value === 'spend') {
    return '$' + Number(value || 0).toLocaleString()
  }
  return Number(value || 0).toLocaleString()
}
</script>
