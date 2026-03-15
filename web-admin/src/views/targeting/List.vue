<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon start>mdi-target</v-icon>
            定向规则管理
            <v-spacer />
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
              新建规则
            </v-btn>
          </v-card-title>

          <v-card-text>
            <!-- Filters -->
            <v-row class="mb-4">
              <v-col cols="12" md="4">
                <v-select
                  v-model="filterType"
                  :items="[{ label: '全部类型', value: null }, ...targetingTypes]"
                  item-title="label"
                  item-value="value"
                  label="定向类型"
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="filterCampaign"
                  :items="[{ name: '全部 Campaign', id: null }, ...campaigns]"
                  item-title="name"
                  item-value="id"
                  label="Campaign"
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="filterStatus"
                  :items="statusOptions"
                  item-title="label"
                  item-value="value"
                  label="状态"
                  clearable
                  density="compact"
                />
              </v-col>
            </v-row>

            <!-- Data Table -->
            <v-data-table
              :headers="headers"
              :items="filteredRules"
              :loading="loading"
              hover
            >
              <template #item.type="{ item }">
                <v-chip :prepend-icon="getTypeIcon(item.type)" size="small">
                  {{ getTypeLabel(item.type) }}
                </v-chip>
              </template>

              <template #item.operator="{ item }">
                <v-chip
                  :color="item.operator === 'include' ? 'success' : 'error'"
                  size="small"
                >
                  {{ item.operator === 'include' ? '包含' : '排除' }}
                </v-chip>
              </template>

              <template #item.campaign="{ item }">
                <router-link
                  :to="`/campaigns/${item.campaign_id}`"
                  class="text-decoration-none"
                >
                  {{ getCampaignName(item.campaign_id) }}
                </router-link>
              </template>

              <template #item.priority="{ item }">
                <v-progress-linear
                  :model-value="item.priority"
                  color="primary"
                  height="8"
                  rounded
                />
              </template>

              <template #item.status="{ item }">
                <v-chip
                  :color="item.status === 'active' ? 'success' : 'default'"
                  size="small"
                >
                  {{ item.status === 'active' ? '启用' : '禁用' }}
                </v-chip>
              </template>

              <template #item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  size="small"
                  variant="text"
                  :to="`/targeting/${item.id}`"
                />
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="openEdit(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click="confirmDelete(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create/Edit Dialog -->
    <v-dialog v-model="dialog" max-width="800" persistent>
      <v-card>
        <v-card-title>
          <v-icon start>{{ editRule ? 'mdi-pencil' : 'mdi-plus' }}</v-icon>
          {{ editRule ? '编辑规则' : '新建规则' }}
        </v-card-title>
        <TargetingForm
          ref="formRef"
          :rule="editRule"
          @cancel="closeDialog"
          @save="handleSave"
        />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">取消</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveRule">
            {{ editRule ? '更新' : '创建' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-model="deleteDialog"
      title="确认删除"
      :message="`确定要删除规则 '${ruleToDelete?.name}' 吗？`"
      confirm-text="删除"
      confirm-color="error"
      @confirm="deleteRule"
    />
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useTargetingStore } from "../../stores/targeting";
import { useCampaignStore } from "../../stores/campaign";
import { useAppStore } from "../../stores/app";
import TargetingForm from "../../components/targeting/TargetingForm.vue";
import ConfirmDialog from "../../components/common/ConfirmDialog.vue";

const targetingStore = useTargetingStore();
const campaignStore = useCampaignStore();
const appStore = useAppStore();

const loading = computed(() => targetingStore.loading);
const rules = computed(() => targetingStore.rules);
const campaigns = computed(() => campaignStore.campaigns);
const targetingTypes = computed(() => targetingStore.targetingTypes);

const getTypeLabel = (type) => targetingStore.getTypeLabel(type);
const getTypeIcon = (type) => targetingStore.getTypeIcon(type);

const headers = [
  { title: "ID", key: "id", width: 80 },
  { title: "规则名称", key: "name" },
  { title: "Campaign", key: "campaign" },
  { title: "类型", key: "type" },
  { title: "操作符", key: "operator" },
  { title: "优先级", key: "priority", width: 120 },
  { title: "状态", key: "status" },
  { title: "操作", key: "actions", sortable: false, width: 150 },
];

const statusOptions = [
  { label: "启用", value: "active" },
  { label: "禁用", value: "inactive" },
];

const filterType = ref(null);
const filterCampaign = ref(null);
const filterStatus = ref(null);

const filteredRules = computed(() => {
  return rules.value.filter((rule) => {
    if (filterType.value && rule.type !== filterType.value) return false;
    if (filterCampaign.value && rule.campaign_id !== filterCampaign.value)
      return false;
    if (filterStatus.value && rule.status !== filterStatus.value) return false;
    return true;
  });
});

const dialog = ref(false);
const editRule = ref(null);
const formRef = ref(null);
const saving = ref(false);

const deleteDialog = ref(false);
const ruleToDelete = ref(null);

function getCampaignName(campaignId) {
  const campaign = campaigns.value.find((c) => c.id === campaignId);
  return campaign?.name || `Campaign #${campaignId}`;
}

function openCreate() {
  editRule.value = null;
  dialog.value = true;
}

function openEdit(rule) {
  editRule.value = { ...rule };
  dialog.value = true;
}

function closeDialog() {
  dialog.value = false;
  editRule.value = null;
}

async function saveRule() {
  const isValid = await formRef.value?.validate();
  if (!isValid) return;

  saving.value = true;
  try {
    const data = formRef.value?.getFormData();
    if (editRule.value) {
      await targetingStore.updateRule(editRule.value.id, data);
      appStore.showSnackbar("规则更新成功", "success");
    } else {
      await targetingStore.createRule(data);
      appStore.showSnackbar("规则创建成功", "success");
    }
    closeDialog();
  } catch (e) {
    appStore.showSnackbar(`操作失败: ${e.message}`, "error");
  } finally {
    saving.value = false;
  }
}

function handleSave() {
  saveRule();
}

function confirmDelete(rule) {
  ruleToDelete.value = rule;
  deleteDialog.value = true;
}

async function deleteRule() {
  try {
    await targetingStore.deleteRule(ruleToDelete.value.id);
    appStore.showSnackbar("规则已删除", "success");
  } catch (e) {
    appStore.showSnackbar(`删除失败: ${e.message}`, "error");
  } finally {
    ruleToDelete.value = null;
  }
}

onMounted(async () => {
  await Promise.all([
    targetingStore.fetchRules(),
    campaignStore.fetchCampaigns(),
  ]);
});
</script>
