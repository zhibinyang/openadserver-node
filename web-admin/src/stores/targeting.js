import { defineStore } from "pinia";
import { ref } from "vue";
import api from "../api/client";

export const useTargetingStore = defineStore("targeting", () => {
  const rules = ref([]);
  const currentRule = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Targeting types
  const targetingTypes = [
    { value: "geo", label: "地理位置", icon: "mdi-map-marker" },
    { value: "time", label: "时间定向", icon: "mdi-clock-outline" },
    { value: "device", label: "设备定向", icon: "mdi-cellphone" },
    { value: "browser", label: "浏览器定向", icon: "mdi-web" },
    { value: "os", label: "操作系统定向", icon: "mdi-laptop" },
    { value: "language", label: "语言定向", icon: "mdi-translate" },
    { value: "frequency", label: "频次控制", icon: "mdi-repeat" },
    { value: "domain", label: "域名定向", icon: "mdi-domain" },
  ];

  // Operators
  const operators = [
    { value: "include", label: "包含" },
    { value: "exclude", label: "排除" },
  ];

  async function fetchRules(campaignId = null) {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.getTargetingRules(campaignId);
      rules.value = response.data;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchRule(id) {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.getTargetingRules();
      currentRule.value = response.data.find((r) => r.id === id);
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createRule(data) {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.createTargetingRule(data);
      rules.value.push(response.data);
      return response.data;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function updateRule(id, data) {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.updateTargetingRule(id, data);
      const index = rules.value.findIndex((r) => r.id === id);
      if (index !== -1) {
        rules.value[index] = response.data;
      }
      if (currentRule.value?.id === id) {
        currentRule.value = response.data;
      }
      return response.data;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function deleteRule(id) {
    loading.value = true;
    error.value = null;
    try {
      await api.deleteTargetingRule(id);
      rules.value = rules.value.filter((r) => r.id !== id);
      if (currentRule.value?.id === id) {
        currentRule.value = null;
      }
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function getTypeLabel(type) {
    const found = targetingTypes.find((t) => t.value === type);
    return found ? found.label : type;
  }

  function getTypeIcon(type) {
    const found = targetingTypes.find((t) => t.value === type);
    return found ? found.icon : "mdi-target";
  }

  return {
    rules,
    currentRule,
    loading,
    error,
    targetingTypes,
    operators,
    fetchRules,
    fetchRule,
    createRule,
    updateRule,
    deleteRule,
    getTypeLabel,
    getTypeIcon,
  };
});
