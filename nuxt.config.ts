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
          src: "/roslib.min.js",
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

  // Pre-compress public files (gzip + brotli) at build time: the simulator's
  // index.wasm drops from ~38 MB to a fraction of that on the wire.
  nitro: {
    compressPublicAssets: true
  },

  runtimeConfig: {
    public: {
      baseURL: process.env.BE_BASE_URL || 'http://localhost:8000/'
    }
  }
})