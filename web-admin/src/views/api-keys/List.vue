<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>API Keys</span>
            <v-spacer />
            <v-btn color="primary" @click="openCreateDialog">
              <v-icon start>mdi-plus</v-icon>
              Create Key
            </v-btn>
          </v-card-title>
          <v-data-table
            :headers="headers"
            :items="apiKeys"
            :loading="loading"
            class="elevation-1"
          >
            <template #item.status="{ item }">
              <v-chip :color="item.status === 1 ? 'success' : 'error'" size="small">
                {{ item.status === 1 ? 'Active' : 'Revoked' }}
              </v-chip>
            </template>
            <template #item.expires_at="{ item }">
              <span v-if="item.expires_at">
                {{ new Date(item.expires_at).toLocaleDateString() }}
                <v-chip v-if="isExpired(item.expires_at)" color="warning" size="x-small">Expired</v-chip>
              </span>
              <span v-else class="text-grey">Never</span>
            </template>
            <template #item.last_used_at="{ item }">
              <span v-if="item.last_used_at">{{ new Date(item.last_used_at).toLocaleString() }}</span>
              <span v-else class="text-grey">Never</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEditDialog(item)" :disabled="item.status !== 1" />
              <v-btn icon="mdi-cancel" size="small" variant="text" color="warning" @click="revokeKey(item)" :disabled="item.status !== 1" />
              <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create/Edit Dialog -->
    <v-dialog v-model="dialog" max-width="500">
      <v-card>
        <v-card-title>{{ editingKey ? 'Edit API Key' : 'Create API Key' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <v-text-field
              v-model="form.name"
              label="Name"
              :rules="[rules.required]"
            />
            <v-combobox
              v-model="form.permissions"
              label="Permissions"
              :items="permissionOptions"
              multiple
              chips
              hint="Select or type custom permissions"
              persistent-hint
            />
            <v-text-field
              v-model="form.expires_at"
              label="Expiration Date (optional)"
              type="date"
              hint="Leave empty for no expiration"
              persistent-hint
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveKey" :loading="saving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Show New Key Dialog -->
    <v-dialog v-model="showKeyDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="text-warning">
          <v-icon start>mdi-alert</v-icon>
          Save Your API Key
        </v-card-title>
        <v-card-text>
          <v-alert type="warning" class="mb-4">
            This is the only time you will see this key. Copy it now!
          </v-alert>
          <v-text-field
            :model-value="newKey"
            readonly
            append-icon="mdi-content-copy"
            @click:append="copyKey"
            hint="Click the icon to copy"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="showKeyDialog = false">I've Saved It</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      v-model="deleteDialog"
      title="Delete API Key"
      :message="`Are you sure you want to delete key '${keyToDelete?.name}'?`"
      confirm-color="error"
      @confirm="deleteKey"
    />
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import api from '@/api/client'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const appStore = useAppStore()

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Prefix', key: 'key_prefix' },
  { title: 'Status', key: 'status' },
  { title: 'Expires', key: 'expires_at' },
  { title: 'Last Used', key: 'last_used_at' },
  { title: 'Created', key: 'created_at' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const apiKeys = ref([])
const loading = ref(false)
const dialog = ref(false)
const editingKey = ref(null)
const form = ref({ name: '', permissions: [], expires_at: '' })
const formRef = ref(null)
const saving = ref(false)

const showKeyDialog = ref(false)
const newKey = ref('')

const deleteDialog = ref(false)
const keyToDelete = ref(null)

const permissionOptions = ['read', 'write', 'admin']

const rules = {
  required: (v) => !!v || 'Required',
}

onMounted(() => {
  loadApiKeys()
})

function isExpired(dateStr) {
  return new Date(dateStr) < new Date()
}

async function loadApiKeys() {
  loading.value = true
  try {
    const response = await api.getApiKeys()
    apiKeys.value = response.data
  } catch (error) {
    appStore.showSnackbar('Failed to load API keys', 'error')
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editingKey.value = null
  form.value = { name: '', permissions: [], expires_at: '' }
  dialog.value = true
}

function openEditDialog(key) {
  editingKey.value = key
  form.value = {
    name: key.name,
    permissions: key.permissions || [],
    expires_at: key.expires_at ? key.expires_at.split('T')[0] : '',
  }
  dialog.value = true
}

async function saveKey() {
  const { valid } = await formRef.value?.validate()
  if (!valid) return

  saving.value = true
  try {
    const data = {
      name: form.value.name,
      permissions: form.value.permissions,
      expires_at: form.value.expires_at || null,
    }

    if (editingKey.value) {
      await api.updateApiKey(editingKey.value.id, data)
      appStore.showSnackbar('API key updated', 'success')
      dialog.value = false
      loadApiKeys()
    } else {
      const response = await api.createApiKey(data)
      newKey.value = response.data.plain_key
      dialog.value = false
      showKeyDialog.value = true
      loadApiKeys()
    }
  } catch (error) {
    appStore.showSnackbar(error.response?.data?.message || 'Failed to save API key', 'error')
  } finally {
    saving.value = false
  }
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(newKey.value)
    appStore.showSnackbar('Copied to clipboard', 'success')
  } catch {
    appStore.showSnackbar('Failed to copy', 'error')
  }
}

async function revokeKey(key) {
  try {
    await api.revokeApiKey(key.id)
    appStore.showSnackbar('API key revoked', 'success')
    loadApiKeys()
  } catch (error) {
    appStore.showSnackbar('Failed to revoke key', 'error')
  }
}

function confirmDelete(key) {
  keyToDelete.value = key
  deleteDialog.value = true
}

async function deleteKey() {
  try {
    await api.deleteApiKey(keyToDelete.value.id)
    appStore.showSnackbar('API key deleted', 'success')
    loadApiKeys()
  } catch (error) {
    appStore.showSnackbar('Failed to delete key', 'error')
  } finally {
    deleteDialog.value = false
  }
}
</script>
