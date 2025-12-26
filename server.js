const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 根路由 - 直接返回index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 确保目录存在
const audioDir = path.join(__dirname, 'audio');
const metadataFile = path.join(__dirname, 'audio', 'metadata.json');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// 读取元数据
function readMetadata() {
    try {
        if (fs.existsSync(metadataFile)) {
            return JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        }
    } catch (error) {
        console.error('读取元数据失败:', error);
    }
    return { audios: [], playlists: [] };
}

// 保存元数据
function saveMetadata(metadata) {
    try {
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (error) {
        console.error('保存元数据失败:', error);
    }
}

// 检查 yt-dlp 或 youtube-dl 是否可用
async function checkConverter() {
    try {
        await execAsync('which yt-dlp');
        return 'yt-dlp';
    } catch {
        try {
            await execAsync('which youtube-dl');
            return 'youtube-dl';
        } catch {
            return null;
        }
    }
}

// 检查 ffmpeg 是否可用
async function checkFFmpeg() {
    try {
        await execAsync('which ffmpeg');
        return true;
    } catch {
        return false;
    }
}

// YouTube视频转换API
app.post('/api/convert', async (req, res) => {
    const { url, category } = req.body;

    if (!url) {
        return res.status(400).json({ error: '缺少URL参数' });
    }

    try {
        // 检查工具是否可用
        const converter = await checkConverter();
        if (!converter) {
            return res.status(500).json({ 
                error: '未找到 yt-dlp 或 youtube-dl。请安装: pip install yt-dlp' 
            });
        }

        const hasFFmpeg = await checkFFmpeg();
        if (!hasFFmpeg) {
            return res.status(500).json({ 
                error: '未找到 ffmpeg。请安装: brew install ffmpeg (macOS) 或 apt-get install ffmpeg (Linux)' 
            });
        }

        // 获取视频信息
        const infoCommand = `${converter} --dump-json --no-playlist "${url}"`;
        let videoInfo;
        try {
            const { stdout } = await execAsync(infoCommand, { timeout: 30000 });
            videoInfo = JSON.parse(stdout);
        } catch (error) {
            console.warn('获取视频信息失败，使用默认值');
            videoInfo = { title: '未知标题', duration: 0 };
        }

        // 生成文件名（使用视频ID和时间戳）
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || Date.now();
        const timestamp = Date.now();
        const safeTitle = (videoInfo.title || '未知标题').replace(/[^\w\s-]/g, '').substring(0, 50);
        const filename = `${safeTitle}_${videoId}_${timestamp}.mp3`;
        const outputPath = path.join(audioDir, filename);

        // 如果文件已存在，删除
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        // 构建转换命令
        const command = `${converter} -x --audio-format mp3 --audio-quality 192K -o "${outputPath}" "${url}"`;

        console.log('开始转换:', url);
        
        // 执行转换
        await execAsync(command, {
            timeout: 300000, // 5分钟超时
            maxBuffer: 10 * 1024 * 1024 // 10MB缓冲区
        });

        // 检查文件是否生成
        if (!fs.existsSync(outputPath)) {
            throw new Error('转换失败：未生成音频文件');
        }

        // 获取文件信息
        const stats = fs.statSync(outputPath);
        const fileSize = stats.size;

        // 保存元数据
        const metadata = readMetadata();
        const audioData = {
            id: `${videoId}_${timestamp}`,
            videoId: videoId,
            title: videoInfo.title || '未知标题',
            filename: filename,
            url: url,
            category: category || '未分类',
            duration: videoInfo.duration || 0,
            fileSize: fileSize,
            createdAt: new Date().toISOString(),
            thumbnail: videoInfo.thumbnail || null
        };

        metadata.audios.push(audioData);
        saveMetadata(metadata);

        // 发送文件
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('转换错误:', error);
        res.status(500).json({ 
            error: `转换失败: ${error.message}` 
        });
    }
});

// 获取音频列表
app.get('/api/audios', (req, res) => {
    const { category, sortBy = 'createdAt', order = 'desc' } = req.query;
    const metadata = readMetadata();
    let audios = [...metadata.audios];

    // 分类过滤
    if (category && category !== '全部') {
        audios = audios.filter(audio => audio.category === category);
    }

    // 排序
    audios.sort((a, b) => {
        let aVal, bVal;
        switch (sortBy) {
            case 'title':
                aVal = a.title.toLowerCase();
                bVal = b.title.toLowerCase();
                break;
            case 'duration':
                aVal = a.duration;
                bVal = b.duration;
                break;
            case 'fileSize':
                aVal = a.fileSize;
                bVal = b.fileSize;
                break;
            case 'createdAt':
            default:
                aVal = new Date(a.createdAt).getTime();
                bVal = new Date(b.createdAt).getTime();
        }
        return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    res.json(audios);
});

// 获取分类列表
app.get('/api/categories', (req, res) => {
    const metadata = readMetadata();
    const categories = [...new Set(metadata.audios.map(a => a.category))];
    res.json(categories);
});

// 获取音频文件
app.get('/api/audio/:id', (req, res) => {
    const { id } = req.params;
    const metadata = readMetadata();
    const audio = metadata.audios.find(a => a.id === id);

    if (!audio) {
        return res.status(404).json({ error: '音频不存在' });
    }

    const filePath = path.join(audioDir, audio.filename);
    if (!fs.existsSync(filePath)) {
        console.error(`音频文件不存在: ${filePath}`);
        return res.status(404).json({ error: '音频文件不存在' });
    }

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${audio.filename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // 支持范围请求（用于音频播放的seek功能）
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        res.setHeader('Content-Length', fileSize);
        fs.createReadStream(filePath).pipe(res);
    }
});

// 删除音频
app.delete('/api/audio/:id', (req, res) => {
    const { id } = req.params;
    const metadata = readMetadata();
    const audioIndex = metadata.audios.findIndex(a => a.id === id);

    if (audioIndex === -1) {
        return res.status(404).json({ error: '音频不存在' });
    }

    const audio = metadata.audios[audioIndex];
    const filePath = path.join(audioDir, audio.filename);

    // 删除文件
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // 从元数据中删除
    metadata.audios.splice(audioIndex, 1);
    
    // 从所有播放列表中删除
    metadata.playlists.forEach(playlist => {
        playlist.audioIds = playlist.audioIds.filter(audioId => audioId !== id);
    });

    saveMetadata(metadata);
    res.json({ success: true });
});

// 更新音频分类
app.patch('/api/audio/:id', (req, res) => {
    const { id } = req.params;
    const { category } = req.body;
    const metadata = readMetadata();
    const audio = metadata.audios.find(a => a.id === id);

    if (!audio) {
        return res.status(404).json({ error: '音频不存在' });
    }

    if (category) {
        audio.category = category;
        saveMetadata(metadata);
    }

    res.json(audio);
});

// 播放列表API
app.get('/api/playlists', (req, res) => {
    const metadata = readMetadata();
    res.json(metadata.playlists || []);
});

app.post('/api/playlists', (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: '播放列表名称不能为空' });
    }

    const metadata = readMetadata();
    const playlist = {
        id: `playlist_${Date.now()}`,
        name,
        description: description || '',
        audioIds: [],
        createdAt: new Date().toISOString()
    };

    metadata.playlists.push(playlist);
    saveMetadata(metadata);
    res.json(playlist);
});

