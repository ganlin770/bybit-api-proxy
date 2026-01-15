# Bybit API Proxy

用于绕过地区限制访问Bybit API的代理服务器。

## 部署到Zeabur

1. Fork或导入此仓库到您的GitHub
2. 在Zeabur中创建新项目
3. 选择GitHub仓库部署
4. **重要：选择新加坡或香港地区**
5. 部署完成后，绑定域名

## API端点

### 健康检查
```
GET /
```

### 代理请求
```
GET/POST /proxy/{bybit-api-path}
```

例如：
- `/proxy/v5/market/tickers?category=linear&symbol=BTCUSDT`
- `/proxy/v5/account/wallet-balance?accountType=UNIFIED`

### 签名请求（推荐）
```
POST /signed-request
Content-Type: application/json

{
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "endpoint": "/v5/account/wallet-balance",
  "params": {
    "accountType": "UNIFIED"
  }
}
```

## 环境变量

- `PORT`: 服务端口（默认3000，Zeabur会自动设置）

## 注意事项

- 请确保部署在非美国地区（新加坡、香港、日本等）
- API密钥通过请求传递，不存储在服务器
- 建议在Bybit中绑定代理服务器的IP白名单
