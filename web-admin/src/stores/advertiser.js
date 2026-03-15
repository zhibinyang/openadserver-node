import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'

export const useAdvertiserStore = defineStore('advertiser', () => {
  const advertisers = ref([])
  const currentAdvertiser = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchAdvertisers() {
    loading.value = true
    error.value = null
    try {
      const response = await api.getAdvertisers()
      advertisers.value = response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAdvertiser(id) {
    loading.value = true
    error.value = null
    try {
      const response = await api.getAdvertisers()
      currentAdvertiser.value = response.data.find(a => a.id === parseInt(id))
      return currentAdvertiser.value
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createAdvertiser(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.createAdvertiser(data)
      advertisers.value.push(response.data)
      return response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateAdvertiser(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.updateAdvertiser(id, data)
      const index = advertisers.value.findIndex(a => a.id === id)
      if (index !== -1) {
        advertisers.value[index] = response.data
      }
      if (currentAdvertiser.value?.id === id) {
        currentAdvertiser.value = response.data
      }
      return response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteAdvertiser(id) {
    loading.value = true
    error.value = null
    try {
      await api.deleteAdvertiser(id)
      advertisers.value = advertisers.value.filter(a => a.id !== id)
      if (currentAdvertiser.value?.id === id) {
        currentAdvertiser.value = null
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function reset() {
    advertisers.value = []
    currentAdvertiser.value = null
    error.value = null
  }

  return {
    advertisers,
    currentAdvertiser,
    loading,
    error,
    fetchAdvertisers,
    fetchAdvertiser,
    createAdvertiser,
    updateAdvertiser,
    deleteAdvertiser,
    reset,
  }
})
