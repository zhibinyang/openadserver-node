<template>
  <v-container fluid>
    <v-row v-if="loading">
      <v-col cols="12" class="text-center py-8">
        <v-progress-circular indeterminate size="64" />
      </v-col>
    </v-row>

    <template v-else-if="rule">
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon start>{{ getTypeIcon(rule.type) }}</v-icon>
              {{ rule.name }}
              <v-spacer />
              <v-btn
                variant="text"
                prepend-icon="mdi-arrow-left"
                to="/targeting"
              >
                返回列表
              </v-btn>
            </v-card-title>

            <v-divider />

            <v-card-text>
              <v-row>
                <!-- Basic Info -->
                <v-col cols="12" md="6">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle-1">
                      <v-icon start>mdi-information-outline</v-icon>
                      基本信息
                    </v-card-title>
                    <v-card-text>
                      <v-list density="compact">
                        <v-list-item>
                          <template #prepend>
                            <v-icon>mdi-identifier</v-icon>
                          </template>
                          <v-list-item-title>ID</v-list-item-title>
                          <v-list-item-subtitle>{{ rule.id }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <template #prepend>
                            <v-icon>mdi-bullseye-arrow</v-icon>
                          </template>
                          <v-list-item-title>Campaign</v-list-item-title>
                          <v-list-item-subtitle>
                            <router-link :to="`/campaigns/${rule.campaign_id}`">
                              {{ campaignName }}
                            </router-link>
                          </v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <template #prepend>
                            <v-icon>{{ getTypeIcon(rule.type) }}</v-icon>
                          </template>
                          <v-list-item-title>定向类型</v-list-item-title>
                          <v-list-item-subtitle>
                            <v-chip size="small">{{ getTypeLabel(rule.type) }}</v-chip>
                          </v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <template #prepend>
                            <v-icon>mdi-swap-vertical</v-icon>
                          </template>
                          <v-list-item-title>操作符</v-list-item-title>
                          <v-list-item-subtitle>
                            <v-chip
                              :color="rule.operator === 'include' ? 'success' : 'error'"
                              size="small"
                            >
                              {{ rule.operator === 'include' ? '包含' : '排除' }}
                            </v-chip>
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-card-text>
                  </v-card>
                </v-col>

                <!-- Priority & Status -->
                <v-col cols="12" md="6">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle-1">
                      <v-icon start>mdi-tune</v-icon>
                      配置
                    </v-card-title>
                    <v-card-text>
                      <v-list density="compact">
                        <v-list-item>
                          <template #prepend>
                            <v-icon>mdi-priority-high</v-icon>
                          </template>
                          <v-list-item-title>优先级</v-list-item-title>
                          <v-list-item-subtitle>
                            <div class="d-flex align-center ga-2">
                              <v-progress-linear
                                :model-value="rule.priority"
                                color="primary"
                                height="8"
                                rounded
                                style="max-width: 100px"
                              />
                              <span>{{ rule.priority }}</span>
                            </div>
                          </v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <template #prepend>
                            <v-icon>mdi-power</v-icon>
                          </template>
                          <v-list-item-title>状态</v-list-item-title>
                          <v-list-item-subtitle>
                            <v-chip
                              :color="rule.status === 'active' ? 'success' : 'default'"
                              size="small"
                            >
                              {{ rule.status === 'active' ? '启用' : '禁用' }}
                            </v-chip>
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-card-text>
                  </v-card>
                </v-col>

                <!-- Targeting Values -->
                <v-col cols="12">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle-1">
                      <v-icon start>mdi-target</v-icon>
                      定向值
                    </v-card-title>
                    <v-card-text>
                      <!-- Geo values -->
                      <template v-if="rule.type === 'geo'">
                        <v-chip
                          v-for="value in rule.values"
                          :key="value"
                          class="ma-1"
                          prepend-icon="mdi-map-marker"
                        >
                          {{ value }}
                        </v-chip>
                      </template>

                      <!-- Time values -->
                      <template v-if="rule.type === 'time'">
                        <v-row>
                          <v-col cols="12" md="6">
                            <div class="text-caption text-medium-emphasis">时间段</div>
                            <div class="text-body-1">
                              {{ rule.time_start || '--:--' }} - {{ rule.time_end || '--:--' }}
                            </div>
                          </v-col>
                          <v-col cols="12" md="6">
                            <div class="text-caption text-medium-emphasis">生效日期</div>
                            <div class="d-flex flex-wrap ga-1 mt-1">
                              <v-chip
                                v-for="day in rule.days"
                                :key="day"
                                size="small"
                              >
                                {{ getDayName(day) }}
                              </v-chip>
                            </div>
                          </v-col>
                        </v-row>
                      </template>

                      <!-- Device values -->
                      <template v-if="rule.type === 'device'">
                        <v-chip
                          v-for="value in rule.values"
                          :key="value"
                          class="ma-1"
                          :prepend-icon="getDeviceIcon(value)"
                        >
                          {{ getDeviceName(value) }}
                        </v-chip>
                      </template>

                      <!-- Browser values -->
                      <template v-if="rule.type === 'browser'">
                        <v-chip
                          v-for="value in rule.values"
                          :key="value"
                          class="ma-1"
                        >
                          {{ getBrowserName(value) }}
                        </v-chip>
                      </template>

                      <!-- OS values -->
                      <template v-if="rule.type === 'os'">
                        <v-chip
                          v-for="value in rule.values"
                          :key="value"
                          class="ma-1"
                        >
                          {{ getOSName(value) }}
                        </v-chip>
                      </template>

                      <!-- Language values -->
                      <template v-if="rule.type === 'language'">
                        <v-chip
                          v-for="value in rule.values"
                          :key="value"
                          class="ma-1"
                          prepend-icon="mdi-translate"
                        >
                          {{ getLanguageName(value) }}
                        </v-chip>
                      </template>

                      <!-- Frequency values -->
                      <template v-if="rule.type === 'frequency'">
                        <v-row>
                          <v-col cols="12" md="6">
                            <div class="text-caption text-medium-emphasis">频次上限</div>
                            <div class="text-h5">{{ rule.frequency_cap }} 次</div>
                          </v-col>
                          <v-col cols="12" md="6">
                            <div class="text-caption text-medium-emphasis">周期</div>
                            <div class="text-h5">{{ getPeriodName(rule.frequency_period) }}</div>
                          </v-col>
                        </v-row>
                      </template>

                      <!-- Domain values -->
                      <template v-if="rule.type === 'domain'">
                        <v-chip
                          v-for="value in rule.values"
                          :key="value"
                          class="ma-1"
                          prepend-icon="mdi-domain"
                        >
                          {{ value }}
                        </v-chip>
                      </template>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>

            <v-card-actions>
              <v-btn
                color="primary"
                prepend-icon="mdi-pencil"
                @click="openEdit"
              >
                编辑
              </v-btn>
              <v-btn
                color="error"
                variant="text"
                prepend-icon="mdi-delete"
                @click="confirmDelete"
              >
                删除
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- Edit Dialog -->
      <v-dialog v-model="editDialog" max-width="800" persistent>
        <v-card>
          <v-card-title>
            <v-icon start>mdi-pencil</v-icon>
            编辑规则
          </v-card-title>
          <TargetingForm
            ref="formRef"
            :rule="rule"
            @cancel="closeEdit"
            @save="handleSave"
          />
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="closeEdit">取消</v-btn>
            <v-btn color="primary" :loading="saving" @click="saveRule">
              更新
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Delete Confirmation -->
      <ConfirmDialog
        v-model="deleteDialog"
        title="确认删除"
        :message="`确定要删除规则 '${rule.name}' 吗？`"
        confirm-text="删除"
        confirm-color="error"
        @confirm="deleteRule"
      />
    </template>

    <v-row v-else>
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-8">
            <v-icon size="64" color="error">mdi-alert-circle-outline</v-icon>
            <div class="text-h6 mt-4">规则不存在</div>
            <v-btn color="primary" to="/targeting" class="mt-4">
              返回列表
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTargetingStore } from "../../stores/targeting";
import { useCampaignStore } from "../../stores/campaign";
import { useAppStore } from "../../stores/app";
import TargetingForm from "../../components/targeting/TargetingForm.vue";
import ConfirmDialog from "../../components/common/ConfirmDialog.vue";

