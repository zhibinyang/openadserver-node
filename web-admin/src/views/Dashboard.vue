<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-6">
      <h1 class="text-h4">Dashboard</h1>
      <v-btn-toggle v-model="dateRange" density="compact" mandatory>
        <v-btn value="today">Today</v-btn>
        <v-btn value="7d">7 Days</v-btn>
        <v-btn value="30d">30 Days</v-btn>
      </v-btn-toggle>
    </div>

    <!-- Stat Cards -->
    <v-row>
      <v-col cols="12" sm="6" md="3">
        <StatCard
          title="Impressions"
          :value="stats.impressions"
          icon="mdi-eye"
          color="primary"
          :trend="stats.impressionsTrend"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <StatCard
          title="Clicks"
          :value="stats.clicks"
          icon="mdi-cursor-default-click"
          color="success"
          :trend="stats.clicksTrend"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <StatCard
          title="CTR"
          :value="stats.ctr"
          icon="mdi-percent"
          color="info"
          format="percent"
          :trend="stats.ctrTrend"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <StatCard
          title="Spend"
          :value="stats.spend"
          icon="mdi-currency-usd"
          color="warning"
          format="currency"
          :trend="stats.spendTrend"
        />
      </v-col>
    </v-row>

    <!-- Charts Row -->
    <v-row class="mt-4">
      <v-col cols="12" lg="8">
        <TrendChart title="Performance Trend" />
      </v-col>
      <v-col cols="12" lg="4">
        <StatusPieChart :data="campaignStatus" />
      </v-col>
    </v-row>

    <!-- Top Lists -->
    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <TopList title="Top Campaigns" :items="topCampaigns" />
      </v-col>
      <v-col cols="12" md="6">
        <TopList title="Top Advertisers" :items="topAdvertisers" />
      </v-col>
    </v-row>

    <!-- Recent Activity -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Recent Activity</v-card-title>
          <v-card-text>
            <v-timeline side="end" density="compact">
              <v-timeline-item
                v-for="activity in recentActivity"
                :key="activity.id"
                :dot-color="activity.color"
                size="small"
              >
                <div class="d-flex justify-space-between">
                  <div>
                    <strong>{{ activity.action }}</strong>
                    <span class="text-medium-emphasis ml-2">{{ activity.target }}</span>
                  </div>
                  <span class="text-caption text-medium-emphasis">{{ activity.time }}</span>
                </div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import StatCard from '@/components/dashboard/StatCard.vue'
import TrendChart from '@/components/dashboard/TrendChart.vue'
import StatusPieChart from '@/components/dashboard/StatusPieChart.vue'
import TopList from '@/components/dashboard/TopList.vue'

const dateRange = ref('7d')

// Mock data - will be replaced with API calls
const stats = reactive({
  impressions: 125840,
  impressionsTrend: 12.5,
  clicks: 3420,
  clicksTrend: 8.3,
  ctr: 2.72,
  ctrTrend: -2.1,
  spend: 4580,
  spendTrend: 15.2,
})

const campaignStatus = [
  { name: 'Active', value: 12 },
  { name: 'Paused', value: 5 },
  { name: 'Ended', value: 8 },
]

const topCampaigns = [
  { id: 1, name: 'Summer Sale 2024', advertiser: 'Acme Corp', status: 'Active', spend: 1250, impressions: 45000, clicks: 1200, link: '/campaigns/1' },
  { id: 2, name: 'Brand Awareness Q1', advertiser: 'Tech Inc', status: 'Active', spend: 980, impressions: 32000, clicks: 890, link: '/campaigns/2' },
  { id: 3, name: 'Product Launch', advertiser: 'StartupXYZ', status: 'Active', spend: 750, impressions: 28000, clicks: 720, link: '/campaigns/3' },
  { id: 4, name: 'Holiday Promo', advertiser: 'Retail Co', status: 'Paused', spend: 620, impressions: 21000, clicks: 540, link: '/campaigns/4' },
  { id: 5, name: 'App Install Drive', advertiser: 'MobileDev', status: 'Active', spend: 480, impressions: 18000, clicks: 480, link: '/campaigns/5' },
]

const topAdvertisers = [
  { id: 1, name: 'Acme Corp', advertiser: 'Enterprise', status: 'Active', spend: 2500, impressions: 85000, clicks: 2100, link: '/advertisers/1' },
  { id: 2, name: 'Tech Inc', advertiser: 'Enterprise', status: 'Active', spend: 1800, impressions: 62000, clicks: 1650, link: '/advertisers/2' },
  { id: 3, name: 'StartupXYZ', advertiser: 'SMB', status: 'Active', spend: 1200, impressions: 42000, clicks: 980, link: '/advertisers/3' },
  { id: 4, name: 'Retail Co', advertiser: 'SMB', status: 'Active', spend: 950, impressions: 35000, clicks: 820, link: '/advertisers/4' },
  { id: 5, name: 'MobileDev', advertiser: 'SMB', status: 'Active', spend: 720, impressions: 28000, clicks: 650, link: '/advertisers/5' },
]

const recentActivity = [
  { id: 1, action: 'Campaign created', target: 'Summer Sale 2024', time: '2 min ago', color: 'success' },
  { id: 2, action: 'Creative uploaded', target: 'Banner 300x250', time: '15 min ago', color: 'info' },
  { id: 3, action: 'Campaign paused', target: 'Holiday Promo', time: '1 hour ago', color: 'warning' },
  { id: 4, action: 'Advertiser added', target: 'NewClient Ltd', time: '3 hours ago', color: 'primary' },
  { id: 5, action: 'Budget updated', target: 'Brand Awareness Q1', time: '5 hours ago', color: 'info' },
]
</script>
