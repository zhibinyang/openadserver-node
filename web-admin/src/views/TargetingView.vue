<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/client';

// ─── Option Lists ───
const countryOptions = [
    { code: 'US', name: 'United States' }, { code: 'CN', name: 'China' },
    { code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' },
    { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' }, { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' }, { code: 'IN', name: 'India' },
    { code: 'BR', name: 'Brazil' }, { code: 'RU', name: 'Russia' },
    { code: 'SG', name: 'Singapore' }, { code: 'HK', name: 'Hong Kong' },
    { code: 'TW', name: 'Taiwan' }, { code: 'ID', name: 'Indonesia' },
    { code: 'TH', name: 'Thailand' }, { code: 'VN', name: 'Vietnam' },
    { code: 'MY', name: 'Malaysia' }, { code: 'PH', name: 'Philippines' },
    { code: 'MX', name: 'Mexico' }, { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' }, { code: 'NL', name: 'Netherlands' },
    { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
    { code: 'PL', name: 'Poland' }, { code: 'TR', name: 'Turkey' },
    { code: 'SA', name: 'Saudi Arabia' }, { code: 'AE', name: 'UAE' },
    { code: 'IL', name: 'Israel' }, { code: 'ZA', name: 'South Africa' },
    { code: 'NG', name: 'Nigeria' }, { code: 'EG', name: 'Egypt' },
    { code: 'AR', name: 'Argentina' }, { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' }, { code: 'NZ', name: 'New Zealand' },
    { code: 'IE', name: 'Ireland' }, { code: 'AT', name: 'Austria' },
];

const osOptions = [
    'android', 'ios', 'windows', 'macos', 'linux',
    'chrome os', 'harmonyos', 'fire os', 'tizen',
];

const browserOptions = [
    'chrome', 'safari', 'firefox', 'edge', 'opera',
    'samsung browser', 'uc browser', 'brave', 'vivaldi',
    'yandex browser', 'whale', 'duckduckgo',
];

const deviceOptions = [
    'iphone', 'ipad', 'samsung', 'xiaomi', 'huawei',
    'oppo', 'vivo', 'oneplus', 'google pixel', 'sony',
    'lg', 'motorola', 'nokia', 'realme', 'asus',
];

// ─── State ───
const rules = ref([]);
const campaigns = ref([]);

const newRule = ref({
    campaign_id: null,
    is_include: true,
});

const uiState = ref({
    countries: [],
    cities: '',
    os: [],
    browser: [],
    device: [],
});

const resetUI = () => {
    uiState.value = { countries: [], cities: '', os: [], browser: [], device: [] };
};

// ─── Data Loading ───
const loadData = async () => {
    try {
        const [r, c] = await Promise.all([
            api.getTargetingRules(),
            api.getCampaigns(),
        ]);
        rules.value = r.data.map(item => ({
            ...item,
            isEditing: false,
            _editValue: JSON.stringify(item.rule_value),
        }));
        campaigns.value = c.data;
    } catch (err) {
        console.error(err);
    }
};

// ─── Create ───
const create = async () => {
    if (!newRule.value.campaign_id) {
        alert('Select a campaign');
        return;
    }

    const ruleValue = {};

    // Geo fields
    if (uiState.value.countries.length > 0) {
        ruleValue.countries = [...uiState.value.countries];
    }
    const cities = uiState.value.cities.split(',').map(s => s.trim()).filter(s => s);
    if (cities.length > 0) {
        ruleValue.cities = cities;
    }

    // Device fields
    if (uiState.value.os.length > 0) ruleValue.os = [...uiState.value.os];
    if (uiState.value.browser.length > 0) ruleValue.browser = [...uiState.value.browser];
    if (uiState.value.device.length > 0) ruleValue.device = [...uiState.value.device];

    if (Object.keys(ruleValue).length === 0) {
        alert('Please fill in at least one targeting field');
        return;
    }

    // Determine rule_type based on what's filled
    const hasGeo = ruleValue.countries || ruleValue.cities;
    const hasDevice = ruleValue.os || ruleValue.browser || ruleValue.device;
    let ruleType = 'combined';
    if (hasGeo && !hasDevice) ruleType = 'geo';
    if (!hasGeo && hasDevice) ruleType = 'device';

    await api.createTargetingRule({
        campaign_id: newRule.value.campaign_id,
        rule_type: ruleType,
        is_include: newRule.value.is_include,
        rule_value: ruleValue,
    });

    loadData();
    resetUI();
};

const update = async (item) => {
    try {
        item.rule_value = JSON.parse(item._editValue);
        await api.updateTargetingRule(item.id, item);
        item.isEditing = false;
    } catch (e) {
        alert('Invalid JSON format');
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

const formatRuleValue = (rule) => {
    const v = rule.rule_value;
    if (!v) return '{}';
    const parts = [];
    if (v.countries) parts.push(`Countries: ${v.countries.join(', ')}`);
    if (v.cities) parts.push(`Cities: ${v.cities.join(', ')}`);
    if (v.os) parts.push(`OS: ${v.os.join(', ')}`);
    if (v.browser) parts.push(`Browser: ${v.browser.join(', ')}`);
    if (v.device) parts.push(`Device: ${v.device.join(', ')}`);
    if (v.wildcard) parts.push('Wildcard (all)');
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(v, null, 2);
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
      <div class="form-row">
        <div class="form-group">
          <label>Campaign</label>
          <select v-model="newRule.campaign_id">
              <option :value="null">Select Campaign</option>
              <option v-for="c in campaigns" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-group">
            <label>Mode</label>
            <div class="radio-row">
                <label class="radio-label">
                    <input type="radio" :value="true" v-model="newRule.is_include" /> Include
                </label>
                <label class="radio-label">
                    <input type="radio" :value="false" v-model="newRule.is_include" /> Exclude
                </label>
            </div>
        </div>
      </div>

      <!-- All fields shown together -->
      <div class="config-section">
        <label class="config-title">Geo Targeting</label>
        <div class="config-fields">
            <div class="form-group">
                <label>Countries <a v-if="uiState.countries.length" class="clear-link" @click="uiState.countries = []">✕ clear</a></label>
                <select v-model="uiState.countries" multiple class="multi-select">
                    <option v-for="c in countryOptions" :key="c.code" :value="c.code">
                        {{ c.code }} - {{ c.name }}
                    </option>
                </select>
                <small>Hold Ctrl/Cmd to select multiple</small>
            </div>
            <div class="form-group">
                <label>Cities</label>
                <input v-model="uiState.cities" placeholder="e.g. New York, London, Tokyo (comma separated)" />
                <small>Free text, comma separated</small>
            </div>
        </div>
      </div>

      <div class="config-section">
        <label class="config-title">Device / UA Targeting</label>
        <div class="config-fields">
            <div class="form-group">
                <label>Operating System <a v-if="uiState.os.length" class="clear-link" @click="uiState.os = []">✕ clear</a></label>
                <select v-model="uiState.os" multiple class="multi-select">
                    <option v-for="o in osOptions" :key="o" :value="o">{{ o }}</option>
                </select>
            </div>
            <div class="form-group">
                <label>Browser <a v-if="uiState.browser.length" class="clear-link" @click="uiState.browser = []">✕ clear</a></label>
                <select v-model="uiState.browser" multiple class="multi-select">
                    <option v-for="b in browserOptions" :key="b" :value="b">{{ b }}</option>
                </select>
            </div>
            <div class="form-group">
                <label>Device <a v-if="uiState.device.length" class="clear-link" @click="uiState.device = []">✕ clear</a></label>
                <select v-model="uiState.device" multiple class="multi-select">
                    <option v-for="d in deviceOptions" :key="d" :value="d">{{ d }}</option>
                </select>
            </div>
        </div>
      </div>

      <div class="form-actions">
          <button class="btn btn-primary" @click="create">Add Rule</button>
          <small class="hint">All selected conditions are saved as a single rule (AND logic)</small>
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
            <th width="40%">Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rules" :key="item.id">
            <td>{{ item.id }}</td>
            <td>{{ getCampName(item.campaign_id) }}</td>
            <td><span class="badge" :class="item.rule_type">{{ item.rule_type }}</span></td>
            <td>
                <span class="badge" :class="item.is_include ? 'include' : 'exclude'">
                    {{ item.is_include ? 'INCLUDE' : 'EXCLUDE' }}
                </span>
            </td>
            <td>
                <textarea v-if="item.isEditing" v-model="item._editValue" rows="4" class="json-editor"></textarea>
                <pre v-else class="rule-value">{{ formatRuleValue(item) }}</pre>
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

<style scoped>
.form-row {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 15px;
}
.form-group {
    flex: 1;
    min-width: 200px;
}
.form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 5px;
    font-size: 0.85rem;
    color: #ccc;
}
.form-group small {
    display: block;
    margin-top: 3px;
    color: #888;
    font-size: 0.75rem;
}
.radio-row {
    display: flex;
    gap: 15px;
    margin-top: 5px;
}
.radio-label {
    display: inline !important;
    font-weight: 400 !important;
}
.config-section {
    border-top: 1px solid #333;
    padding-top: 15px;
    margin-bottom: 15px;
}
.config-title {
    font-weight: 700;
    font-size: 0.9rem;
    margin-bottom: 10px;
    display: block;
    color: #aaa;
}
.config-fields {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}
.multi-select {
    width: 100%;
    min-height: 120px;
    font-size: 0.85rem;
}
.clear-link {
    font-size: 0.75rem;
    color: #ee6c6c;
    cursor: pointer;
    font-weight: 400;
    margin-left: 6px;
}
.clear-link:hover {
    text-decoration: underline;
}
.form-actions {
    padding-top: 10px;
}
.hint {
    display: inline-block;
    margin-left: 12px;
    color: #888;
    font-size: 0.8rem;
}
.badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}
.badge.geo { background: #1a3a5c; color: #6cb4ee; }
.badge.device { background: #3a2a1a; color: #eeb46c; }
.badge.include { background: #1a3a1a; color: #6cee6c; }
.badge.exclude { background: #3a1a1a; color: #ee6c6c; }
.rule-value {
    margin: 0;
    font-size: 0.85rem;
    white-space: pre-wrap;
    color: #ccc;
}
.json-editor {
    width: 100%;
    font-family: monospace;
    font-size: 0.85rem;
}
</style>