const route = useRoute();
const router = useRouter();
const targetingStore = useTargetingStore();
const campaignStore = useCampaignStore();
const appStore = useAppStore();

const loading = ref(true);
const rule = computed(() => targetingStore.currentRule);
const campaigns = computed(() => campaignStore.campaigns);

const getTypeLabel = (type) => targetingStore.getTypeLabel(type);
const getTypeIcon = (type) => targetingStore.getTypeIcon(type);

const campaignName = computed(() => {
  const campaign = campaigns.value.find((c) => c.id === rule.value?.campaign_id);
  return campaign?.name || `Campaign #${rule.value?.campaign_id}`;
});

// Helper functions for display
const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const getDayName = (day) => dayNames[day] || day;

const deviceNames = {
  desktop: '桌面',
  mobile: '手机',
  tablet: '平板',
  smart_tv: '智能电视',
};
const getDeviceName = (device) => deviceNames[device] || device;
const getDeviceIcon = (device) => {
  const icons = {
    desktop: 'mdi-desktop-mac',
    mobile: 'mdi-cellphone',
    tablet: 'mdi-tablet',
    smart_tv: 'mdi-television',
  };
  return icons[device] || 'mdi-devices';
};

const browserNames = {
  chrome: 'Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
  edge: 'Edge',
  opera: 'Opera',
};
const getBrowserName = (browser) => browserNames[browser] || browser;

