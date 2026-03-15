import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const loading = ref(false)
  const snackbar = ref({
    show: false,
    message: '',
    color: 'success',
  })

  function showSnackbar(message, color = 'success') {
    snackbar.value = { show: true, message, color }
  }

  function setLoading(value) {
    loading.value = value
  }

  return { loading, snackbar, showSnackbar, setLoading }
})
