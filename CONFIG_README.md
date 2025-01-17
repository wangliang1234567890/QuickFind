# QuickFind 配置说明

本文档说明如何配置和管理 QuickFind Chrome 扩展的各项设置。

## 配置文件

所有配置信息都存储在 `config.json` 文件中。该文件包含敏感信息，**不会**上传到 GitHub 仓库。

### 文件结构

```json
{
  "github": {
    "username": "你的GitHub用户名",
    "personal_access_token": "你的GitHub个人访问令牌",
    "repository": "仓库名称"
  },
  "apis": {
    "google": {
      "api_key": "Google API密钥",
      "search_engine_id": "自定义搜索引擎ID"
    },
    "twitter": {
      "bearer_token": "Twitter Bearer Token"
    },
    "deepl": {
      "api_key": "DeepL API密钥"
    },
    "gemini": {
      "api_key": "Google Gemini API密钥"
    }
  },
  "extension": {
    "version": "扩展版本",
    "name": "扩展名称",
    "description": "扩展描述"
  }
}
```

## 配置说明

### GitHub 配置
- `username`: 你的 GitHub 用户名
- `personal_access_token`: GitHub 个人访问令牌，用于代码推送
- `repository`: 项目仓库名称

### API 配置
1. Google Search API
   - 访问 https://console.cloud.google.com
   - 创建项目并启用 Custom Search API
   - 获取 API 密钥和搜索引擎 ID

2. Twitter API
   - 访问 https://developer.twitter.com
   - 申请开发者账号
   - 创建应用并获取 Bearer Token

3. DeepL API
   - 访问 https://www.deepl.com/pro-api
   - 注册账号并获取 API 密钥

4. Google Gemini API
   - 访问 https://makersuite.google.com/app/apikey
   - 创建项目并获取 API 密钥

## 注意事项

1. 请妥善保管 `config.json` 文件，不要将其上传到公开仓库
2. 定期更新 API 密钥以确保安全性
3. 在开发环境和生产环境使用不同的配置文件
4. 请遵守各 API 的使用条款和限制

## 更新配置

当需要更新配置时：
1. 备份当前的 `config.json` 文件
2. 修改需要更新的配置项
3. 重启 Chrome 扩展以使更改生效

## 安全建议

1. 不要在公共场合显示或分享配置文件
2. 定期更换 GitHub 个人访问令牌
3. 监控 API 的使用情况
4. 设置适当的 API 使用限制 