import axios from "axios";
import { config } from "../config";

const apiClient = axios.create({
    baseURL: config.apiBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
});

export default {
    // Advertisers
    getAdvertisers() {
        return apiClient.get("/advertisers");
    },
    createAdvertiser(data) {
        return apiClient.post("/advertisers", data);
    },
    updateAdvertiser(id, data) {
        return apiClient.put(`/advertisers/${id}`, data);
    },
    deleteAdvertiser(id) {
        return apiClient.delete(`/advertisers/${id}`);
    },

    // Campaigns
    getCampaigns(advertiserId = null) {
        const params = advertiserId ? { advertiser_id: advertiserId } : {};
        return apiClient.get("/campaigns", { params });
    },
    createCampaign(data) {
        return apiClient.post("/campaigns", data);
    },
    updateCampaign(id, data) {
        return apiClient.put(`/campaigns/${id}`, data);
    },
    deleteCampaign(id) {
        return apiClient.delete(`/campaigns/${id}`);
    },

    // Creatives
    getCreatives(campaignId = null) {
        const params = campaignId ? { campaign_id: campaignId } : {};
        return apiClient.get("/creatives", { params });
    },
    createCreative(data) {
        return apiClient.post("/creatives", data);
    },
    updateCreative(id, data) {
        return apiClient.put(`/creatives/${id}`, data);
    },
    deleteCreative(id) {
        return apiClient.delete(`/creatives/${id}`);
    },

    // Targeting Rules
    getTargetingRules(campaignId = null) {
        const params = campaignId ? { campaign_id: campaignId } : {};
        return apiClient.get("/targeting", { params });
    },
    createTargetingRule(data) {
        return apiClient.post("/targeting", data);
    },
    updateTargetingRule(id, data) {
        return apiClient.put(`/targeting/${id}`, data);
    },
    deleteTargetingRule(id) {
        return apiClient.delete(`/targeting/${id}`);
    },
};
