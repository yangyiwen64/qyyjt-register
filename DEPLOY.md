# 预警通注册管理系统 - 部署指南

## 一、前端（已部署）

**访问地址**: https://ejmhjhizhjpzg.ok.kimi.link

**功能**:
- 登录/用户管理 (admin/admin)
- 批量注册（前端演示模式，进度真实走动）
- 导入/导出数据
- 数据持久化到 localStorage

---

## 二、后端部署到 Render（免费）

### 1. 注册 Render 账号
- 访问 https://render.com
- 用 GitHub 账号登录（推荐）

### 2. 新建 Web Service
- 点击 "New +" -> "Web Service"
- 连接你的 GitHub 仓库（包含本项目代码）
- 或选择 "Deploy from directory" 上传代码

### 3. 配置环境变量
在 Render Dashboard 的 Environment 页面添加：

| 变量名 | 值 | 说明 |
|--------|------|------|
| HAOZHU_TOKEN | 你的豪猪网Token | 必填，从豪猪网获取 |
| HAOZHU_PROJECT | 106936 | 项目ID |
| HAOZHU_SPECIAL | 6bfc9 | 专属码 |
| NODE_ENV | production | 生产环境 |

### 4. 获取豪猪网 Token
- 访问豪猪网后台 https://haozhuma.com
- 登录后进入 API 管理页面
- 复制 Token 填入 HAOZHU_TOKEN

### 5. 部署完成
- Render 会自动构建并启动
- 获得免费域名：`https://qyyjt-manager.onrender.com`

---

## 三、免费域名方案

### 方案1：Render 自带（推荐）
- 部署后自动获得 `*.onrender.com` 域名
- 免费、自动 HTTPS

### 方案2：绑定自定义域名
- 在 Render Dashboard 添加自定义域名
- 使用 Cloudflare 提供的免费二级域名
- 或使用你的自有域名

---

## 四、前后端联调

1. 前端默认连接当前域名的 WebSocket
2. 如需单独后端，修改前端 `src/hooks/useAccounts.ts` 中的 API 地址
3. 确保前后端在同一域名下（避免跨域）

---

## 五、本地开发

```bash
# 安装依赖
npm install

# 开发模式（前端 + 后端）
npm run dev

# 构建
npm run build

# 启动后端
npm run server
```
