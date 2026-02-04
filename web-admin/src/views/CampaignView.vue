<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/client';

const campaigns = ref([]);
const advertisers = ref([]);
// Default new campaign
const newCampaign = ref({
    name: '',
    advertiser_id: null,
    budget_daily: 100,
    bid_type: 1, // CPM
    bid_amount: 1.0,
    status: 1,
    is_active: true
});

const loadData = async () => {
  try {
    const [msgs, advs] = await Promise.all([
        api.getCampaigns(),
        api.getAdvertisers()
    ]);
    campaigns.value = msgs.data.map(c => ({ ...c, isEditing: false }));
    advertisers.value = advs.data;
  } catch (err) {
    console.error(err);
  }
};

const create = async () => {
    if (!newCampaign.value.name || !newCampaign.value.advertiser_id) {
        alert("Name and Advertiser are required");
        return;
    }
    await api.createCampaign(newCampaign.value);
    newCampaign.value = { name: '', advertiser_id: null, budget_daily: 100, bid_type: 1, bid_amount: 1.0, status: 1, is_active: true };
    loadData();
};

const update = async (item) => {
    await api.updateCampaign(item.id, item);
    item.isEditing = false;
};

const remove = async (id) => {
    if (!confirm('Are you sure?')) return;
    await api.deleteCampaign(id);
    loadData();
};

// Helper to get advertiser name
const getAdvName = (id) => {
    const adv = advertisers.value.find(a => a.id === id);
    return adv ? adv.name : id;
};

onMounted(loadData);
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Campaigns</h2>
    </div>

    <!-- Create Form -->
    <div class="card">
      <h3>New Campaign</h3>
      <div style="display: grid; grid-template-columns: repeat(6, 1fr) auto; gap: 10px; align-items: end;">
        <div>
          <label>Name</label>
          <input v-model="newCampaign.name" placeholder="Campaign Name" />
        </div>
        <div>
          <label>Advertiser</label>
          <select v-model="newCampaign.advertiser_id">
              <option :value="null">Select Advertiser</option>
              <option v-for="adv in advertisers" :key="adv.id" :value="adv.id">
                  {{ adv.name }}
              </option>
          </select>
        </div>
        <div>
          <label>Daily Budget</label>
          <input v-model.number="newCampaign.budget_daily" type="number" />
        </div>
        <div>
           <label>Bid Type</label>
           <select v-model="newCampaign.bid_type">
               <option :value="1">CPM</option>
               <option :value="2">CPC</option>
               <option :value="3">CPA</option>
               <option :value="4">OCPM</option>
           </select>
        </div>
        <div>
           <label>Bid Amount</label>
           <input v-model.number="newCampaign.bid_amount" type="number" step="0.01" />
        </div>
        <div>
            <label>Active</label>
            <select v-model="newCampaign.is_active">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
            </select>
        </div>
        <button class="btn btn-primary" @click="create">Create</button>
      </div>
    </div>

    <!-- List -->
    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Advertiser</th>
            <th>Budget</th>
            <th>Bid Type</th>
            <th>Bid Amount</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in campaigns" :key="item.id">
            <td>{{ item.id }}</td>
            <td>
              <input v-if="item.isEditing" v-model="item.name" />
              <span v-else>{{ item.name }}</span>
            </td>
            <td>
                <!-- Advertiser usually shouldn't change, but can be maintained if needed. Display only for now unless editing -->
                 {{ getAdvName(item.advertiser_id) }}
            </td>
            <td>
              <input v-if="item.isEditing" v-model.number="item.budget_daily" type="number" />
              <span v-else>${{ item.budget_daily }}</span>
            </td>
            <td>
                <select v-if="item.isEditing" v-model="item.bid_type">
                   <option :value="1">CPM</option>
                   <option :value="2">CPC</option>
                   <option :value="3">CPA</option>
                   <option :value="4">OCPM</option>
               </select>
               <span v-else>
                   {{ item.bid_type === 1 ? 'CPM' : item.bid_type === 2 ? 'CPC' : item.bid_type === 3 ? 'CPA' : 'OCPM' }}
               </span>
            </td>
            <td>
                <input v-if="item.isEditing" v-model.number="item.bid_amount" type="number" step="0.01" />
                <span v-else>${{ item.bid_amount }}</span>
            </td>
            <td>
                <input v-if="item.isEditing" type="checkbox" v-model="item.is_active" />
                <span v-else :style="{color: item.is_active ? 'green' : 'red'}">
                    {{ item.is_active ? 'Active' : 'Inactive' }}
                </span>
            </td>
            <td class="actions">
              <button v-if="!item.isEditing" class="btn btn-sm btn-secondary" @click="item.isEditing = true">Edit</button>
              <button v-else class="btn btn-sm btn-primary" @click="update(item)">Save</button>
              <button class="btn btn-sm btn-danger" @click="remove(item.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
