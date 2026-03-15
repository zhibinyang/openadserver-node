import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
      },
      {
        path: 'advertisers',
        name: 'advertisers',
        component: () => import('@/views/advertisers/List.vue'),
      },
      {
        path: 'advertisers/:id',
        name: 'advertiser-detail',
        component: () => import('@/views/advertisers/Detail.vue'),
      },
      {
        path: 'campaigns',
        name: 'campaigns',
        component: () => import('@/views/campaigns/List.vue'),
      },
      {
        path: 'campaigns/:id',
        name: 'campaign-detail',
        component: () => import('@/views/campaigns/Detail.vue'),
      },
      {
        path: 'creatives',
        name: 'creatives',
        component: () => import('@/views/creatives/List.vue'),
      },
      {
        path: 'creatives/:id',
        name: 'creative-detail',
        component: () => import('@/views/creatives/Detail.vue'),
      },
      {
        path: 'targeting',
        name: 'targeting',
        component: () => import('@/views/targeting/List.vue'),
      },
      {
        path: 'reports/overview',
        name: 'reports-overview',
        component: () => import('@/views/reports/Overview.vue'),
      },
      {
        path: 'reports/advertisers',
        name: 'reports-advertisers',
        component: () => import('@/views/reports/ByAdvertiser.vue'),
      },
      {
        path: 'reports/campaigns',
        name: 'reports-campaigns',
        component: () => import('@/views/reports/ByCampaign.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
