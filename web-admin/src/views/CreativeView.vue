<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/client';

const creatives = ref([]);
const campaigns = ref([]);

const newCreative = ref({
    title: '',
    campaign_id: null,
    landing_url: '',
    image_url: '',
    video_url: '',
    width: 0,
    height: 0,
    creative_type: 1, // Banner
    status: 1
});

const loadData = async () => {
    try {
        const [creats, camps] = await Promise.all([
            api.getCreatives(),
            api.getCampaigns()
        ]);
        creatives.value = creats.data.map(c => ({ ...c, isEditing: false }));
        campaigns.value = camps.data;
    } catch (err) {
        console.error(err);
    }
};

const create = async () => {
    if (!newCreative.value.title || !newCreative.value.campaign_id || !newCreative.value.landing_url) {
        alert("Title, Campaign, and Landing URL are required");
        return;
    }
    await api.createCreative(newCreative.value);
    newCreative.value = { title: '', campaign_id: null, landing_url: '', image_url: '', video_url: '', width: 0, height: 0, creative_type: 1, status: 1 };
    loadData();
};

const update = async (item) => {
    await api.updateCreative(item.id, item);
    item.isEditing = false;
};

const remove = async (id) => {
    if (!confirm('Are you sure?')) return;
    await api.deleteCreative(id);
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
      <h2>Creatives</h2>
    </div>

    <!-- Create Form -->
    <div class="card">
      <h3>New Creative</h3>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 10px; align-items: end;">
        <div>
          <label>Title</label>
          <input v-model="newCreative.title" placeholder="Creative Title" />
        </div>
        <div>
          <label>Campaign</label>
          <select v-model="newCreative.campaign_id">
              <option :value="null">Select Campaign</option>
              <option v-for="c in campaigns" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
            <label>Landing URL</label>
            <input v-model="newCreative.landing_url" placeholder="http://..." />
        </div>
        <div>
            <label>Type</label>
            <select v-model="newCreative.creative_type">
                <option :value="1">Banner</option>
                <option :value="2">Native</option>
                <option :value="3">Video</option>
            </select>
        </div>
        <div style="grid-column: span 2; display: flex; gap: 10px;">
            <div style="flex: 1;" v-if="newCreative.creative_type !== 3">
                <label>Image URL</label>
                <input v-model="newCreative.image_url" placeholder="http://.../image.jpg" />
            </div>
            <div style="flex: 1;" v-if="newCreative.creative_type === 3">
                <label>Video URL</label>
                <input v-model="newCreative.video_url" placeholder="http://.../video.mp4" />
            </div>
        </div>
        <div style="grid-column: span 2; display: flex; gap: 10px;">
             <div style="flex: 1;">
                <label>Width</label>
                <input v-model.number="newCreative.width" type="number" />
             </div>
             <div style="flex: 1;">
                <label>Height</label>
                <input v-model.number="newCreative.height" type="number" />
             </div>
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
            <th>Title</th>
            <th>Type</th>
            <th>Dimensions</th>
            <th>Media</th>
            <th>Landing URL</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in creatives" :key="item.id">
            <td>{{ item.id }}</td>
            <td>
              <input v-if="item.isEditing" v-model="item.title" />
              <span v-else>{{ item.title }}</span>
            </td>
            <td>
                <select v-if="item.isEditing" v-model="item.creative_type">
                    <option :value="1">Banner</option>
                    <option :value="2">Native</option>
                    <option :value="3">Video</option>
                </select>
                <span v-else>
                    {{ item.creative_type === 1 ? 'Banner' : item.creative_type === 2 ? 'Native' : 'Video' }}
                </span>
            </td>
            <td>
                <div v-if="item.isEditing" style="display: flex; gap: 5px;">
                    <input v-model.number="item.width" type="number" style="width: 60px;" placeholder="W" />
                    <span>x</span>
                    <input v-model.number="item.height" type="number" style="width: 60px;" placeholder="H" />
                </div>
                <span v-else>
                    {{ item.width }} x {{ item.height }}
                </span>
            </td>
            <td>
                <div v-if="item.isEditing">
                    <input v-if="item.creative_type !== 3" v-model="item.image_url" placeholder="Image URL" style="margin-bottom: 5px;" />
                    <input v-if="item.creative_type === 3" v-model="item.video_url" placeholder="Video URL" />
                </div>
                <div v-else>
                    <div v-if="item.creative_type !== 3 && item.image_url" :title="item.image_url" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        Image: {{ item.image_url }}
                    </div>
                    <div v-if="item.creative_type === 3 && item.video_url" :title="item.video_url" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        Video: {{ item.video_url }}
                    </div>
                </div>
            </td>
            <td>
                <input v-if="item.isEditing" v-model="item.landing_url" />
                <a v-else :href="item.landing_url" target="_blank" style="max-width: 150px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ item.landing_url }}</a>
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
