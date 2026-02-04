<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/client';

const advertisers = ref([]);
const newAdvertiser = ref({ name: '', company: '', balance: 0, status: 1 });

const loadAdvertisers = async () => {
  try {
    const data = await api.getAdvertisers();
    advertisers.value = data.data.map(adv => ({ ...adv, isEditing: false }));
  } catch (err) {
    console.error(err);
  }
};

const create = async () => {
  if (!newAdvertiser.value.name) return;
  await api.createAdvertiser(newAdvertiser.value);
  newAdvertiser.value = { name: '', company: '', balance: 0, status: 1 };
  loadAdvertisers();
};

const update = async (adv) => {
  await api.updateAdvertiser(adv.id, adv);
  adv.isEditing = false;
};

const remove = async (id) => {
  if (!confirm('Are you sure?')) return;
  await api.deleteAdvertiser(id);
  loadAdvertisers();
};

onMounted(loadAdvertisers);
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Advertisers</h2>
    </div>

    <!-- Create Form -->
    <div class="card">
      <h3>New Advertiser</h3>
      <div style="display: flex; gap: 10px; align-items: flex-end;">
        <div style="flex: 1;">
          <label>Name</label>
          <input v-model="newAdvertiser.name" placeholder="Advertiser Name" />
        </div>
        <div style="flex: 1;">
          <label>Company</label>
          <input v-model="newAdvertiser.company" placeholder="Company Name" />
        </div>
        <div style="width: 100px;">
          <label>Balance</label>
          <input v-model.number="newAdvertiser.balance" type="number" />
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
            <th>Company</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="adv in advertisers" :key="adv.id">
            <td>{{ adv.id }}</td>
            <td>
              <input v-if="adv.isEditing" v-model="adv.name" />
              <span v-else>{{ adv.name }}</span>
            </td>
            <td>
              <input v-if="adv.isEditing" v-model="adv.company" />
              <span v-else>{{ adv.company || '-' }}</span>
            </td>
            <td>
              <input v-if="adv.isEditing" v-model.number="adv.balance" type="number" />
              <span v-else>${{ adv.balance }}</span>
            </td>
            <td>
                <select v-if="adv.isEditing" v-model="adv.status">
                    <option :value="1">Active</option>
                    <option :value="2">Paused</option>
                    <option :value="3">Deleted</option>
                </select>
                <span v-else>{{ adv.status === 1 ? 'Active' : 'Inactive' }}</span>
            </td>
            <td class="actions">
              <button v-if="!adv.isEditing" class="btn btn-sm btn-secondary" @click="adv.isEditing = true">Edit</button>
              <button v-else class="btn btn-sm btn-primary" @click="update(adv)">Save</button>
              <button class="btn btn-sm btn-danger" @click="remove(adv.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
