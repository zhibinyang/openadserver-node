import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
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
        path: 'targeting/:id',
        name: 'targeting-detail',
        component: () => import('@/views/targeting/Detail.vue'),
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
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/List.vue'),
        meta: { requiresAdmin: true },
      },
      {
        path: 'api-keys',
        name: 'api-keys',
        component: () => import('@/views/api-keys/List.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated
  const isAdmin = authStore.isAdmin

  // Public routes
  if (to.meta.public) {
    if (isAuthenticated && to.name === 'login') {
      return next('/') // Already logged in, redirect to home
    }
    return next()
  }

  // Auth required
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next('/login')
  }

  // Admin required
  if (to.meta.requiresAdmin && !isAdmin) {
    return next('/') // Not admin, redirect to home
  }

  next()
})

export default router
