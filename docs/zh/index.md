---
layout: home

hero:
  name: ApiMate
  text: VS Code API 测试工具
  tagline: 全功能 API 测试扩展。支持 HTTP、gRPC、WebSocket、SSE、集合、环境变量、认证、脚本和自动化测试。
  image:
    src: /icon.png
    alt: ApiMate
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 功能特性
      link: /zh/features/http-request
    - theme: alt
      text: GitHub
      link: https://github.com/vogadero/ApiMate

features:
  - title: HTTP 请求编辑器
    details: 支持所有 HTTP 方法、URL 环境变量自动补全、Query 参数编辑器、多种请求体类型和全面的认证支持。
    link: /zh/features/http-request
  - title: 响应查看器
    details: 语法高亮响应体、响应头查看器、带颜色指示的状态码、响应时间和大小、Cookie 查看器和导出选项。
    link: /zh/features/response-viewer
  - title: 集合管理
    details: 将请求组织到集合中，支持多级文件夹嵌套、拖拽排序、带迭代数据的集合运行器。
    link: /zh/features/collections
  - title: 环境变量
    details: 多个命名环境、全局变量、Secret 变量加密、变量解析预览、.env 文件导入和一键激活。
    link: /zh/features/environment-variables
  - title: 导入与导出
    details: 从 Postman、OpenAPI/Swagger、cURL、HAR 和 .env 文件导入。以多种格式导出集合、环境和请求。
    link: /zh/features/import-export
  - title: 脚本与测试
    details: 带 pm API 的前置和后置脚本、Chai.js 断言、结构化测试用例和带通过/失败指示器的集合运行器。
    link: /zh/features/scripts-testing
  - title: 多协议支持
    details: HTTP/HTTPS、gRPC（一元、服务端流、客户端流、双向流）、WebSocket 和 Server-Sent Events (SSE)。
    link: /zh/features/multi-protocol
  - title: 历史记录
    details: 自动保存请求历史、固定重要请求、搜索和过滤、从历史重新发送以及清除历史。
    link: /zh/features/history
  - title: VS Code 集成
    details: API 路由检测 CodeLens、键盘快捷键、主题集成、Git 友好的 JSON 存储和文件监视器自动重载。
    link: /zh/features/other-features
---
