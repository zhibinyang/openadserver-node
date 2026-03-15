<template>
  <div>
    <!-- Breadcrumbs -->
    <v-breadcrumbs :items="breadcrumbs" class="px-0 mb-4" />

    <!-- Loading -->
    <v-progress-linear v-if="loading && !advertiser" indeterminate />

    <!-- Not Found -->
    <v-alert v-else-if="!advertiser" type="error" class="mb-4">
      Advertiser not found
    </v-alert>

    <!-- Content -->
    <template v-else>
      <!-- Header -->
      <v-card class="mb-4">
        <v-card-text>
          <div class="d-flex justify-space-between align-start">
            <div class="d-flex align-center">
              <v-avatar color="primary" size="64" class="mr-4">
                <span class="text-h5">{{ advertiser.name?.charAt(0)?.toUpperCase() }}</span>
              </v-avatar>
              <div>
                <h1 class="text-h4">{{ advertiser.name }}</h1>
                <div class="d-flex align-center mt-1">
                  <v-chip :color="getStatusColor(advertiser.status)" size="small" class="mr-2">
                    {{ advertiser.status }}
                  </v-chip>
                  <span class="text-caption text-medium-emphasis">
                    ID: {{ advertiser.id }}
                  </span>
                </div>
              </div>
            </div>
            <div>
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

      <!-- Info Cards -->
      <v-row>
        <!-- Contact Info -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>Contact Information</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item prepend-icon="mdi-email">
                <v-list-item-title>{{ advertiser.contact_email || '-' }}</v-list-item-title>
                <v-list-item-subtitle>Email</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-phone">
                <v-list-item-title>{{ advertiser.contact_phone || '-' }}</v-list-item-title>
                <v-list-item-subtitle>Phone</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-calendar">
                <v-list-item-title>{{ formatDate(advertiser.created_at) }}</v-list-item-title>
                <v-list-item-subtitle>Created</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <v-divider />
            <v-card-text v-if="advertiser.description">
              <div class="text-caption text-medium-emphasis mb-1">Description</div>
              <div>{{ advertiser.description }}</div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Stats -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>Statistics</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="6">
                  <div class="text-h4 text-primary">{{ campaigns.length }}</div>
                  <div class="text-caption text-medium-emphasis">Campaigns</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-h4 text-success">{{ activeCampaigns }}</div>
                  <div class="text-caption text-medium-emphasis">Active</div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Campaigns Table -->
      <v-card class="mt-4">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Campaigns</span>
          <v-btn color="primary" size="small" prepend-icon="mdi-plus" to="/campaigns">
            Add Campaign
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-data-table
          :headers="campaignHeaders"
          :items="campaigns"
          :loading="campaignsLoading"
          hover
          @click:row="onCampaignClick"
        >
          <template #item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" size="small">
              {{ item.status }}
            </v-chip>
          </template>
          <template #item.budget="{ item }">
            ${{ Number(item.budget || 0).toLocaleString() }}
          </template>
          <template #item.start_date="{ item }">
            {{ formatDate(item.start_date) }}
          </template>
        </v-data-table>
      </v-card>
    </template>

    <!-- Form Dialog -->
    <AdvertiserForm
      ref="formRef"
      :loading="loading"
      @submit="handleSubmit"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      ref="confirmRef"
      title="Delete Advertiser"
      :message="`Are you sure you want to delete '${advertiser?.name}'?`"
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
import { useAdvertiserStore } from '@/stores/advertiser'
import api from '@/api/client'
import AdvertiserForm from '@/components/advertisers/AdvertiserForm.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useAdvertiserStore()

const formRef = ref(null)
const confirmRef = ref(null)
const campaigns = ref([])
const campaignsLoading = ref(false)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

const breadcrumbs = computed(() => [
  { title: 'Advertisers', to: '/advertisers' },
  { title: store.currentAdvertiser?.name || 'Detail' },
])

const advertiser = computed(() => store.currentAdvertiser)
const loading = computed(() => store.loading)

const activeCampaigns = computed(() => {
  return campaigns.value.filter(c => c.status === 'active').length
})

const campaignHeaders = [
  { title: 'Name', key: 'name' },
  { title: 'Status', key: 'status' },
  { title: 'Budget', key: 'budget' },
  { title: 'Start Date', key: 'start_date' },
]

function getStatusColor(status) {
  const colors = {
    active: 'success',
    inactive: 'warning',
    suspended: 'error',
    paused: 'warning',
  }
  return colors[status] || 'default'
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

async function loadAdvertiser() {
  await store.fetchAdvertiser(route.params.id)
  await loadCampaigns()
}

async function loadCampaigns() {
  if (!advertiser.value) return
  campaignsLoading.value = true
  try {
    const response = await api.getCampaigns(advertiser.value.id)
    campaigns.value = response.data
  } catch (e) {
    console.error(e)
  } finally {
    campaignsLoading.value = false
  }
}

function openForm() {
  formRef.value?.open(advertiser.value)
}

async function handleSubmit({ id, data, isEdit }) {
  try {
    await store.updateAdvertiser(id, data)
    snackbar.value = { show: true, message: 'Advertiser updated', color: 'success' }
    formRef.value?.close()
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function confirmDelete() {
  const confirmed = await confirmRef.value?.open()
  if (confirmed) {
    try {
      await store.deleteAdvertiser(advertiser.value.id)
      router.push('/advertisers')
    } catch (e) {
      snackbar.value = { show: true, message: e.message, color: 'error' }
    }
  }
}

function onCampaignClick(event, { item }) {
  router.push(`/campaigns/${item.id}`)
}

watch(() => route.params.id, loadAdvertiser)

onMounted(loadAdvertiser)
</script>
