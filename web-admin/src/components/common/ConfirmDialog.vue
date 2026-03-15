<template>
  <v-dialog v-model="dialog" max-width="400">
    <v-card>
      <v-card-title class="text-h6">{{ title }}</v-card-title>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="error" variant="flat" @click="confirm">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Confirm' },
  message: { type: String, default: 'Are you sure?' },
})

const dialog = ref(false)
let resolvePromise = null

function open() {
  dialog.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

function confirm() {
  dialog.value = false
  resolvePromise?.(true)
}

function cancel() {
  dialog.value = false
  resolvePromise?.(false)
}

defineExpose({ open })
</script>
