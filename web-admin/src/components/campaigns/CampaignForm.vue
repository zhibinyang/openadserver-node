<template>
  <v-dialog v-model="dialog" max-width="800" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>{{ isEdit ? 'Edit Campaign' : 'New Campaign' }}</span>
        <v-btn icon="mdi-close" variant="text" @click="close" />
      </v-card-title>
      <v-divider />
      
      <v-card-text>
        <v-stepper v-model="step" alt-labels>
          <v-stepper-header>
            <v-stepper-item value="1" title="Basic Info" />
            <v-divider />
            <v-stepper-item value="2" title="Budget & Bidding" />
            <v-divider />
            <v-stepper-item value="3" title="Schedule" />
          </v-stepper-header>

          <v-stepper-window>
            <!-- Step 1: Basic Info -->
            <v-stepper-window-item value="1">
              <v-form ref="formRef" v-model="isValid">
                <v-row>
                  <v-col cols="12">
                    <v-text-field
                      v-model="form.name"
                      label="Campaign Name"
                      :rules="[rules.required]"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="form.advertiser_id"
                      label="Advertiser"
                      :items="advertisers"
                      item-title="name"
                      item-value="id"
                      :rules="[rules.required]"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="form.status"
                      label="Status"
                      :items="statusOptions"
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
                </v-row>
              </v-form>
            </v-stepper-window-item>

            <!-- Step 2: Budget & Bidding -->
            <v-stepper-window-item value="2">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.budget"
                    label="Total Budget ($)"
                    type="number"
                    variant="outlined"
                    prepend-inner-icon="mdi-currency-usd"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.daily_budget"
                    label="Daily Budget ($)"
                    type="number"
                    variant="outlined"
                    prepend-inner-icon="mdi-currency-usd"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.bid_type"
                    label="Bid Type"
                    :items="bidTypeOptions"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.bid_amount"
                    label="Bid Amount ($)"
                    type="number"
                    variant="outlined"
                    prepend-inner-icon="mdi-currency-usd"
                  />
                </v-col>
              </v-row>
            </v-stepper-window-item>

            <!-- Step 3: Schedule -->
            <v-stepper-window-item value="3">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.start_date"
                    label="Start Date"
                    type="date"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.end_date"
                    label="End Date"
                    type="date"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar"
                  />
                </v-col>
              </v-row>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-btn v-if="step > 1" variant="text" @click="step--">
          Back
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn v-if="step < 3" color="primary" variant="flat" @click="step++">
          Next
        </v-btn>
        <v-btn v-else color="primary" variant="flat" :loading="loading" @click="submit">
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
const step = ref(1)
const advertisers = ref([])

const form = reactive({
  name: '',
  advertiser_id: null,
  status: 'active',
  description: '',
  budget: '',
  daily_budget: '',
  bid_type: 'cpm',
  bid_amount: '',
  start_date: '',
  end_date: '',
})

const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Paused', value: 'paused' },
  { title: 'Draft', value: 'draft' },
]

const bidTypeOptions = [
  { title: 'CPM (Cost per Mille)', value: 'cpm' },
  { title: 'CPC (Cost per Click)', value: 'cpc' },
  { title: 'CPA (Cost per Action)', value: 'cpa' },
]

const rules = {
  required: v => !!v || 'This field is required',
}

async function loadAdvertisers() {
  try {
    const response = await api.getAdvertisers()
    advertisers.value = response.data
  } catch (e) {
    console.error(e)
  }
}

function open(campaign = null) {
  isEdit.value = !!campaign
  editId.value = campaign?.id || null
  step.value = 1
  
  if (campaign) {
    Object.assign(form, {
      name: campaign.name || '',
      advertiser_id: campaign.advertiser_id || null,
      status: campaign.status || 'active',
      description: campaign.description || '',
      budget: campaign.budget || '',
      daily_budget: campaign.daily_budget || '',
      bid_type: campaign.bid_type || 'cpm',
      bid_amount: campaign.bid_amount || '',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
    })
  } else {
    reset()
  }
  
  dialog.value = true
}

function reset() {
  Object.assign(form, {
    name: '',
    advertiser_id: null,
    status: 'active',
    description: '',
    budget: '',
    daily_budget: '',
    bid_type: 'cpm',
    bid_amount: '',
    start_date: '',
    end_date: '',
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

onMounted(loadAdvertisers)

defineExpose({ open, close })
</script>
