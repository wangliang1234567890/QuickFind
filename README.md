# QuickFind Chrome Extension

QuickFind 是一个强大的 Chrome 扩展，它能帮助用户快速搜索和分析信息。通过集成 Google Gemini API，它提供了智能的内容分析和摘要功能。

## 主要功能

- 🔍 智能搜索：整合多个搜索源的结果
- 🤖 AI 分析：使用 Google Gemini API 进行内容分析
- 📊 智能摘要：自动生成搜索结果的摘要
- 🔄 数据持久化：保存搜索历史和结果
- 🌙 暗色模式：支持系统主题自动切换

## 技术特点

- 使用 Google Gemini API 进行内容分析
- 支持多语言翻译功能
- 现代化的 UI 设计
- 高效的数据缓存机制
- 响应式设计适配

## 安装使用

1. 下载项目代码
2. 在 Chrome 浏览器中打开 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目目录

## 配置说明

使用前需要配置以下 API 密钥：

- Google Gemini API
- DeepL 翻译 API
- Twitter API（可选）

## 开发说明

项目结构：
```
QuickFind/
├── css/
│   └── popup.css
├── js/
│   ├── popup.js
│   └── background.js
├── manifest.json
└── popup.html
```

## 更新日志

### v1.0.0
- 基础搜索功能
- AI 内容分析
- 数据持久化
- 暗色模式支持

## 贡献指南

欢迎提交 Pull Request 或创建 Issue。

## 许可证

MIT License 