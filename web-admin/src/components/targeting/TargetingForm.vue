<template>
  <v-form ref="formRef" v-model="valid">
    <v-card-text>
      <v-row>
        <v-col cols="12" md="6">
          <v-select
            v-model="formData.campaign_id"
            :items="campaigns"
            item-title="name"
            item-value="id"
            label="所属 Campaign"
            :rules="[rules.required]"
            :disabled="!!props.campaignId"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="formData.type"
            :items="targetingTypes"
            item-title="label"
            item-value="value"
            label="定向类型"
            :rules="[rules.required]"
          >
            <template #selection="{ item }">
              <v-icon start>{{ item.raw.icon }}</v-icon>
              {{ item.raw.label }}
            </template>
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps">
                <template #prepend>
                  <v-icon>{{ item.raw.icon }}</v-icon>
                </template>
              </v-list-item>
            </template>
          </v-select>
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="formData.operator"
            :items="operators"
            item-title="label"
            item-value="value"
            label="操作符"
            :rules="[rules.required]"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="formData.name"
            label="规则名称"
            :rules="[rules.required]"
          />
        </v-col>

        <!-- Type-specific value inputs -->
        <v-col cols="12">
          <v-divider class="mb-4" />
          <div class="text-subtitle-1 mb-2">定向值</div>
        </v-col>

        <!-- Geo targeting -->
        <template v-if="formData.type === 'geo'">
          <v-col cols="12">
            <v-combobox
              v-model="formData.values"
              :items="geoOptions"
              label="地理位置"
              multiple
              chips
              closable-chips
              hint="输入国家、省份或城市代码"
              persistent-hint
            />
          </v-col>
        </template>

        <!-- Time targeting -->
        <template v-if="formData.type === 'time'">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formData.time_start"
              label="开始时间"
              type="time"
              hint="例如: 08:00"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="formData.time_end"
              label="结束时间"
              type="time"
              hint="例如: 22:00"
              persistent-hint
            />
          </v-col>
          <v-col cols="12">
            <v-select
              v-model="formData.days"
              :items="dayOptions"
              label="生效日期"
              multiple
              chips
            />
          </v-col>
        </template>

        <!-- Device targeting -->
        <template v-if="formData.type === 'device'">
          <v-col cols="12">
            <v-select
              v-model="formData.values"
              :items="deviceOptions"
              label="设备类型"
              multiple
              chips
            />
          </v-col>
        </template>

        <!-- Browser targeting -->
        <template v-if="formData.type === 'browser'">
          <v-col cols="12">
            <v-select
              v-model="formData.values"
              :items="browserOptions"
              label="浏览器"
              multiple
              chips
            />
          </v-col>
        </template>

        <!-- OS targeting -->
        <template v-if="formData.type === 'os'">
          <v-col cols="12">
            <v-select
              v-model="formData.values"
              :items="osOptions"
              label="操作系统"
              multiple
              chips
            />
          </v-col>
        </template>

        <!-- Language targeting -->
        <template v-if="formData.type === 'language'">
          <v-col cols="12">
            <v-select
              v-model="formData.values"
              :items="languageOptions"
              label="语言"
              multiple
              chips
            />
          </v-col>
        </template>

        <!-- Frequency targeting -->
        <template v-if="formData.type === 'frequency'">
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="formData.frequency_cap"
              label="频次上限"
              type="number"
              min="1"
              hint="每个用户的最大展示次数"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="formData.frequency_period"
              :items="periodOptions"
              label="频次周期"
            />
          </v-col>
        </template>

        <!-- Domain targeting -->
        <template v-if="formData.type === 'domain'">
          <v-col cols="12">
            <v-combobox
              v-model="formData.values"
              label="域名列表"
              multiple
              chips
              closable-chips
              hint="输入域名，按回车添加"
              persistent-hint
            />
          </v-col>
        </template>

        <!-- Priority and Status -->
        <v-col cols="12">
          <v-divider class="mb-4" />
        </v-col>
        <v-col cols="12" md="6">
          <v-slider
            v-model="formData.priority"
            label="优先级"
            min="1"
            max="100"
            thumb-label
            hint="数值越大优先级越高"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-switch
            v-model="formData.status"
            label="启用规则"
            color="primary"
            :true-value="'active'"
            :false-value="'inactive'"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-form>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useTargetingStore } from "../../stores/targeting";
