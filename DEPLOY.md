# 在线部署指南

## 当前状态
项目已推送到 GitHub: https://github.com/chenlicool/youtube-audio-player

## 部署选项

### 方案一：Railway（推荐）⭐

Railway 支持系统工具（yt-dlp、ffmpeg），非常适合这个项目。

**部署步骤：**

1. 访问 https://railway.app
2. 使用 GitHub 账号登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择 `chenlicool/youtube-audio-player` 仓库
6. Railway 会自动检测配置并开始部署
7. 部署完成后，Railway 会提供一个在线地址（如：`https://your-app.railway.app`）

**优点：**
- ✅ 自动安装 yt-dlp 和 ffmpeg
- ✅ 支持文件存储
- ✅ 免费额度充足
- ✅ 自动 HTTPS

---

### 方案二：Render

**部署步骤：**

1. 访问 https://render.com
2. 使用 GitHub 账号登录
3. 点击 "New +" → "Web Service"
4. 连接 GitHub 仓库：`chenlicool/youtube-audio-player`
5. 配置：
   - **Name**: `youtube-audio-player`
   - **Environment**: `Node`
   - **Build Command**: `npm install && pip3 install yt-dlp`
   - **Start Command**: `npm start`
6. 在 "Environment" 标签页添加：
   - `PORT` = `10000`（Render 默认端口）
7. 点击 "Create Web Service"

**注意：** Render 需要手动安装系统工具，可能需要使用 Dockerfile。

---

### 方案三：Heroku

**部署步骤：**

1. 访问 https://heroku.com
2. 安装 Heroku CLI: `brew install heroku/brew/heroku`
3. 登录：`heroku login`
4. 创建应用：`heroku create youtube-audio-player`
5. 添加构建包：
   ```bash
   heroku buildpacks:add heroku/nodejs
   heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
   ```
6. 部署：`git push heroku main`

---

### 方案四：使用 Docker + 任意平台

如果需要，我可以帮你创建 Dockerfile，这样就可以部署到任何支持 Docker 的平台。

---

## 部署后访问

部署成功后，你会获得一个在线地址，例如：
- Railway: `https://youtube-audio-player-production.up.railway.app`
- Render: `https://youtube-audio-player.onrender.com`
- Heroku: `https://youtube-audio-player.herokuapp.com`

## 注意事项

⚠️ **重要提示：**
- 在线部署后，音频文件会存储在临时文件系统中
- 如果服务重启，已下载的音频可能会丢失
- 建议配置持久化存储（Railway 和 Render 都支持）

## 推荐

**最推荐使用 Railway**，因为：
1. 配置最简单（已准备好配置文件）
2. 自动处理系统依赖
3. 免费额度足够个人使用
4. 部署速度快

需要我帮你部署到 Railway 吗？

