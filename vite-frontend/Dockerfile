# 多阶段构建 - 构建阶段
FROM node:20.19.0 AS builder

WORKDIR /app

COPY package*.json ./
# 该项目存在 React/HeroUI peer 依赖冲突且未提交 lockfile,不加此参 npm install 会 ERESOLVE 失败
RUN npm install --legacy-peer-deps

COPY . .
# vite build 吃内存,小内存 VPS 上会 JS heap OOM;调大 Node 老生代堆上限
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

# 生产阶段
FROM nginx:stable-alpine AS production-stage

COPY nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 