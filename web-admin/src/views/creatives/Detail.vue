<template>
  <div>
    <!-- Breadcrumbs -->
    <v-breadcrumbs :items="breadcrumbs" class="px-0 mb-4" />

    <!-- Loading -->
    <v-progress-linear v-if="loading && !creative" indeterminate />

    <!-- Not Found -->
    <v-alert v-else-if="!creative" type="error" class="mb-4">
      Creative not found
    </v-alert>

    <!-- Content -->
    <template v-else>
      <!-- Header -->
      <v-card class="mb-4">
        <v-card-text>
          <div class="d-flex justify-space-between align-start">
            <div class="d-flex align-center">
              <v-avatar
                :color="getTypeColor(creative.type)"
                size="64"
                class="mr-4"
              >
                <v-icon :icon="getTypeIcon(creative.type)" size="32" />
              </v-avatar>
              <div>
                <h1 class="text-h4">{{ creative.name }}</h1>
                <div class="d-flex align-center mt-1">
                  <v-chip :color="getTypeColor(creative.type)" size="small" class="mr-2">
                    {{ creative.type }}
                  </v-chip>
                  <v-chip :color="getStatusColor(creative.status)" size="small" class="mr-2">
                    {{ creative.status }}
                  </v-chip>
                  <span class="text-caption text-medium-emphasis">
                    {{ creative.width }}x{{ creative.height }}
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

      <v-row>
        <!-- Preview -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>Preview</v-card-title>
            <v-divider />
            <v-card-text class="text-center">
              <!-- Banner Preview -->
              <template v-if="creative.type === 'banner'">
                <v-img
                  v-if="creative.image_url"
                  :src="creative.image_url"
                  max-height="400"
                  contain
                />
                <v-sheet v-else color="surface-variant" class="pa-8">
                  <v-icon size="64" color="disabled">mdi-image</v-icon>
                  <div class="text-caption mt-2">No image</div>
                </v-sheet>
              </template>

              <!-- Video Preview -->
              <template v-else-if="creative.type === 'video'">
                <video
                  v-if="creative.video_url"
                  :src="creative.video_url"
                  controls
                  style="max-width: 100%; max-height: 400px"
                />
                <v-sheet v-else color="surface-variant" class="pa-8">
                  <v-icon size="64" color="disabled">mdi-video</v-icon>
                  <div class="text-caption mt-2">No video</div>
                </v-sheet>
              </template>

              <!-- Native Preview -->
              <template v-else-if="creative.type === 'native'">
                <v-card variant="outlined" class="text-left">
                  <v-card-text>
                    <div class="d-flex align-center mb-2">
                      <v-avatar :src="creative.icon_url" size="48" class="mr-3">
                        <v-icon>mdi-image</v-icon>
                      </v-avatar>
                      <div>
                        <div class="font-weight-medium">{{ creative.title || 'No Title' }}</div>
                        <div class="text-caption text-medium-emphasis">Native Ad</div>
                      </div>
                    </div>
                    <div class="text-body-2">{{ creative.description || 'No description' }}</div>
                  </v-card-text>
                </v-card>
              </template>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Info -->
        <v-col cols="12" md="6">
          <v-card class="mb-4">
            <v-card-title>Basic Info</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item prepend-icon="mdi-identifier">
                <v-list-item-title>ID</v-list-item-title>
                <v-list-item-subtitle>{{ creative.id }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-bullhorn">
                <v-list-item-title>Campaign</v-list-item-title>
                <v-list-item-subtitle>
                  <router-link v-if="campaign" :to="`/campaigns/${campaign.id}`" class="text-decoration-none">
                    {{ campaign.name }}
                  </router-link>
                  <span v-else>-</span>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-aspect-ratio">
                <v-list-item-title>Size</v-list-item-title>
                <v-list-item-subtitle>{{ creative.width }} x {{ creative.height }} px</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- Type-specific Info -->
          <v-card v-if="creative.type === 'banner'">
            <v-card-title>Banner Details</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item prepend-icon="mdi-image">
                <v-list-item-title>Image URL</v-list-item-title>
                <v-list-item-subtitle class="text-truncate" style="max-width: 200px">
                  {{ creative.image_url || '-' }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-link">
                <v-list-item-title>Click URL</v-list-item-title>
                <v-list-item-subtitle class="text-truncate" style="max-width: 200px">
                  {{ creative.click_url || '-' }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <v-card v-else-if="creative.type === 'video'">
            <v-card-title>Video Details</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item prepend-icon="mdi-video">
                <v-list-item-title>Video URL</v-list-item-title>
                <v-list-item-subtitle class="text-truncate" style="max-width: 200px">
                  {{ creative.video_url || '-' }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-timer">
                <v-list-item-title>Duration</v-list-item-title>
                <v-list-item-subtitle>{{ creative.duration ? `${creative.duration}s` : '-' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-file-video">
                <v-list-item-title>Format</v-list-item-title>
                <v-list-item-subtitle>{{ creative.video_format?.toUpperCase() || '-' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <v-card v-else-if="creative.type === 'native'">
            <v-card-title>Native Details</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item prepend-icon="mdi-format-title">
                <v-list-item-title>Title</v-list-item-title>
                <v-list-item-subtitle>{{ creative.title || '-' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-text">
                <v-list-item-title>Description</v-list-item-title>
                <v-list-item-subtitle>{{ creative.description || '-' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-image">
                <v-list-item-title>Icon URL</v-list-item-title>
                <v-list-item-subtitle class="text-truncate" style="max-width: 200px">
                  {{ creative.icon_url || '-' }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- Form Dialog -->
    <CreativeForm
      ref="formRef"
      :loading="loading"
      @submit="handleSubmit"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      ref="confirmRef"
      title="Delete Creative"
      :message="`Are you sure you want to delete '${creative?.name}'?`"
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
import { useCreativeStore } from '@/stores/creative'
import api from '@/api/client'
import CreativeForm from '@/components/creatives/CreativeForm.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useCreativeStore()

const formRef = ref(null)
const confirmRef = ref(null)
const campaign = ref(null)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

const breadcrumbs = computed(() => [
  { title: 'Creatives', to: '/creatives' },
  { title: store.currentCreative?.name || 'Detail' },
])

const creative = computed(() => store.currentCreative)
const loading = computed(() => store.loading)

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

async function loadCreative() {
  await store.fetchCreative(route.params.id)
  await loadCampaign()
}

async function loadCampaign() {
  if (!creative.value?.campaign_id) return
  try {
    const response = await api.getCampaigns()
    campaign.value = response.data.find(c => c.id === creative.value.campaign_id)
  } catch (e) {
    console.error(e)
  }
}

function openForm() {
  formRef.value?.open(creative.value)
}

async function handleSubmit({ id, data, isEdit }) {
  try {
    await store.updateCreative(id, data)
    snackbar.value = { show: true, message: 'Creative updated', color: 'success' }
    formRef.value?.close()
  } catch (e) {
    snackbar.value = { show: true, message: e.message, color: 'error' }
  }
}

async function confirmDelete() {
  const confirmed = await confirmRef.value?.open()
  if (confirmed) {
    try {
      await store.deleteCreative(creative.value.id)
      router.push('/creatives')
    } catch (e) {
      snackbar.value = { show: true, message: e.message, color: 'error' }
    }
  }
}

watch(() => route.params.id, loadCreative)

onMounted(loadCreative)
</script>
