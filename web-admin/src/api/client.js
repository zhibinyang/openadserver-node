import axios from "axios";
import { config } from "../config";

const apiClient = axios.create({
    baseURL: config.apiBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default {
    // Auth
    login(username, password) {
        return apiClient.post("/auth/login", { username, password });
    },
    logout() {
        return apiClient.post("/auth/logout");
    },
    getMe() {
        return apiClient.get("/auth/me");
    },
    changePassword(oldPassword, newPassword) {
        return apiClient.post("/auth/change-password", { oldPassword, newPassword });
    },

    // Users (admin only)
    getUsers() {
        return apiClient.get("/users");
    },
    getUser(id) {
        return apiClient.get(`/users/${id}`);
    },
    createUser(data) {
        return apiClient.post("/users", data);
    },
    updateUser(id, data) {
        return apiClient.put(`/users/${id}`, data);
    },
    deleteUser(id) {
        return apiClient.delete(`/users/${id}`);
    },
    resetUserPassword(id, newPassword) {
        return apiClient.post(`/users/${id}/reset-password`, { newPassword });
    },

    // API Keys
    getApiKeys() {
        return apiClient.get("/api-keys");
    },
    createApiKey(data) {
        return apiClient.post("/api-keys", data);
    },
    getApiKey(id) {
        return apiClient.get(`/api-keys/${id}`);
    },
    updateApiKey(id, data) {
        return apiClient.put(`/api-keys/${id}`, data);
    },
    revokeApiKey(id) {
        return apiClient.post(`/api-keys/${id}/revoke`);
    },
    deleteApiKey(id) {
        return apiClient.delete(`/api-keys/${id}`);
    },

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
