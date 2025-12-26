# YouTube音频播放器

一个使用WebGL技术的YouTube视频转音频播放器，采用苹果拟物风格设计。

## 功能特性

- 🎵 YouTube视频转音频
- 🎨 WebGL实时音频可视化
- 🎧 完整的音频播放控制
- 💾 音频文件下载和本地存储
- 📱 响应式设计
- 🍎 苹果拟物风格UI

## 技术栈

- HTML5 / CSS3
- JavaScript (ES6+)
- WebGL (音频可视化)
- Web Audio API

## 使用说明

### 前端部分

1. 直接在浏览器中打开 `index.html` 即可使用基础功能

### YouTube视频转换

**重要提示**: 由于浏览器安全限制，无法直接在浏览器中下载YouTube视频。需要配置后端服务。

#### 方案1: 使用后端API（推荐）

创建一个后端服务来处理YouTube视频转换，例如使用 `yt-dlp` 或 `youtube-dl`:

```python
# 示例：Flask后端
from flask import Flask, request, send_file
import yt_dlp
import os

app = Flask(__name__)

@app.route('/api/convert', methods=['POST'])
def convert():
    url = request.json['url']
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': 'temp/%(id)s.%(ext)s',
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    
    # 返回音频文件
    return send_file('temp/audio.mp3')
```

然后在 `app.js` 中取消注释并修改 `fetchAudioFromYouTube` 方法：

```javascript
async fetchAudioFromYouTube(url) {
    const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    return await response.blob();
}
```

#### 方案2: 使用浏览器扩展

用户需要安装支持YouTube下载的浏览器扩展。

#### 方案3: 使用第三方API服务

集成支持YouTube转换的第三方API服务。

## 文件结构

```
.
├── index.html          # 主HTML文件
├── styles.css          # 样式文件（拟物风格）
├── app.js              # 主应用逻辑
├── webgl-visualizer.js # WebGL音频可视化
└── README.md           # 说明文档
```

## 浏览器兼容性

- Chrome/Edge (推荐)
- Firefox
- Safari
- 需要支持WebGL和Web Audio API

## 注意事项

1. **YouTube转换**: 需要配置后端服务才能实现YouTube视频转换功能
2. **本地存储**: 音频文件存储在浏览器的localStorage中，有大小限制（通常5-10MB）
3. **CORS**: 如果使用外部API，需要处理跨域问题

## 开发

直接打开 `index.html` 即可开始开发。所有代码都在前端，无需构建步骤。

## 许可证

MIT License

