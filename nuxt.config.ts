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

  app: {
    head: {
      script: [
        {
          src: "/eventemitter2.min.js",
          defer: true
        },
        {
          src: "/easeljs.min.js",
          defer: true
        },
        {
          src: "/roslib.min.js",
          defer: true
        },
        {
          src: "/ros2d.min.js",
          defer: true
        },
      ]
    }
  },

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