const osNames = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  ios: 'iOS',
  android: 'Android',
};
const getOSName = (os) => osNames[os] || os;

const languageNames = {
  zh: '中文',
  en: '英文',
  ja: '日文',
  ko: '韩文',
  de: '德文',
  fr: '法文',
};
const getLanguageName = (lang) => languageNames[lang] || lang;

const periodNames = {
  hour: '每小时',
  day: '每天',
  week: '每周',
  month: '每月',
};
const getPeriodName = (period) => periodNames[period] || period;

const editDialog = ref(false);
const formRef = ref(null);
const saving = ref(false);

const deleteDialog = ref(false);

function openEdit() {
  editDialog.value = true;
}

function closeEdit() {
  editDialog.value = false;
}

async function saveRule() {
  const isValid = await formRef.value?.validate();
  if (!isValid) return;

  saving.value = true;
  try {
    const data = formRef.value?.getFormData();
    await targetingStore.updateRule(rule.value.id, data);
    appStore.showSnackbar("规则更新成功", "success");
    closeEdit();
  } catch (e) {
    appStore.showSnackbar(`更新失败: ${e.message}`, "error");
  } finally {
    saving.value = false;
  }
}

function handleSave() {
  saveRule();
}

function confirmDelete() {
  deleteDialog.value = true;
}

async function deleteRule() {
  try {
    await targetingStore.deleteRule(rule.value.id);
    appStore.showSnackbar("规则已删除", "success");
    router.push("/targeting");
  } catch (e) {
    appStore.showSnackbar(`删除失败: ${e.message}`, "error");
  }
}

onMounted(async () => {
  const id = parseInt(route.params.id);
  await Promise.all([
    targetingStore.fetchRules(),
    campaignStore.fetchCampaigns(),
  ]);
  targetingStore.currentRule = targetingStore.rules.find((r) => r.id === id);
  loading.value = false;
});
</script>
