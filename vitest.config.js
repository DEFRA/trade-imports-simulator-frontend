import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    setupFiles: ['.vite/setup-files.js'],
    // Dates render in local time, so tests pin it, however vitest is started. The simulators are
    // off by default, so tests switch them on.
    env: {
      TZ: 'UTC',
      TRACES_SIMULATOR_ENABLED: 'true',
      CDS_SIMULATOR_ENABLED: 'true',
      FIS_SIMULATOR_ENABLED: 'true'
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        ...configDefaults.exclude,
        '.public',
        'coverage',
        'postcss.config.js',
        'stylelint.config.js',
        'vitest.config.js',
        '.sonarlint',
        'babel.config.cjs'
      ]
    }
  }
})
