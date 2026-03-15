import { defineStore } from "pinia";
import { ref } from "vue";
import api from "../api/client";

export const useReportStore = defineStore("reports", () => {
  const overviewData = ref(null);
  const advertiserReport = ref([]);
  const campaignReport = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Date range for reports
  const dateRange = ref({
    start: getDefaultStartDate(),
    end: getDefaultEndDate(),
  });

  function getDefaultStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  }

  function getDefaultEndDate() {
    return new Date().toISOString().split("T")[0];
  }

  async function fetchOverview() {
    loading.value = true;
    error.value = null;
    try {
      // In real app, this would call actual API
      // For now, return mock data
      overviewData.value = generateMockOverview();
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAdvertiserReport() {
    loading.value = true;
    error.value = null;
    try {
      // Mock data for now
      const advertisers = (await api.getAdvertisers()).data;
      advertiserReport.value = advertisers.map((adv, index) => ({
        ...adv,
        impressions: Math.floor(Math.random() * 1000000) + 100000,
        clicks: Math.floor(Math.random() * 50000) + 5000,
        ctr: (Math.random() * 5 + 1).toFixed(2),
        spend: (Math.random() * 50000 + 5000).toFixed(2),
        conversions: Math.floor(Math.random() * 1000) + 100,
        cvr: (Math.random() * 3 + 0.5).toFixed(2),
      }));
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCampaignReport(advertiserId = null) {
    loading.value = true;
    error.value = null;
    try {
      // Mock data for now
      const campaigns = (await api.getCampaigns(advertiserId)).data;
      campaignReport.value = campaigns.map((camp, index) => ({
        ...camp,
        impressions: Math.floor(Math.random() * 500000) + 50000,
        clicks: Math.floor(Math.random() * 25000) + 2500,
        ctr: (Math.random() * 5 + 1).toFixed(2),
        spend: (Math.random() * 25000 + 2500).toFixed(2),
        conversions: Math.floor(Math.random() * 500) + 50,
        cvr: (Math.random() * 3 + 0.5).toFixed(2),
      }));
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function generateMockOverview() {
    const days = [];
    const startDate = new Date(dateRange.value.start);
    const endDate = new Date(dateRange.value.end);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push({
        date: d.toISOString().split("T")[0],
        impressions: Math.floor(Math.random() * 100000) + 50000,
        clicks: Math.floor(Math.random() * 5000) + 2000,
        spend: (Math.random() * 5000 + 2000).toFixed(2),
      });
    }

    return {
      totalImpressions: days.reduce((sum, d) => sum + d.impressions, 0),
      totalClicks: days.reduce((sum, d) => sum + d.clicks, 0),
      totalSpend: days.reduce((sum, d) => sum + parseFloat(d.spend), 0).toFixed(2),
      totalConversions: Math.floor(Math.random() * 5000) + 2000,
      avgCTR: (Math.random() * 3 + 2).toFixed(2),
      avgCVR: (Math.random() * 2 + 1).toFixed(2),
      dailyData: days,
    };
  }

  function setDateRange(start, end) {
    dateRange.value = { start, end };
  }

  return {
    overviewData,
    advertiserReport,
    campaignReport,
    loading,
    error,
    dateRange,
    fetchOverview,
    fetchAdvertiserReport,
    fetchCampaignReport,
    setDateRange,
  };
});
