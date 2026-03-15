<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon start>mdi-chart-box-outline</v-icon>
            报表概览
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

          <!-- Date Range Selector -->
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

    <!-- Summary Cards -->
    <v-row v-if="overview">
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">总展示</div>
                <div class="text-h4">{{ formatNumber(overview.totalImpressions) }}</div>
              </div>
              <v-icon size="48" color="primary" opacity="0.3">mdi-eye-outline</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">总点击</div>
                <div class="text-h4">{{ formatNumber(overview.totalClicks) }}</div>
              </div>
              <v-icon size="48" color="success" opacity="0.3">mdi-cursor-default-click-outline</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">总花费</div>
                <div class="text-h4">${{ formatNumber(overview.totalSpend) }}</div>
              </div>
              <v-icon size="48" color="warning" opacity="0.3">mdi-currency-usd</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">平均 CTR</div>
                <div class="text-h4">{{ overview.avgCTR }}%</div>
              </div>
              <v-icon size="48" color="info" opacity="0.3">mdi-percent</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts -->
    <v-row v-if="overview">
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-chart-line</v-icon>
            趋势图
          </v-card-title>
          <v-card-text>
            <div ref="trendChart" style="height: 300px" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-chart-pie</v-icon>
            指标分布
          </v-card-title>
          <v-card-text>
            <div ref="pieChart" style="height: 300px" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Daily Data Table -->
    <v-row v-if="overview">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-table</v-icon>
            每日数据
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="tableHeaders"
              :items="overview.dailyData"
              density="compact"
            >
              <template #item.impressions="{ item }">
                {{ formatNumber(item.impressions) }}
              </template>
              <template #item.clicks="{ item }">
                {{ formatNumber(item.clicks) }}
              </template>
              <template #item.spend="{ item }">
                ${{ formatNumber(item.spend) }}
              </template>
              <template #item.ctr="{ item }">
                {{ ((item.clicks / item.impressions) * 100).toFixed(2) }}%
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading State -->
    <v-row v-if="loading && !overview">
      <v-col cols="12" class="text-center py-8">
        <v-progress-circular indeterminate size="64" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useReportStore } from "../../stores/reports";
import * as echarts from "echarts";

const reportStore = useReportStore();

const loading = computed(() => reportStore.loading);
const overview = computed(() => reportStore.overviewData);

const startDate = ref(reportStore.dateRange.start);
const endDate = ref(reportStore.dateRange.end);

const trendChart = ref(null);
const pieChart = ref(null);
let trendChartInstance = null;
let pieChartInstance = null;

const tableHeaders = [
  { title: "日期", key: "date" },
  { title: "展示", key: "impressions" },
  { title: "点击", key: "clicks" },
  { title: "花费", key: "spend" },
  { title: "CTR", key: "ctr", sortable: false },
];

function formatNumber(num) {
  if (!num) return "0";
  return Number(num).toLocaleString();
}

function applyDateRange() {
  reportStore.setDateRange(startDate.value, endDate.value);
  refresh();
}

async function refresh() {
  await reportStore.fetchOverview();
  await nextTick();
  renderCharts();
}

function renderCharts() {
  if (!overview.value) return;

  // Trend Chart
  if (trendChart.value) {
    if (trendChartInstance) {
      trendChartInstance.dispose();
    }
    trendChartInstance = echarts.init(trendChart.value);

    const dates = overview.value.dailyData.map((d) => d.date);
    const impressions = overview.value.dailyData.map((d) => d.impressions);
    const clicks = overview.value.dailyData.map((d) => d.clicks);

    trendChartInstance.setOption({
      tooltip: {
        trigger: "axis",
      },
      legend: {
        data: ["展示", "点击"],
        textStyle: { color: "#fff" },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: { color: "#fff" },
      },
      yAxis: [
        {
          type: "value",
          name: "展示",
          axisLabel: { color: "#fff" },
          nameTextStyle: { color: "#fff" },
        },
        {
          type: "value",
          name: "点击",
          axisLabel: { color: "#fff" },
          nameTextStyle: { color: "#fff" },
        },
      ],
      series: [
        {
          name: "展示",
          type: "line",
          data: impressions,
          smooth: true,
          areaStyle: { opacity: 0.3 },
        },
        {
          name: "点击",
          type: "line",
          yAxisIndex: 1,
          data: clicks,
          smooth: true,
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
          data: [
            { value: overview.value.totalImpressions, name: "展示" },
            { value: overview.value.totalClicks, name: "点击" },
            { value: overview.value.totalConversions, name: "转化" },
          ],
        },
      ],
    });
  }
}

onMounted(async () => {
  await reportStore.fetchOverview();
  await nextTick();
  renderCharts();
});

// Handle window resize
watch(
  () => [trendChart.value, pieChart.value],
  () => {
    window.addEventListener("resize", () => {
      trendChartInstance?.resize();
      pieChartInstance?.resize();
    });
  }
);
</script>
