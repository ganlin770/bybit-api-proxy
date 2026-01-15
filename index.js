import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

// 允许跨域请求
app.use(cors());
app.use(express.json());

// Bybit API基础URL
const BYBIT_BASE_URL = 'https://api.bybit.com';

// 健康检查
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Bybit API Proxy Server',
    timestamp: new Date().toISOString()
  });
});

// 获取服务器出口IP
app.get('/ip', async (req, res) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    res.json({ ip: data.ip });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代理Bybit API请求
app.all('/proxy/*', async (req, res) => {
  try {
    const endpoint = req.params[0]; // 获取 /proxy/ 后面的路径
    const queryString = new URL(req.url, `http://localhost`).search;
    const url = `${BYBIT_BASE_URL}/${endpoint}${queryString}`;
    
    console.log(`[Proxy] ${req.method} ${url}`);
    
    // 转发请求头（Bybit签名相关）
    const headers = {};
    const bybitHeaders = ['x-bapi-api-key', 'x-bapi-sign', 'x-bapi-timestamp', 'x-bapi-recv-window'];
    
    for (const header of bybitHeaders) {
      if (req.headers[header]) {
        headers[header.toUpperCase().replace(/-/g, '-')] = req.headers[header];
        // 保持原始大小写格式
        headers['X-BAPI-API-KEY'] = req.headers['x-bapi-api-key'];
        headers['X-BAPI-SIGN'] = req.headers['x-bapi-sign'];
        headers['X-BAPI-TIMESTAMP'] = req.headers['x-bapi-timestamp'];
        headers['X-BAPI-RECV-WINDOW'] = req.headers['x-bapi-recv-window'];
      }
    }
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    // POST请求需要body
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    
    console.log(`[Proxy] Response: ${response.status} - retCode: ${data.retCode}`);
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    res.status(500).json({ 
      retCode: -1, 
      retMsg: `Proxy error: ${error.message}` 
    });
  }
});

// 签名代理 - 客户端发送API密钥，服务端生成签名并请求
app.post('/signed-request', async (req, res) => {
  try {
    const { apiKey, apiSecret, endpoint, params = {} } = req.body;
    
    if (!apiKey || !apiSecret || !endpoint) {
      return res.status(400).json({ 
        retCode: -1, 
        retMsg: 'Missing required fields: apiKey, apiSecret, endpoint' 
      });
    }
    
    const timestamp = Date.now().toString();
    const recvWindow = '20000';
    
    // 构建查询字符串
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    
    // 生成签名
    const signStr = timestamp + apiKey + recvWindow + queryString;
    const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('hex');
    
    const url = `${BYBIT_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
    
    console.log(`[Signed] GET ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
      }
    });
    
    const data = await response.json();
    console.log(`[Signed] Response: ${response.status} - retCode: ${data.retCode}`);
    
    res.json(data);
  } catch (error) {
    console.error('[Signed] Error:', error.message);
    res.status(500).json({ 
      retCode: -1, 
      retMsg: `Request error: ${error.message}` 
    });
  }
});

// 签名POST请求 - 用于下单等需要POST的操作
app.post('/signed-post', async (req, res) => {
  try {
    const { apiKey, apiSecret, endpoint, body = {} } = req.body;
    
    if (!apiKey || !apiSecret || !endpoint) {
      return res.status(400).json({ 
        retCode: -1, 
        retMsg: 'Missing required fields: apiKey, apiSecret, endpoint' 
      });
    }
    
    const timestamp = Date.now().toString();
    const recvWindow = '20000';
    
    // POST请求使用JSON body生成签名
    const bodyString = JSON.stringify(body);
    const signStr = timestamp + apiKey + recvWindow + bodyString;
    const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('hex');
    
    const url = `${BYBIT_BASE_URL}${endpoint}`;
    
    console.log(`[Signed POST] ${url}`);
    console.log(`[Signed POST] Body:`, bodyString);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
      },
      body: bodyString,
    });
    
    const data = await response.json();
    console.log(`[Signed POST] Response: ${response.status} - retCode: ${data.retCode}`);
    
    res.json(data);
  } catch (error) {
    console.error('[Signed POST] Error:', error.message);
    res.status(500).json({ 
      retCode: -1, 
      retMsg: `Request error: ${error.message}` 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Bybit API Proxy Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/proxy/{bybit-api-path}`);
  console.log(`Signed GET request: POST http://localhost:${PORT}/signed-request`);
  console.log(`Signed POST request: POST http://localhost:${PORT}/signed-post`);
});
