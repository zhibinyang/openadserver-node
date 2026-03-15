<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <h1 class="text-h4">Campaigns</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openForm()">
        Add Campaign
      </v-btn>
    </div>

    <!-- Filters -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="search"
              label="Search"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="statusFilter"
              label="Status"
              :items="statusFilterOptions"
              variant="outlined"
              density="compact"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="advertiserFilter"
              label="Advertiser"
              :items="advertisers"
              item-title="name"
              item-value="id"
              variant="outlined"
              density="compact"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="bidTypeFilter"
              label="Bid Type"
              :items="bidTypeOptions"
              variant="outlined"
              density="compact"
              hide-details
              clearable
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Data Table -->
    <v-card>
      <v-data-table
        :headers="headers"
        :items="filteredCampaigns"
        :loading="store.loading"
        hover
        @click:row="onRowClick"
      >
        <template #item.name="{ item }">
          <div>
            <div class="font-weight-medium">{{ item.name }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ getAdvertiserName(item.advertiser_id) }}
            </div>
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" size="small">
            {{ item.status }}
          </v-chip>
        </template>

        <template #item.budget="{ item }">
          <div>
            <div>${{ Number(item.budget || 0).toLocaleString() }}</div>
            <div class="text-caption text-medium-emphasis">
              Daily: ${{ Number(item.daily_budget || 0).toLocaleString() }}
            </div>
          </div>
        </template>

        <template #item.bid_type="{ item }">
          <v-chip size="small" variant="outlined">
            {{ item.bid_type?.toUpperCase() }}
          </v-chip>
        </template>

        <template #item.date_range="{ item }">
          <div class="text-caption">
            <div>{{ formatDate(item.start_date) }}</div>
            <div class="text-medium-emphasis">to {{ formatDate(item.end_date) }}</div>
          </div>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            :icon="item.status === 'active' ? 'mdi-pause' : 'mdi-play'"
            variant="text"
            size="small"
            @click.stop="toggleStatus(item)"
          />
          <v-btn icon="mdi-pencil" variant="text" size="small" @click.stop="openForm(item)" />
          <v-btn icon="mdi-content-copy" variant="text" size="small" @click.stop="duplicate(item)" />
          <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click.stop="confirmDelete(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- Form Dialog -->
    <CampaignForm
      ref="formRef"
      :loading="store.loading"
      @submit="handleSubmit"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      ref="confirmRef"
      title="Delete Campaign"
      :message="`Are you sure you want to delete '${selectedCampaign?.name}'?`"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCampaignStore } from '@/stores/campaign'
import api from '@/api/client'
import CampaignForm from '@/components/campaigns/CampaignForm.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const store = useCampaignStore()

const formRef = ref(null)
const confirmRef = ref(null)
const search = ref('')
const statusFilter = ref(null)
const advertiserFilter = ref(null)
const bidTypeFilter = ref(null)
const advertisers = ref([])
const selectedCampaign = ref(null)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Budget', key: 'budget', sortable: true },
  { title: 'Bid Type', key: 'bid_type', sortable: true },
  { title: 'Schedule', key: 'date_range', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]

const statusFilterOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Paused', value: 'paused' },
  { title: 'Draft', value: 'draft' },
  { title: 'Ended', value: 'ended' },
]

const bidTypeOptions = [
  { title: 'CPM', value: 'cpm' },
  { title: 'CPC', value: 'cpc' },
  { title: 'CPA', value: 'cpa' },
]

const filteredCampaigns = computed(() => {
  let result = store.campaigns

  if (search.value) {
    const s = search.value.toLowerCase()
    result = result.filter(c =>
      c.name?.toLowerCase().includes(s)
    )
  }

  if (statusFilter.value) {
    result = result.filter(c => c.status === statusFilter.value)
  }

  if (advertiserFilter.value) {
    result = result.filter(c => c.advertiser_id === advertiserFilter.value)
  }

  if (bidTypeFilter.value) {
    result = result.filter(c => c.bid_type === bidTypeFilter.value)
  }

  return result
})

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

function getAdvertiserName(id) {
  const advertiser = advertisers.value.find(a => a.id === id)
  return advertiser?.name || '-'
}

function openForm(campaign = null) {
  formRef.value?.open(campaign)
}

function onRowClick(event, { item }) {
  router.push(`/campaigns/${item.id}`)
}

async function handleSubmit({ id, data, isEdit }) {
  try {
    if (isEdit) {
      await store.updateCampaign(id, data)
      snackbar.value = { show: true, message: 'Campaign updated', color: 'success' }
    } else {
      await store.createCampaign(data)
      snackbar.value = { show: true, message: 'Campaign created', color: 'success' }
    }
    formRef.value?.close()
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function toggleStatus(campaign) {
  const newStatus = campaign.status === 'active' ? 'paused' : 'active'
  try {
    await store.updateCampaign(campaign.id, { ...campaign, status: newStatus })
    snackbar.value = { show: true, message: `Campaign ${newStatus}`, color: 'success' }
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function duplicate(campaign) {
  try {
    const { id, created_at, ...data } = campaign
    await store.createCampaign({
      ...data,
      name: `${campaign.name} (Copy)`,
      status: 'draft',
    })
    snackbar.value = { show: true, message: 'Campaign duplicated', color: 'success' }
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function confirmDelete(campaign) {
  selectedCampaign.value = campaign
  const confirmed = await confirmRef.value?.open()
  if (confirmed) {
    try {
      await store.deleteCampaign(campaign.id)
      snackbar.value = { show: true, message: 'Campaign deleted', color: 'success' }
    } catch (e) {
      snackbar.value = { show: true, message: e.message, color: 'error' }
    }
  }
}

async function loadAdvertisers() {
  try {
    const response = await api.getAdvertisers()
    advertisers.value = response.data
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  store.fetchCampaigns()
  loadAdvertisers()
})
</script>
