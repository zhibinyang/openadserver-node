import { createRouter, createWebHistory } from 'vue-router'
import AdvertiserView from '../views/AdvertiserView.vue'
import CampaignView from '../views/CampaignView.vue'
import CreativeView from '../views/CreativeView.vue'
import TargetingView from '../views/TargetingView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/advertisers'
        },
        {
            path: '/advertisers',
            name: 'advertisers',
            component: AdvertiserView
        },
        {
            path: '/campaigns',
            name: 'campaigns',
            component: CampaignView
        },
        {
            path: '/creatives',
            name: 'creatives',
            component: CreativeView
        },
        {
            path: '/targeting',
            name: 'targeting',
            component: TargetingView
        }
    ]
})

export default router
