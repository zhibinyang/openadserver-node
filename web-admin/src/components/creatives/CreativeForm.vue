<template>
  <v-dialog v-model="dialog" max-width="700" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>{{ isEdit ? 'Edit Creative' : 'New Creative' }}</span>
        <v-btn icon="mdi-close" variant="text" @click="close" />
      </v-card-title>
      <v-divider />
      
      <v-card-text>
        <v-form ref="formRef" v-model="isValid">
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.name"
                label="Creative Name"
                :rules="[rules.required]"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.campaign_id"
                label="Campaign"
                :items="campaigns"
                item-title="name"
                item-value="id"
                :rules="[rules.required]"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.type"
                label="Type"
                :items="typeOptions"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.width"
                label="Width (px)"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.height"
                label="Height (px)"
                type="number"
                variant="outlined"
              />
            </v-col>

            <!-- Banner Fields -->
            <template v-if="form.type === 'banner'">
              <v-col cols="12">
                <v-text-field
                  v-model="form.image_url"
                  label="Image URL"
                  variant="outlined"
                  prepend-inner-icon="mdi-image"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="form.click_url"
                  label="Click URL"
                  variant="outlined"
                  prepend-inner-icon="mdi-link"
                />
              </v-col>
            </template>

            <!-- Video Fields -->
            <template v-if="form.type === 'video'">
              <v-col cols="12">
                <v-text-field
                  v-model="form.video_url"
                  label="Video URL"
                  variant="outlined"
                  prepend-inner-icon="mdi-video"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.duration"
                  label="Duration (seconds)"
                  type="number"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.video_format"
                  label="Video Format"
                  :items="videoFormatOptions"
                  variant="outlined"
                />
              </v-col>
            </template>

            <!-- Native Fields -->
            <template v-if="form.type === 'native'">
              <v-col cols="12">
                <v-text-field
                  v-model="form.title"
                  label="Title"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.description"
                  label="Description"
                  variant="outlined"
                  rows="2"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="form.icon_url"
                  label="Icon URL"
                  variant="outlined"
                  prepend-inner-icon="mdi-image"
                />
              </v-col>
            </template>

            <v-col cols="12">
              <v-select
                v-model="form.status"
                label="Status"
                :items="statusOptions"
                variant="outlined"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading" @click="submit">
          {{ isEdit ? 'Update' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api/client'

const props = defineProps({
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const dialog = ref(false)
const formRef = ref(null)
const isValid = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const campaigns = ref([])

const form = reactive({
  name: '',
  campaign_id: null,
  type: 'banner',
  width: '',
  height: '',
  image_url: '',
  click_url: '',
  video_url: '',
  duration: '',
  video_format: 'mp4',
  title: '',
  description: '',
  icon_url: '',
  status: 'active',
})

const typeOptions = [
  { title: 'Banner', value: 'banner' },
  { title: 'Video', value: 'video' },
  { title: 'Native', value: 'native' },
]

const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
]

const videoFormatOptions = [
  { title: 'MP4', value: 'mp4' },
  { title: 'WebM', value: 'webm' },
  { title: 'MOV', value: 'mov' },
]

const rules = {
  required: v => !!v || 'This field is required',
}

async function loadCampaigns() {
  try {
    const response = await api.getCampaigns()
    campaigns.value = response.data
  } catch (e) {
    console.error(e)
  }
}

function open(creative = null) {
  isEdit.value = !!creative
  editId.value = creative?.id || null
  
  if (creative) {
    Object.assign(form, {
      name: creative.name || '',
      campaign_id: creative.campaign_id || null,
      type: creative.type || 'banner',
      width: creative.width || '',
      height: creative.height || '',
      image_url: creative.image_url || '',
      click_url: creative.click_url || '',
      video_url: creative.video_url || '',
      duration: creative.duration || '',
      video_format: creative.video_format || 'mp4',
      title: creative.title || '',
      description: creative.description || '',
      icon_url: creative.icon_url || '',
      status: creative.status || 'active',
    })
  } else {
    reset()
  }
  
  dialog.value = true
}

function reset() {
  Object.assign(form, {
    name: '',
    campaign_id: null,
    type: 'banner',
    width: '',
    height: '',
    image_url: '',
    click_url: '',
    video_url: '',
    duration: '',
    video_format: 'mp4',
    title: '',
    description: '',
    icon_url: '',
    status: 'active',
  })
}

function close() {
  dialog.value = false
  reset()
}

async function submit() {
  const { valid } = await formRef.value?.validate()
  if (!valid) return
  
  emit('submit', {
    id: editId.value,
    data: { ...form },
    isEdit: isEdit.value,
  })
}

onMounted(loadCampaigns)

defineExpose({ open, close })
</script>
