<template>
  <v-dialog v-model="dialog" max-width="600" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>{{ isEdit ? 'Edit Advertiser' : 'New Advertiser' }}</span>
        <v-btn icon="mdi-close" variant="text" @click="close" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-form ref="formRef" v-model="isValid">
          <v-text-field
            v-model="form.name"
            label="Name"
            :rules="[rules.required]"
            variant="outlined"
            class="mb-3"
          />
          <v-text-field
            v-model="form.contact_email"
            label="Contact Email"
            :rules="[rules.email]"
            variant="outlined"
            class="mb-3"
          />
          <v-text-field
            v-model="form.contact_phone"
            label="Contact Phone"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="form.description"
            label="Description"
            variant="outlined"
            rows="3"
            class="mb-3"
          />
          <v-select
            v-model="form.status"
            label="Status"
            :items="statusOptions"
            variant="outlined"
          />
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
import { ref, reactive, computed } from 'vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const dialog = ref(false)
const formRef = ref(null)
const isValid = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const form = reactive({
  name: '',
  contact_email: '',
  contact_phone: '',
  description: '',
  status: 'active',
})

const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
  { title: 'Suspended', value: 'suspended' },
]

const rules = {
  required: v => !!v || 'This field is required',
  email: v => !v || /.+@.+\..+/.test(v) || 'Invalid email format',
}

function open(advertiser = null) {
  isEdit.value = !!advertiser
  editId.value = advertiser?.id || null
  
  if (advertiser) {
    Object.assign(form, {
      name: advertiser.name || '',
      contact_email: advertiser.contact_email || '',
      contact_phone: advertiser.contact_phone || '',
      description: advertiser.description || '',
      status: advertiser.status || 'active',
    })
  } else {
    reset()
  }
  
  dialog.value = true
}

function reset() {
  Object.assign(form, {
    name: '',
    contact_email: '',
    contact_phone: '',
    description: '',
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

defineExpose({ open, close })
</script>
