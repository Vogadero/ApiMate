import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ApiMate',
  description: 'A full-featured API testing extension for VS Code',
  base: '/ApiMate/',
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/ApiMate/icon.png' }]
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en'
    },
    zh: {
      label: '中文',
      lang: 'zh-CN',
      link: '/zh/',
      description: '全功能 VS Code API 测试扩展',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: '功能', link: '/zh/features/http-request' },
          {
            text: 'v0.0.4',
            items: [
              { text: '更新日志', link: '/zh/guide/changelog' },
              { text: 'GitHub', link: 'https://github.com/vogadero/ApiMate' }
            ]
          }
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '指南',
              items: [
                { text: '快速开始', link: '/zh/guide/getting-started' },
                { text: '键盘快捷键', link: '/zh/guide/keyboard-shortcuts' },
                { text: '配置项', link: '/zh/guide/configuration' },
                { text: '更新日志', link: '/zh/guide/changelog' }
              ]
            }
          ],
          '/zh/features/': [
            {
              text: '功能特性',
              items: [
                { text: 'HTTP 请求编辑器', link: '/zh/features/http-request' },
                { text: '响应查看器', link: '/zh/features/response-viewer' },
                { text: '集合管理', link: '/zh/features/collections' },
                { text: '环境变量', link: '/zh/features/environment-variables' },
                { text: '导入与导出', link: '/zh/features/import-export' },
                { text: '脚本与测试', link: '/zh/features/scripts-testing' },
                { text: '多协议支持', link: '/zh/features/multi-protocol' },
                { text: '历史记录', link: '/zh/features/history' },
                { text: '其他功能', link: '/zh/features/other-features' }
              ]
            }
          ]
        },
        footer: {
          message: '基于 MIT 许可证发布。',
          copyright: 'Copyright 2026 Vogadero'
        },
        docFooter: {
          prev: '上一页',
          next: '下一页'
        },
        outline: {
          label: '页面导航'
        },
        lastUpdated: {
          text: '最后更新于'
        },
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式'
      }
    }
  },
  themeConfig: {
    logo: '/icon.png',
    nav: [
      { text: 'Guide', link: '/en/guide/getting-started' },
      { text: 'Features', link: '/en/features/http-request' },
      {
        text: 'v0.0.4',
        items: [
          { text: 'Changelog', link: '/en/guide/changelog' },
          { text: 'GitHub', link: 'https://github.com/vogadero/ApiMate' }
        ]
      }
    ],
    sidebar: {
      '/en/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/en/guide/getting-started' },
            { text: 'Keyboard Shortcuts', link: '/en/guide/keyboard-shortcuts' },
            { text: 'Configuration', link: '/en/guide/configuration' },
            { text: 'Changelog', link: '/en/guide/changelog' }
          ]
        }
      ],
      '/en/features/': [
        {
          text: 'Features',
          items: [
            { text: 'HTTP Request Editor', link: '/en/features/http-request' },
            { text: 'Response Viewer', link: '/en/features/response-viewer' },
            { text: 'Collections', link: '/en/features/collections' },
            { text: 'Environment Variables', link: '/en/features/environment-variables' },
            { text: 'Import & Export', link: '/en/features/import-export' },
            { text: 'Scripts & Testing', link: '/en/features/scripts-testing' },
            { text: 'Multi-Protocol Support', link: '/en/features/multi-protocol' },
            { text: 'History', link: '/en/features/history' },
            { text: 'Other Features', link: '/en/features/other-features' }
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
