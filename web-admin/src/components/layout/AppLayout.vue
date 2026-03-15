<template>
  <v-app>
    <AppHeader :rail="rail" @toggle="rail = !rail" />
    <AppSidebar :rail="rail" />
    <v-main>
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

const rail = ref(false)
</script>
