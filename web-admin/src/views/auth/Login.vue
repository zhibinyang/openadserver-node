<template>
  <v-container fluid class="fill-height bg-grey-lighten-4">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>OpenAdServer Admin</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form @submit.prevent="handleLogin" ref="formRef">
              <v-text-field
                v-model="username"
                label="Username"
                prepend-icon="mdi-account"
                :rules="[rules.required]"
                :error-messages="errors.username"
                :disabled="loading"
                autocomplete="username"
              />
              <v-text-field
                v-model="password"
                label="Password"
                prepend-icon="mdi-lock"
                :type="showPassword ? 'text' : 'password'"
                :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append="showPassword = !showPassword"
                :rules="[rules.required]"
                :error-messages="errors.password"
                :disabled="loading"
                autocomplete="current-password"
              />
              <v-alert
                v-if="loginError"
                type="error"
                class="mt-3"
                density="compact"
              >
                {{ loginError }}
              </v-alert>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              @click="handleLogin"
              :loading="loading"
              :disabled="loading"
            >
              Login
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import api from '@/api/client'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const loginError = ref('')
const formRef = ref(null)
const errors = ref({
  username: '',
  password: '',
})

const rules = {
  required: (v) => !!v || 'This field is required',
}

async function handleLogin() {
  loginError.value = ''
  errors.value = { username: '', password: '' }

  if (!username.value) {
    errors.value.username = 'Username is required'
    return
  }
  if (!password.value) {
    errors.value.password = 'Password is required'
    return
  }

  loading.value = true

  try {
    const response = await api.login(username.value, password.value)
    const { user, token } = response.data

    authStore.setAuth(token, user)
    appStore.showSnackbar('Login successful!', 'success')

    router.push('/')
  } catch (error) {
    if (error.response?.status === 401) {
      loginError.value = 'Invalid username or password'
    } else if (error.response?.data?.message) {
      loginError.value = error.response.data.message
    } else {
      loginError.value = 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>
