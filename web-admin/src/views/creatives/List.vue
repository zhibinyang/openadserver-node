<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <h1 class="text-h4">Creatives</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openForm()">
        Add Creative
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
              v-model="typeFilter"
              label="Type"
              :items="typeOptions"
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
              v-model="campaignFilter"
              label="Campaign"
              :items="campaigns"
              item-title="name"
              item-value="id"
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
        :items="filteredCreatives"
        :loading="store.loading"
        hover
        @click:row="onRowClick"
      >
        <template #item.name="{ item }">
          <div class="d-flex align-center py-2">
            <v-avatar
              :color="item.type === 'video' ? 'error' : item.type === 'native' ? 'info' : 'primary'"
              size="40"
              class="mr-3"
            >
              <v-icon :icon="getTypeIcon(item.type)" size="20" />
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ item.width }}x{{ item.height }}
              </div>
            </div>
          </div>
        </template>

        <template #item.type="{ item }">
          <v-chip :color="getTypeColor(item.type)" size="small">
            {{ item.type }}
          </v-chip>
        </template>

        <template #item.campaign="{ item }">
          <span class="text-caption">{{ getCampaignName(item.campaign_id) }}</span>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" size="small">
            {{ item.status }}
          </v-chip>
        </template>

        <template #item.actions="{ item }">
          <v-btn icon="mdi-eye" variant="text" size="small" @click.stop="preview(item)" />
          <v-btn icon="mdi-pencil" variant="text" size="small" @click.stop="openForm(item)" />
          <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click.stop="confirmDelete(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- Form Dialog -->
    <CreativeForm
      ref="formRef"
      :loading="store.loading"
      @submit="handleSubmit"
    />

    <!-- Preview Dialog -->
    <v-dialog v-model="previewDialog" max-width="600">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Creative Preview</span>
          <v-btn icon="mdi-close" variant="text" @click="previewDialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text class="text-center">
          <template v-if="previewItem?.type === 'banner'">
            <v-img
              :src="previewItem?.image_url"
              max-height="400"
              contain
            />
          </template>
          <template v-else-if="previewItem?.type === 'video'">
            <video
              :src="previewItem?.video_url"
              controls
              style="max-width: 100%; max-height: 400px"
            />
          </template>
          <template v-else>
            <v-card variant="outlined" class="pa-4">
              <div class="d-flex align-center mb-2">
                <v-avatar :src="previewItem?.icon_url" size="48" class="mr-3" />
                <div class="text-left">
                  <div class="font-weight-medium">{{ previewItem?.title }}</div>
                  <div class="text-caption text-medium-emphasis">Native Ad</div>
                </div>
              </div>
              <div class="text-body-2 text-left">{{ previewItem?.description }}</div>
            </v-card>
          </template>
        </v-card-text>
        <v-divider />
        <v-card-text>
          <v-row>
            <v-col cols="6">
              <div class="text-caption text-medium-emphasis">Size</div>
              <div>{{ previewItem?.width }}x{{ previewItem?.height }}</div>
            </v-col>
            <v-col cols="6">
              <div class="text-caption text-medium-emphasis">Click URL</div>
              <div class="text-truncate">{{ previewItem?.click_url || '-' }}</div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      ref="confirmRef"
      title="Delete Creative"
      :message="`Are you sure you want to delete '${selectedCreative?.name}'?`"
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
import { useCreativeStore } from '@/stores/creative'
import api from '@/api/client'
import CreativeForm from '@/components/creatives/CreativeForm.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const store = useCreativeStore()

const formRef = ref(null)
const confirmRef = ref(null)
const search = ref('')
const typeFilter = ref(null)
const statusFilter = ref(null)
const campaignFilter = ref(null)
const campaigns = ref([])
const selectedCreative = ref(null)
const previewDialog = ref(false)
const previewItem = ref(null)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Campaign', key: 'campaign', sortable: false },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]

const typeOptions = [
  { title: 'Banner', value: 'banner' },
  { title: 'Video', value: 'video' },
  { title: 'Native', value: 'native' },
]

const statusFilterOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
]

const filteredCreatives = computed(() => {
  let result = store.creatives

  if (search.value) {
    const s = search.value.toLowerCase()
    result = result.filter(c =>
      c.name?.toLowerCase().includes(s)
    )
  }

  if (typeFilter.value) {
    result = result.filter(c => c.type === typeFilter.value)
  }

  if (statusFilter.value) {
    result = result.filter(c => c.status === statusFilter.value)
  }

  if (campaignFilter.value) {
    result = result.filter(c => c.campaign_id === campaignFilter.value)
  }

  return result
})

function getTypeIcon(type) {
  const icons = {
    banner: 'mdi-image',
    video: 'mdi-video',
    native: 'mdi-text-box',
  }
  return icons[type] || 'mdi-file'
}

function getTypeColor(type) {
  const colors = {
    banner: 'primary',
    video: 'error',
    native: 'info',
  }
  return colors[type] || 'default'
}

function getStatusColor(status) {
  const colors = {
    active: 'success',
    inactive: 'warning',
  }
  return colors[status] || 'default'
}

function getCampaignName(id) {
  const campaign = campaigns.value.find(c => c.id === id)
  return campaign?.name || '-'
}

function openForm(creative = null) {
  formRef.value?.open(creative)
}

function preview(creative) {
  previewItem.value = creative
  previewDialog.value = true
}

function onRowClick(event, { item }) {
  router.push(`/creatives/${item.id}`)
}

async function handleSubmit({ id, data, isEdit }) {
  try {
    if (isEdit) {
      await store.updateCreative(id, data)
      snackbar.value = { show: true, message: 'Creative updated', color: 'success' }
    } else {
      await store.createCreative(data)
      snackbar.value = { show: true, message: 'Creative created', color: 'success' }
    }
    formRef.value?.close()
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function confirmDelete(creative) {
  selectedCreative.value = creative
  const confirmed = await confirmRef.value?.open()
  if (confirmed) {
    try {
      await store.deleteCreative(creative.id)
      snackbar.value = { show: true, message: 'Creative deleted', color: 'success' }
    } catch (e) {
      snackbar.value = { show: true, message: e.message, color: 'error' }
    }
  }
}

async function loadCampaigns() {
  try {
    const response = await api.getCampaigns()
    campaigns.value = response.data
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  store.fetchCreatives()
  loadCampaigns()
})
</script>
