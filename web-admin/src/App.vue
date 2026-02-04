<script setup>
</script>

<template>
  <div class="app-container">
    <nav class="sidebar">
      <h1>LiteAds</h1>
      <router-link to="/advertisers" class="nav-link">Advertisers</router-link>
      <router-link to="/campaigns" class="nav-link">Campaigns</router-link>
      <router-link to="/creatives" class="nav-link">Creatives</router-link>
      <router-link to="/targeting" class="nav-link">Targeting</router-link>
    </nav>
    <main class="main-content">
      <router-view></router-view>
    </main>
  </div>
</template>
