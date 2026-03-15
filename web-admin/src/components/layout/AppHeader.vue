<template>
  <v-app-bar color="surface" density="comfortable" elevation="1">
    <v-app-bar-nav-icon @click="$emit('toggle')" />
    <v-toolbar-title class="text-h6 font-weight-bold">
      <span class="text-primary">Open</span>AdServer
    </v-toolbar-title>
    <v-spacer />
    <v-btn icon="mdi-bell-outline" />
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="text" class="ml-2">
          <v-icon start>mdi-account-circle</v-icon>
          {{ authStore.username || 'User' }}
          <v-icon end>mdi-chevron-down</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item prepend-icon="mdi-account" title="Profile" to="/profile" />
        <v-list-item prepend-icon="mdi-key" title="API Keys" to="/api-keys" />
        <v-divider />
        <v-list-item prepend-icon="mdi-logout" title="Logout" @click="handleLogout" />
      </v-list>
    </v-menu>
  </v-app-bar>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['toggle'])
const router = useRouter()
const authStore = useAuthStore()

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>
