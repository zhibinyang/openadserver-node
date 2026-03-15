import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'

export const useCreativeStore = defineStore('creative', () => {
  const creatives = ref([])
  const currentCreative = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchCreatives(campaignId = null) {
    loading.value = true
    error.value = null
    try {
      const response = await api.getCreatives(campaignId)
      creatives.value = response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchCreative(id) {
    loading.value = true
    error.value = null
    try {
      const response = await api.getCreatives()
      currentCreative.value = response.data.find(c => c.id === parseInt(id))
      return currentCreative.value
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createCreative(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.createCreative(data)
      creatives.value.push(response.data)
      return response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateCreative(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.updateCreative(id, data)
      const index = creatives.value.findIndex(c => c.id === id)
      if (index !== -1) {
        creatives.value[index] = response.data
      }
      if (currentCreative.value?.id === id) {
        currentCreative.value = response.data
      }
      return response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteCreative(id) {
    loading.value = true
    error.value = null
    try {
      await api.deleteCreative(id)
      creatives.value = creatives.value.filter(c => c.id !== id)
      if (currentCreative.value?.id === id) {
        currentCreative.value = null
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function reset() {
    creatives.value = []
    currentCreative.value = null
    error.value = null
  }

  return {
    creatives,
    currentCreative,
    loading,
    error,
    fetchCreatives,
    fetchCreative,
    createCreative,
    updateCreative,
    deleteCreative,
    reset,
  }
})
