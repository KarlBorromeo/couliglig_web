// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/image',
    '@nuxt/fonts',
    'vuetify-nuxt-module',
    '@pinia/nuxt'
  ],
  vuetify: {
    moduleOptions: {
      /* optional */
    },
    vuetifyOptions: {
      theme: {
        defaultTheme: 'light'
      }
    }
  },
  runtimeConfig: {
    public: {
      baseURL: process.env.BE_BASE_URL || 'http://localhost:8000/'
    }
  }
})