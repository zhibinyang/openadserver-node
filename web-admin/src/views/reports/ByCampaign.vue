<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon start>mdi-bullseye-arrow</v-icon>
            按 Campaign 报表
            <v-spacer />
            <v-btn
              color="primary"
              variant="text"
              prepend-icon="mdi-refresh"
              :loading="loading"
              @click="refresh"
            >
              刷新
            </v-btn>
          </v-card-title>

          <!-- Filters -->
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="startDate"
                  label="开始日期"
                  type="date"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="endDate"
                  label="结束日期"
                  type="date"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="filterAdvertiser"
                  :items="[{ name: '全部广告主', id: null }, ...advertisers]"
                  item-title="name"
                  item-value="id"
                  label="广告主"
                  density="compact"
                  hide-details
                  clearable
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-btn color="primary" @click="applyFilters">应用</v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Summary -->
    <v-row v-if="report.length > 0">
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Campaign 数量</div>
            <div class="text-h4">{{ report.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="text-caption text-medium-emphasis">总展示</div>
            <div class="text-h4">{{ formatNumber(totalImpressions) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="text-caption text-medium-emphasis">总点击</div>
            <div class="text-h4">{{ formatNumber(totalClicks) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="text-caption text-medium-emphasis">总花费</div>
            <div class="text-h4">${{ formatNumber(totalSpend) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts -->
    <v-row v-if="report.length > 0">
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-chart-bar</v-icon>
            花费 Top 10
          </v-card-title>
          <v-card-text>
            <div ref="barChart" style="height: 300px" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-chart-pie</v-icon>
            状态分布
          </v-card-title>
          <v-card-text>
            <div ref="pieChart" style="height: 300px" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Data Table -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-table</v-icon>
            详细数据
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="report"
              :loading="loading"
              hover
            >
              <template #item.name="{ item }">
                <router-link
                  :to="`/campaigns/${item.id}`"
                  class="text-decoration-none"
                >
                  {{ item.name }}
                </router-link>
              </template>
              <template #item.advertiser="{ item }">
                <router-link
                  :to="`/advertisers/${item.advertiser_id}`"
                  class="text-decoration-none"
                >
                  {{ getAdvertiserName(item.advertiser_id) }}
                </router-link>
              </template>
              <template #item.status="{ item }">
                <v-chip
                  :color="getStatusColor(item.status)"
                  size="small"
                >
                  {{ getStatusLabel(item.status) }}
                </v-chip>
              </template>
              <template #item.impressions="{ item }">
                {{ formatNumber(item.impressions) }}
              </template>
              <template #item.clicks="{ item }">
                {{ formatNumber(item.clicks) }}
              </template>
              <template #item.ctr="{ item }">
                <v-chip size="small" :color="getCTRColor(item.ctr)">
                  {{ item.ctr }}%
                </v-chip>
              </template>
              <template #item.spend="{ item }">
                ${{ formatNumber(item.spend) }}
              </template>
              <template #item.conversions="{ item }">
                {{ formatNumber(item.conversions) }}
              </template>
              <template #item.cvr="{ item }">
                {{ item.cvr }}%
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useReportStore } from "../../stores/reports";
import { useAdvertiserStore } from "../../stores/advertiser";
import * as echarts from "echarts";

const reportStore = useReportStore();
const advertiserStore = useAdvertiserStore();

const loading = computed(() => reportStore.loading);
const report = computed(() => reportStore.campaignReport);
const advertisers = computed(() => advertiserStore.advertisers);

const startDate = ref(reportStore.dateRange.start);
const endDate = ref(reportStore.dateRange.end);
const filterAdvertiser = ref(null);

const barChart = ref(null);
const pieChart = ref(null);
let barChartInstance = null;
let pieChartInstance = null;

const headers = [
  { title: "ID", key: "id", width: 80 },
  { title: "Campaign", key: "name" },
  { title: "广告主", key: "advertiser" },
  { title: "状态", key: "status" },
  { title: "展示", key: "impressions" },
  { title: "点击", key: "clicks" },
  { title: "CTR", key: "ctr" },
  { title: "花费", key: "spend" },
  { title: "转化", key: "conversions" },
  { title: "CVR", key: "cvr" },
];

const totalImpressions = computed(() =>
  report.value.reduce((sum, r) => sum + r.impressions, 0)
);
const totalClicks = computed(() =>
  report.value.reduce((sum, r) => sum + r.clicks, 0)
);
const totalSpend = computed(() =>
  report.value.reduce((sum, r) => sum + parseFloat(r.spend), 0).toFixed(2)
);

const statusLabels = {
  active: "投放中",
  paused: "已暂停",
  completed: "已完成",
  draft: "草稿",
};

function getStatusLabel(status) {
  return statusLabels[status] || status;
}

function getStatusColor(status) {
  const colors = {
    active: "success",
    paused: "warning",
    completed: "info",
    draft: "default",
  };
  return colors[status] || "default";
}

function formatNumber(num) {
  if (!num) return "0";
  return Number(num).toLocaleString();
}

function getCTRColor(ctr) {
  const value = parseFloat(ctr);
  if (value >= 3) return "success";
  if (value >= 2) return "primary";
  if (value >= 1) return "warning";
  return "error";
}

function getAdvertiserName(advertiserId) {
  const advertiser = advertisers.value.find((a) => a.id === advertiserId);
  return advertiser?.name || `Advertiser #${advertiserId}`;
}

function applyFilters() {
  reportStore.setDateRange(startDate.value, endDate.value);
  refresh();
}

async function refresh() {
  await reportStore.fetchCampaignReport(filterAdvertiser.value);
  await nextTick();
  renderCharts();
}

function renderCharts() {
  if (report.value.length === 0) return;

  // Bar Chart
  if (barChart.value) {
    if (barChartInstance) {
      barChartInstance.dispose();
    }
    barChartInstance = echarts.init(barChart.value);

    const sortedData = [...report.value]
      .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend))
      .slice(0, 10);

    barChartInstance.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: sortedData.map((r) => r.name),
        axisLabel: {
          color: "#fff",
          rotate: 30,
        },
      },
      yAxis: {
        type: "value",
        name: "花费 ($)",
        axisLabel: { color: "#fff" },
        nameTextStyle: { color: "#fff" },
      },
      series: [
        {
          type: "bar",
          data: sortedData.map((r) => parseFloat(r.spend)),
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    });
  }

  // Pie Chart
  if (pieChart.value) {
    if (pieChartInstance) {
      pieChartInstance.dispose();
    }
    pieChartInstance = echarts.init(pieChart.value);

    const statusCounts = {};
    report.value.forEach((r) => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    pieChartInstance.setOption({
      tooltip: {
        trigger: "item",
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: "#1e1e1e",
            borderWidth: 2,
          },
          label: {
            show: true,
            color: "#fff",
          },
          data: Object.entries(statusCounts).map(([status, count]) => ({
            value: count,
            name: getStatusLabel(status),
          })),
        },
      ],
    });
  }
}

onMounted(async () => {
  await Promise.all([
    reportStore.fetchCampaignReport(),
    advertiserStore.fetchAdvertisers(),
  ]);
  await nextTick();
  renderCharts();
});

watch(
  () => [barChart.value, pieChart.value],
  () => {
    window.addEventListener("resize", () => {
      barChartInstance?.resize();
      pieChartInstance?.resize();
    });
  }
);
</script>
