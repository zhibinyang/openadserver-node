<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <h1 class="text-h4">Advertisers</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openForm()">
        Add Advertiser
      </v-btn>
    </div>

    <!-- Filters -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
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
          <v-col cols="12" md="3">
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
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Data Table -->
    <v-card>
      <v-data-table
        :headers="headers"
        :items="filteredAdvertisers"
        :loading="store.loading"
        hover
        @click:row="onRowClick"
      >
        <template #item.name="{ item }">
          <div class="d-flex align-center py-2">
            <v-avatar color="primary" size="40" class="mr-3">
              {{ item.name?.charAt(0)?.toUpperCase() || 'A' }}
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.contact_email }}</div>
            </div>
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" size="small">
            {{ item.status }}
          </v-chip>
        </template>

        <template #item.campaigns="{ item }">
          <v-chip size="small" variant="outlined">
            {{ item.campaign_count || 0 }} campaigns
          </v-chip>
        </template>

        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" variant="text" size="small" @click.stop="openForm(item)" />
          <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click.stop="confirmDelete(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- Form Dialog -->
    <AdvertiserForm
      ref="formRef"
      :loading="store.loading"
      @submit="handleSubmit"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      ref="confirmRef"
      title="Delete Advertiser"
      :message="`Are you sure you want to delete '${selectedAdvertiser?.name}'? This action cannot be undone.`"
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
import { useAdvertiserStore } from '@/stores/advertiser'
import AdvertiserForm from '@/components/advertisers/AdvertiserForm.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const store = useAdvertiserStore()

const formRef = ref(null)
const confirmRef = ref(null)
const search = ref('')
const statusFilter = ref(null)
const selectedAdvertiser = ref(null)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Campaigns', key: 'campaigns', sortable: false },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]

const statusFilterOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
  { title: 'Suspended', value: 'suspended' },
]

const filteredAdvertisers = computed(() => {
  let result = store.advertisers

  if (search.value) {
    const s = search.value.toLowerCase()
    result = result.filter(a =>
      a.name?.toLowerCase().includes(s) ||
      a.contact_email?.toLowerCase().includes(s)
    )
  }

  if (statusFilter.value) {
    result = result.filter(a => a.status === statusFilter.value)
  }

  return result
})

function getStatusColor(status) {
  const colors = {
    active: 'success',
    inactive: 'warning',
    suspended: 'error',
  }
  return colors[status] || 'default'
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

function openForm(advertiser = null) {
  formRef.value?.open(advertiser)
}

function onRowClick(event, { item }) {
  router.push(`/advertisers/${item.id}`)
}

async function handleSubmit({ id, data, isEdit }) {
  try {
    if (isEdit) {
      await store.updateAdvertiser(id, data)
      snackbar.value = { show: true, message: 'Advertiser updated', color: 'success' }
    } else {
      await store.createAdvertiser(data)
      snackbar.value = { show: true, message: 'Advertiser created', color: 'success' }
    }
    formRef.value?.close()
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function confirmDelete(advertiser) {
  selectedAdvertiser.value = advertiser
  const confirmed = await confirmRef.value?.open()
  if (confirmed) {
    try {
      await store.deleteAdvertiser(advertiser.id)
      snackbar.value = { show: true, message: 'Advertiser deleted', color: 'success' }
    } catch (e) {
      snackbar.value = { show: true, message: e.message, color: 'error' }
    }
  }
}

onMounted(() => {
  store.fetchAdvertisers()
})
</script>