import { useCampaignStore } from "../../stores/campaign";

const props = defineProps({
  rule: {
    type: Object,
    default: null,
  },
  campaignId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(["save", "cancel"]);

const targetingStore = useTargetingStore();
const campaignStore = useCampaignStore();

const formRef = ref(null);
const valid = ref(false);

const formData = ref({
  campaign_id: props.campaignId || null,
  type: "geo",
  operator: "include",
  name: "",
  values: [],
  time_start: "",
  time_end: "",
  days: [],
  frequency_cap: 3,
  frequency_period: "day",
  priority: 50,
  status: "active",
});

const rules = {
  required: (v) => !!v || "此字段必填",
};

const campaigns = computed(() => campaignStore.campaigns);
const targetingTypes = computed(() => targetingStore.targetingTypes);
const operators = computed(() => targetingStore.operators);

// Options for different targeting types
const geoOptions = ["CN", "US", "UK", "JP", "KR", "DE", "FR", "AU", "CA"];
const deviceOptions = [
  { title: "桌面", value: "desktop" },
  { title: "手机", value: "mobile" },
  { title: "平板", value: "tablet" },
  { title: "智能电视", value: "smart_tv" },
];
const browserOptions = [
  { title: "Chrome", value: "chrome" },
  { title: "Firefox", value: "firefox" },
  { title: "Safari", value: "safari" },
  { title: "Edge", value: "edge" },
  { title: "Opera", value: "opera" },
];
const osOptions = [
  { title: "Windows", value: "windows" },
  { title: "macOS", value: "macos" },
  { title: "Linux", value: "linux" },
  { title: "iOS", value: "ios" },
  { title: "Android", value: "android" },
];
const languageOptions = [
  { title: "中文", value: "zh" },
  { title: "英文", value: "en" },
  { title: "日文", value: "ja" },
  { title: "韩文", value: "ko" },
  { title: "德文", value: "de" },
  { title: "法文", value: "fr" },
];
const dayOptions = [
  { title: "周一", value: 1 },
  { title: "周二", value: 2 },
  { title: "周三", value: 3 },
  { title: "周四", value: 4 },
  { title: "周五", value: 5 },
  { title: "周六", value: 6 },
  { title: "周日", value: 7 },
];
const periodOptions = [
  { title: "每小时", value: "hour" },
  { title: "每天", value: "day" },
  { title: "每周", value: "week" },
  { title: "每月", value: "month" },
];

// Reset values when type changes
watch(
  () => formData.value.type,
  () => {
    formData.value.values = [];
    formData.value.time_start = "";
    formData.value.time_end = "";
    formData.value.days = [];
    formData.value.frequency_cap = 3;
    formData.value.frequency_period = "day";
  }
);

onMounted(async () => {
  if (campaigns.value.length === 0) {
    await campaignStore.fetchCampaigns();
  }

  if (props.rule) {
    formData.value = { ...formData.value, ...props.rule };
  }
});

async function validate() {
  const { valid: isValid } = await formRef.value?.validate();
  return isValid;
}

function getFormData() {
  const data = { ...formData.value };
  // Clean up type-specific fields
  if (data.type !== "time") {
    delete data.time_start;
    delete data.time_end;
    delete data.days;
  }
  if (data.type !== "frequency") {
    delete data.frequency_cap;
    delete data.frequency_period;
  }
  return data;
}

defineExpose({
  validate,
  getFormData,
});
</script>
