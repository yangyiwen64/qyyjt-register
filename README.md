# 预警通注册管理系统

## 快速开始

### 前提条件
- 安装 Node.js 20+ : https://nodejs.org/

### 启动方式（选一）

**方式1: 一键启动（Mac/Linux）**
```bash
./start.sh
```

**方式2: 一键启动（Windows）**
```cmd
start.bat
```

**方式3: 手动启动**
```bash
npm install
PORT=3000 node server/index.mjs
```

### 访问
- 打开浏览器: http://localhost:3000
- 登录账号: admin / admin

### 功能
- 批量注册（真实浏览器自动化）
- 导入/导出账号
- 用户管理
- 数据持久化

### 技术栈
- 前端: React + Tailwind CSS
- 后端: Express + Playwright
- 自动化: 豪猪网取号 + 预警通注册
