<template>
  <div>
    <!-- Breadcrumbs -->
    <v-breadcrumbs :items="breadcrumbs" class="px-0 mb-4" />

    <!-- Loading -->
    <v-progress-linear v-if="loading && !campaign" indeterminate />

    <!-- Not Found -->
    <v-alert v-else-if="!campaign" type="error" class="mb-4">
      Campaign not found
    </v-alert>

    <!-- Content -->
    <template v-else>
      <!-- Header -->
      <v-card class="mb-4">
        <v-card-text>
          <div class="d-flex justify-space-between align-start">
            <div>
              <div class="d-flex align-center mb-2">
                <v-chip :color="getStatusColor(campaign.status)" size="small" class="mr-3">
                  {{ campaign.status }}
                </v-chip>
                <v-chip size="small" variant="outlined" class="mr-3">
                  {{ campaign.bid_type?.toUpperCase() }}
                </v-chip>
              </div>
              <h1 class="text-h4">{{ campaign.name }}</h1>
              <router-link :to="`/advertisers/${campaign.advertiser_id}`" class="text-decoration-none">
                <v-icon size="small" class="mr-1">mdi-account</v-icon>
                {{ advertiser?.name || 'Unknown Advertiser' }}
              </router-link>
            </div>
            <div>
              <v-btn
                :color="campaign.status === 'active' ? 'warning' : 'success'"
                variant="outlined"
                class="mr-2"
                @click="toggleStatus"
              >
                <v-icon start>{{ campaign.status === 'active' ? 'mdi-pause' : 'mdi-play' }}</v-icon>
                {{ campaign.status === 'active' ? 'Pause' : 'Activate' }}
              </v-btn>
              <v-btn variant="outlined" class="mr-2" @click="openForm">
                <v-icon start>mdi-pencil</v-icon>
                Edit
              </v-btn>
              <v-btn color="error" variant="outlined" @click="confirmDelete">
                <v-icon start>mdi-delete</v-icon>
                Delete
              </v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Stats Cards -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text class="text-center">
              <div class="text-h5 text-primary">{{ stats.impressions }}</div>
              <div class="text-caption text-medium-emphasis">Impressions</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text class="text-center">
              <div class="text-h5 text-success">{{ stats.clicks }}</div>
              <div class="text-caption text-medium-emphasis">Clicks</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text class="text-center">
              <div class="text-h5 text-info">{{ stats.ctr }}%</div>
              <div class="text-caption text-medium-emphasis">CTR</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text class="text-center">
              <div class="text-h5 text-warning">${{ stats.spend }}</div>
              <div class="text-caption text-medium-emphasis">Spend</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Info Cards -->
      <v-row>
        <!-- Budget & Bidding -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>Budget & Bidding</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item>
                <v-list-item-title>Total Budget</v-list-item-title>
                <v-list-item-subtitle>
                  ${{ Number(campaign.budget || 0).toLocaleString() }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Daily Budget</v-list-item-title>
                <v-list-item-subtitle>
                  ${{ Number(campaign.daily_budget || 0).toLocaleString() }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Bid Type</v-list-item-title>
                <v-list-item-subtitle>
                  {{ campaign.bid_type?.toUpperCase() }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Bid Amount</v-list-item-title>
                <v-list-item-subtitle>
                  ${{ Number(campaign.bid_amount || 0).toFixed(2) }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>

        <!-- Schedule -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>Schedule</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item prepend-icon="mdi-calendar-start">
                <v-list-item-title>Start Date</v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(campaign.start_date) }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-calendar-end">
                <v-list-item-title>End Date</v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(campaign.end_date) }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-calendar">
                <v-list-item-title>Duration</v-list-item-title>
                <v-list-item-subtitle>
                  {{ getDuration() }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <v-divider />
            <v-card-text v-if="campaign.description">
              <div class="text-caption text-medium-emphasis mb-1">Description</div>
              <div>{{ campaign.description }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Creatives Table -->
      <v-card class="mt-4">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Creatives</span>
          <v-btn color="primary" size="small" prepend-icon="mdi-plus" to="/creatives">
            Add Creative
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-data-table
          :headers="creativeHeaders"
          :items="creatives"
          :loading="creativesLoading"
          hover
          @click:row="onCreativeClick"
        >
          <template #item.type="{ item }">
            <v-chip size="small" variant="outlined">
              {{ item.type }}
            </v-chip>
          </template>
          <template #item.size="{ item }">
            {{ item.width }}x{{ item.height }}
          </template>
          <template #item.status="{ item }">
            <v-chip :color="item.status === 'active' ? 'success' : 'default'" size="small">
              {{ item.status }}
            </v-chip>
          </template>
        </v-data-table>
      </v-card>

      <!-- Targeting Rules -->
      <v-card class="mt-4">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Targeting Rules</span>
          <v-btn color="primary" size="small" prepend-icon="mdi-plus" to="/targeting">
            Add Rule
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-data-table
          :headers="targetingHeaders"
          :items="targetingRules"
          :loading="targetingLoading"
        >
          <template #item.rule_type="{ item }">
            <v-chip size="small" variant="outlined">
              {{ item.rule_type }}
            </v-chip>
          </template>
          <template #item.is_include="{ item }">
            <v-chip :color="item.is_include ? 'success' : 'error'" size="small">
              {{ item.is_include ? 'INCLUDE' : 'EXCLUDE' }}
            </v-chip>
          </template>
          <template #item.rule_value="{ item }">
            <span class="text-caption">{{ formatRuleValue(item.rule_value) }}</span>
          </template>
        </v-data-table>
      </v-card>
    </template>

    <!-- Form Dialog -->
    <CampaignForm
      ref="formRef"
      :loading="loading"
      @submit="handleSubmit"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      ref="confirmRef"
      title="Delete Campaign"
      :message="`Are you sure you want to delete '${campaign?.name}'?`"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCampaignStore } from '@/stores/campaign'
import api from '@/api/client'
import CampaignForm from '@/components/campaigns/CampaignForm.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useCampaignStore()

const formRef = ref(null)
const confirmRef = ref(null)
const advertiser = ref(null)
const creatives = ref([])
const creativesLoading = ref(false)
const targetingRules = ref([])
const targetingLoading = ref(false)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

const stats = ref({
  impressions: '0',
  clicks: '0',
  ctr: '0.00',
  spend: '0',
})

const breadcrumbs = computed(() => [
  { title: 'Campaigns', to: '/campaigns' },
  { title: store.currentCampaign?.name || 'Detail' },
])

const campaign = computed(() => store.currentCampaign)
const loading = computed(() => store.loading)

const creativeHeaders = [
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type' },
  { title: 'Size', key: 'size' },
  { title: 'Status', key: 'status' },
]

const targetingHeaders = [
  { title: 'Type', key: 'rule_type' },
  { title: 'Mode', key: 'is_include' },
  { title: 'Value', key: 'rule_value' },
]

function getStatusColor(status) {
  const colors = {
    active: 'success',
    paused: 'warning',
    draft: 'info',
    ended: 'default',
  }
  return colors[status] || 'default'
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

function getDuration() {
  if (!campaign.value?.start_date) return '-'
  const start = new Date(campaign.value.start_date)
  const end = campaign.value.end_date ? new Date(campaign.value.end_date) : new Date()
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  return `${days} days`
}

function formatRuleValue(value) {
  if (!value) return '-'
  const parts = []
  if (value.countries) parts.push(`Countries: ${value.countries.join(', ')}`)
  if (value.os) parts.push(`OS: ${value.os.join(', ')}`)
  if (value.browser) parts.push(`Browser: ${value.browser.join(', ')}`)
  return parts.length > 0 ? parts.join('; ') : JSON.stringify(value)
}

async function loadCampaign() {
  await store.fetchCampaign(route.params.id)
  await Promise.all([
    loadAdvertiser(),
    loadCreatives(),
    loadTargeting(),
  ])
}

async function loadAdvertiser() {
  if (!campaign.value?.advertiser_id) return
  try {
    const response = await api.getAdvertisers()
    advertiser.value = response.data.find(a => a.id === campaign.value.advertiser_id)
  } catch (e) {
    console.error(e)
  }
}

async function loadCreatives() {
  if (!campaign.value) return
  creativesLoading.value = true
  try {
    const response = await api.getCreatives(campaign.value.id)
    creatives.value = response.data
  } catch (e) {
    console.error(e)
  } finally {
    creativesLoading.value = false
  }
}

async function loadTargeting() {
  if (!campaign.value) return
  targetingLoading.value = true
  try {
    const response = await api.getTargetingRules(campaign.value.id)
    targetingRules.value = response.data
  } catch (e) {
    console.error(e)
  } finally {
    targetingLoading.value = false
  }
}

function openForm() {
  formRef.value?.open(campaign.value)
}

async function handleSubmit({ id, data, isEdit }) {
  try {
    await store.updateCampaign(id, data)
    snackbar.value = { show: true, message: 'Campaign updated', color: 'success' }
    formRef.value?.close()
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function toggleStatus() {
  const newStatus = campaign.value.status === 'active' ? 'paused' : 'active'
  try {
    await store.updateCampaign(campaign.value.id, { ...campaign.value, status: newStatus })
    snackbar.value = { show: true, message: `Campaign ${newStatus}`, color: 'success' }
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function confirmDelete() {
  const confirmed = await confirmRef.value?.open()
  if (confirmed) {
    try {
      await store.deleteCampaign(campaign.value.id)
      router.push('/campaigns')
    } catch (e) {
      snackbar.value = { show: true, message: e.message, color: 'error' }
    }
  }
}

function onCreativeClick(event, { item }) {
  router.push(`/creatives/${item.id}`)
}

watch(() => route.params.id, loadCampaign)

onMounted(loadCampaign)
</script>
