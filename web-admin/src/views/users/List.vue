<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>Users</span>
            <v-spacer />
            <v-btn color="primary" @click="openCreateDialog" v-if="authStore.isAdmin">
              <v-icon start>mdi-plus</v-icon>
              Add User
            </v-btn>
          </v-card-title>
          <v-data-table
            :headers="headers"
            :items="users"
            :loading="loading"
            class="elevation-1"
          >
            <template #item.status="{ item }">
              <v-chip :color="item.status === 1 ? 'success' : 'error'" size="small">
                {{ item.status === 1 ? 'Active' : 'Inactive' }}
              </v-chip>
            </template>
            <template #item.role="{ item }">
              <v-chip :color="item.role === 'admin' ? 'primary' : 'default'" size="small">
                {{ item.role }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEditDialog(item)" />
              <v-btn icon="mdi-key" size="small" variant="text" @click="openResetPasswordDialog(item)" />
              <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create/Edit Dialog -->
    <v-dialog v-model="dialog" max-width="500">
      <v-card>
        <v-card-title>{{ editingUser ? 'Edit User' : 'Create User' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <v-text-field
              v-model="form.username"
              label="Username"
              :rules="[rules.required]"
              :disabled="!!editingUser"
            />
            <v-text-field
              v-model="form.email"
              label="Email"
              type="email"
              :rules="[rules.required, rules.email]"
            />
            <v-select
              v-model="form.role"
              label="Role"
              :items="['admin', 'viewer']"
              :rules="[rules.required]"
            />
            <v-select
              v-model="form.status"
              label="Status"
              :items="[{ value: 1, title: 'Active' }, { value: 0, title: 'Inactive' }]"
              :rules="[rules.required]"
            />
            <v-text-field
              v-if="!editingUser"
              v-model="form.password"
              label="Password"
              type="password"
              :rules="[rules.required, rules.minPassword]"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveUser" :loading="saving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reset Password Dialog -->
    <v-dialog v-model="resetPasswordDialog" max-width="400">
      <v-card>
        <v-card-title>Reset Password</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newPassword"
            label="New Password"
            type="password"
            :rules="[rules.required, rules.minPassword]"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="resetPasswordDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="resetPassword" :loading="resetting">Reset</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      v-model="deleteDialog"
      title="Delete User"
      :message="`Are you sure you want to delete user '${userToDelete?.username}'?`"
      confirm-color="error"
      @confirm="deleteUser"
    />
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import api from '@/api/client'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const authStore = useAuthStore()
const appStore = useAppStore()

const headers = [
  { title: 'ID', key: 'id' },
  { title: 'Username', key: 'username' },
  { title: 'Email', key: 'email' },
  { title: 'Role', key: 'role' },
  { title: 'Status', key: 'status' },
  { title: 'Last Login', key: 'last_login_at' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const users = ref([])
const loading = ref(false)
const dialog = ref(false)
const editingUser = ref(null)
const form = ref({ username: '', email: '', role: 'viewer', status: 1, password: '' })
const formRef = ref(null)
const saving = ref(false)

const resetPasswordDialog = ref(false)
const newPassword = ref('')
const resetting = ref(false)
const userToReset = ref(null)

const deleteDialog = ref(false)
const userToDelete = ref(null)

const rules = {
  required: (v) => !!v || 'Required',
  email: (v) => /.+@.+\..+/.test(v) || 'Invalid email',
  minPassword: (v) => (v && v.length >= 6) || 'Min 6 characters',
}

onMounted(() => {
  loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    const response = await api.getUsers()
    users.value = response.data
  } catch (error) {
    appStore.showSnackbar('Failed to load users', 'error')
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editingUser.value = null
  form.value = { username: '', email: '', role: 'viewer', status: 1, password: '' }
  dialog.value = true
}

function openEditDialog(user) {
  editingUser.value = user
  form.value = { ...user, password: '' }
  dialog.value = true
}

async function saveUser() {
  const { valid } = await formRef.value?.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editingUser.value) {
      await api.updateUser(editingUser.value.id, {
        email: form.value.email,
        role: form.value.role,
        status: form.value.status,
      })
      appStore.showSnackbar('User updated', 'success')
    } else {
      await api.createUser(form.value)
      appStore.showSnackbar('User created', 'success')
    }
    dialog.value = false
    loadUsers()
  } catch (error) {
    appStore.showSnackbar(error.response?.data?.message || 'Failed to save user', 'error')
  } finally {
    saving.value = false
  }
}

function openResetPasswordDialog(user) {
  userToReset.value = user
  newPassword.value = ''
  resetPasswordDialog.value = true
}

async function resetPassword() {
  if (!newPassword.value || newPassword.value.length < 6) return

  resetting.value = true
  try {
    await api.resetUserPassword(userToReset.value.id, newPassword.value)
    appStore.showSnackbar('Password reset', 'success')
    resetPasswordDialog.value = false
  } catch (error) {
    appStore.showSnackbar('Failed to reset password', 'error')
  } finally {
    resetting.value = false
  }
}

function confirmDelete(user) {
  userToDelete.value = user
  deleteDialog.value = true
}

async function deleteUser() {
  try {
    await api.deleteUser(userToDelete.value.id)
    appStore.showSnackbar('User deleted', 'success')
    loadUsers()
  } catch (error) {
    appStore.showSnackbar('Failed to delete user', 'error')
  } finally {
    deleteDialog.value = false
  }
}
</script>