app.get('/api/playlist/:id', (req, res) => {
    const { id } = req.params;
    const metadata = readMetadata();
    const playlist = metadata.playlists.find(p => p.id === id);

    if (!playlist) {
        return res.status(404).json({ error: '播放列表不存在' });
    }

    // 获取播放列表中的音频详情
    const audios = playlist.audioIds
        .map(audioId => metadata.audios.find(a => a.id === audioId))
        .filter(a => a !== undefined);

    res.json({ ...playlist, audios });
});

app.patch('/api/playlist/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, audioIds } = req.body;
    const metadata = readMetadata();
    const playlist = metadata.playlists.find(p => p.id === id);

    if (!playlist) {
        return res.status(404).json({ error: '播放列表不存在' });
    }

    if (name) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (audioIds) playlist.audioIds = audioIds;

    saveMetadata(metadata);
    res.json(playlist);
});

app.delete('/api/playlist/:id', (req, res) => {
    const { id } = req.params;
    const metadata = readMetadata();
    const index = metadata.playlists.findIndex(p => p.id === id);

    if (index === -1) {
        return res.status(404).json({ error: '播放列表不存在' });
    }

    metadata.playlists.splice(index, 1);
    saveMetadata(metadata);
    res.json({ success: true });
});

// 健康检查
app.get('/api/health', async (req, res) => {
    const converter = await checkConverter();
    const hasFFmpeg = await checkFFmpeg();
    
    res.json({
        status: 'ok',
        converter: converter || '未安装',
        ffmpeg: hasFFmpeg ? '已安装' : '未安装',
        message: converter && hasFFmpeg 
            ? '服务就绪' 
            : '请安装必要的工具: pip install yt-dlp 和 brew install ffmpeg'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`\n🎵 YouTube音频播放器服务器已启动！`);
    console.log(`📡 服务器地址: http://localhost:${PORT}`);
    console.log(`🌐 请在浏览器中打开: http://localhost:${PORT}/index.html\n`);
    
    // 检查依赖
    checkConverter().then(converter => {
        if (!converter) {
            console.log('⚠️  警告: 未找到 yt-dlp 或 youtube-dl');
            console.log('   请运行: pip install yt-dlp\n');
        } else {
            console.log(`✅ 已找到转换工具: ${converter}\n`);
        }
    });
    
    checkFFmpeg().then(hasFFmpeg => {
        if (!hasFFmpeg) {
            console.log('⚠️  警告: 未找到 ffmpeg');
            console.log('   请运行: brew install ffmpeg (macOS) 或 apt-get install ffmpeg (Linux)\n');
        } else {
            console.log('✅ 已找到 ffmpeg\n');
        }
    });
});

