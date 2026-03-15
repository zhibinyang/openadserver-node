<template>
  <v-navigation-drawer
    :rail="rail"
    permanent
    color="surface"
    @update:rail="$emit('update:rail', $event)"
  >
    <v-list nav dense>
      <v-list-item
        to="/"
        prepend-icon="mdi-view-dashboard"
        title="Dashboard"
        value="dashboard"
      />

      <v-list-group value="management">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-cog"
            title="Management"
          />
        </template>

        <v-list-item
          to="/advertisers"
          prepend-icon="mdi-account-group"
          title="Advertisers"
          value="advertisers"
        />
        <v-list-item
          to="/campaigns"
          prepend-icon="mdi-bullhorn"
          title="Campaigns"
          value="campaigns"
        />
        <v-list-item
          to="/creatives"
          prepend-icon="mdi-image-multiple"
          title="Creatives"
          value="creatives"
        />
        <v-list-item
          to="/targeting"
          prepend-icon="mdi-target"
          title="Targeting"
          value="targeting"
        />
      </v-list-group>

      <v-list-group value="reports">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-chart-bar"
            title="Reports"
          />
        </template>

        <v-list-item
          to="/reports/overview"
          prepend-icon="mdi-chart-line"
          title="Overview"
          value="report-overview"
        />
        <v-list-item
          to="/reports/advertisers"
          prepend-icon="mdi-chart-pie"
          title="By Advertiser"
          value="report-advertisers"
        />
        <v-list-item
          to="/reports/campaigns"
          prepend-icon="mdi-chart-areaspline"
          title="By Campaign"
          value="report-campaigns"
        />
      </v-list-group>
    </v-list>

    <template #append>
      <v-list nav dense>
        <v-list-item
          prepend-icon="mdi-help-circle"
          title="Help"
          value="help"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup>
defineProps({
  rail: Boolean
})
defineEmits(['update:rail'])
</script>
