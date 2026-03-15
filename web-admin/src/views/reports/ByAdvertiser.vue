<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon start>mdi-account-group-outline</v-icon>
            按广告主报表
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

          <!-- Date Range -->
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="startDate"
                  label="开始日期"
                  type="date"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="endDate"
                  label="结束日期"
                  type="date"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-btn color="primary" @click="applyDateRange">应用</v-btn>
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
            <div class="text-caption text-medium-emphasis">广告主数量</div>
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

    <!-- Chart -->
    <v-row v-if="report.length > 0">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-chart-bar</v-icon>
            花费对比
          </v-card-title>
          <v-card-text>
            <div ref="barChart" style="height: 300px" />
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
                  :to="`/advertisers/${item.id}`"
                  class="text-decoration-none"
                >
                  {{ item.name }}
                </router-link>
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
import * as echarts from "echarts";

const reportStore = useReportStore();

const loading = computed(() => reportStore.loading);
const report = computed(() => reportStore.advertiserReport);

const startDate = ref(reportStore.dateRange.start);
const endDate = ref(reportStore.dateRange.end);

const barChart = ref(null);
let chartInstance = null;

const headers = [
  { title: "ID", key: "id", width: 80 },
  { title: "广告主", key: "name" },
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

function applyDateRange() {
  reportStore.setDateRange(startDate.value, endDate.value);
  refresh();
}

async function refresh() {
  await reportStore.fetchAdvertiserReport();
  await nextTick();
  renderChart();
}

function renderChart() {
  if (!barChart.value || report.value.length === 0) return;

  if (chartInstance) {
    chartInstance.dispose();
  }
  chartInstance = echarts.init(barChart.value);

  const sortedData = [...report.value]
    .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend))
    .slice(0, 10);

  chartInstance.setOption({
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

onMounted(async () => {
  await reportStore.fetchAdvertiserReport();
  await nextTick();
  renderChart();
});

watch(
  () => barChart.value,
  () => {
    window.addEventListener("resize", () => {
      chartInstance?.resize();
    });
  }
);
</script>
