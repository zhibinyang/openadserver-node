<template>
  <div>
    <h1 class="text-h4 mb-4">Dashboard</h1>
    <v-row>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 text-primary">0</div>
            <div class="text-caption">Impressions</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 text-success">0</div>
            <div class="text-caption">Clicks</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 text-info">0%</div>
            <div class="text-caption">CTR</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 text-warning">$0</div>
            <div class="text-caption">Spend</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-card class="mt-4">
      <v-card-title>Coming Soon</v-card-title>
      <v-card-text>
        <p>Dashboard with charts and statistics will be implemented in Phase 2.</p>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
</script>
