<script setup>
import { ref, onMounted, computed } from 'vue';
import api from '../api/client';

const rules = ref([]);
const campaigns = ref([]);

const newRule = ref({
    campaign_id: null,
    rule_type: 'geo',
    is_include: true,
    rule_value: {} // Will be populated by helper
});

// UI Helper state for new rule
const uiState = ref({
    geoInput: '',
    deviceOs: []
});

const loadData = async () => {
    try {
        const [r, c] = await Promise.all([
            api.getTargetingRules(),
            api.getCampaigns()
        ]);
        rules.value = r.data.map(item => ({ ...item, isEditing: false, _editValue: JSON.stringify(item.rule_value) }));
        campaigns.value = c.data;
    } catch (err) {
        console.error(err);
    }
};

const prepareCreate = () => {
    const val = {};
    if (newRule.value.rule_type === 'geo') {
        // Simple comma separated list for demo
        val.countries = uiState.value.geoInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    } else if (newRule.value.rule_type === 'device') {
        val.os = uiState.value.deviceOs;
    }
    // Default fallback
    if (Object.keys(val).length === 0) {
        return { wildcard: true };
    }
    return val;
};

const create = async () => {
    if (!newRule.value.campaign_id) {
        alert("Select a campaign");
        return;
    }

    const payload = { ...newRule.value };
    payload.rule_value = prepareCreate();
    
    await api.createTargetingRule(payload);
    loadData();
    // Reset UI
    uiState.value = { geoInput: '', deviceOs: [] };
};

const update = async (item) => {
    try {
        item.rule_value = JSON.parse(item._editValue); // Parse JSON from text area
        await api.updateTargetingRule(item.id, item);
        item.isEditing = false;
    } catch (e) {
        alert("Invalid JSON format");
    }
};

const remove = async (id) => {
    if (!confirm('Delete rule?')) return;
    await api.deleteTargetingRule(id);
    loadData();
};

const getCampName = (id) => {
    const c = campaigns.value.find(ca => ca.id === id);
    return c ? c.name : id;
};

onMounted(loadData);
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Targeting Rules</h2>
    </div>

    <!-- Create Form -->
    <div class="card">
      <h3>New Rule</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Campaign</label>
          <select v-model="newRule.campaign_id">
              <option :value="null">Select Campaign</option>
              <option v-for="c in campaigns" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-group">
            <label>Type</label>
            <select v-model="newRule.rule_type">
                <option value="geo">Geo Location</option>
                <option value="device">Device</option>
            </select>
            <div style="margin-top: 5px;">
                <label style="display:inline; margin-right: 10px;">
                    <input type="radio" :value="true" v-model="newRule.is_include" /> Include
                </label>
                <label style="display:inline;">
                    <input type="radio" :value="false" v-model="newRule.is_include" /> Exclude
                </label>
            </div>
        </div>

        <!-- Dynamic Value Editor -->
        <div class="form-group" style="flex: 2;">
            <label>Configuration</label>
            
            <!-- GEO UI -->
            <div v-if="newRule.rule_type === 'geo'">
                <input v-model="uiState.geoInput" placeholder="Countries (e.g. CN, US) comma separated" />
            </div>

            <!-- DEVICE UI -->
            <div v-else-if="newRule.rule_type === 'device'">
                <div style="display: flex; gap: 10px;">
                    <label><input type="checkbox" value="android" v-model="uiState.deviceOs" /> Android</label>
                    <label><input type="checkbox" value="ios" v-model="uiState.deviceOs" /> iOS</label>
                </div>
            </div>
        </div>

        <div class="form-group" style="align-self: flex-end;">
            <button class="btn btn-primary" @click="create">Add Rule</button>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Campaign</th>
            <th>Type</th>
            <th>Mode</th>
            <th width="40%">Value (JSON)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rules" :key="item.id">
            <td>{{ item.id }}</td>
            <td>{{ getCampName(item.campaign_id) }}</td>
            <td>{{ item.rule_type }}</td>
            <td :style="{color: item.is_include ? 'green' : 'red'}">
                {{ item.is_include ? 'INCLUDE' : 'EXCLUDE' }}
            </td>
            <td>
                <textarea v-if="item.isEditing" v-model="item._editValue" rows="3" style="font-family: monospace;"></textarea>
                <pre v-else style="margin: 0; font-size: 0.85rem;">{{ JSON.stringify(item.rule_value, null, 2) }}</pre>
            </td>
            <td class="actions">
              <button v-if="!item.isEditing" class="btn btn-sm btn-secondary" @click="item.isEditing = true">Edit JSON</button>
              <button v-else class="btn btn-sm btn-primary" @click="update(item)">Save</button>
              <button class="btn btn-sm btn-danger" @click="remove(item.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.form-grid {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    flex-wrap: wrap;
}
.form-group {
    flex: 1;
    min-width: 200px;
}
</style>
