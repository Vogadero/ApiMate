import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'ApiMate',
  description: 'A full-featured API testing extension for VS Code',
  base: '/ApiMate/',
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }]
  ],
  themeConfig: {
    logo: '/icon.png',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/http-request' },
      {
        text: 'v0.0.4',
        items: [
          { text: 'Changelog', link: '/guide/changelog' },
          { text: 'GitHub', link: 'https://github.com/vogadero/ApiMate' }
        ]
      }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Changelog', link: '/guide/changelog' }
          ]
        }
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'HTTP Request Editor', link: '/features/http-request' },
            { text: 'Response Viewer', link: '/features/response-viewer' },
            { text: 'Collections', link: '/features/collections' },
            { text: 'Environment Variables', link: '/features/environment-variables' },
            { text: 'Import & Export', link: '/features/import-export' },
            { text: 'Scripts & Testing', link: '/features/scripts-testing' },
            { text: 'Multi-Protocol Support', link: '/features/multi-protocol' },
            { text: 'History', link: '/features/history' },
            { text: 'Other Features', link: '/features/other-features' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/vogadero/ApiMate' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2026 Vogadero'
    },
    search: {
      provider: 'local'
    }
  }
})
