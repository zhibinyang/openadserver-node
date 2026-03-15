import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'

export const useCampaignStore = defineStore('campaign', () => {
  const campaigns = ref([])
  const currentCampaign = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchCampaigns(advertiserId = null) {
    loading.value = true
    error.value = null
    try {
      const response = await api.getCampaigns(advertiserId)
      campaigns.value = response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchCampaign(id) {
    loading.value = true
    error.value = null
    try {
      const response = await api.getCampaigns()
      currentCampaign.value = response.data.find(c => c.id === parseInt(id))
      return currentCampaign.value
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createCampaign(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.createCampaign(data)
      campaigns.value.push(response.data)
      return response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateCampaign(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.updateCampaign(id, data)
      const index = campaigns.value.findIndex(c => c.id === id)
      if (index !== -1) {
        campaigns.value[index] = response.data
      }
      if (currentCampaign.value?.id === id) {
        currentCampaign.value = response.data
      }
      return response.data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteCampaign(id) {
    loading.value = true
    error.value = null
    try {
      await api.deleteCampaign(id)
      campaigns.value = campaigns.value.filter(c => c.id !== id)
      if (currentCampaign.value?.id === id) {
        currentCampaign.value = null
      }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function reset() {
    campaigns.value = []
    currentCampaign.value = null
    error.value = null
  }

  return {
    campaigns,
    currentCampaign,
    loading,
    error,
    fetchCampaigns,
    fetchCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    reset,
  }
})
