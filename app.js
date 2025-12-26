// 主应用程序
class AudioPlayerApp {
    constructor() {
        this.audioPlayer = document.getElementById('audioPlayer');
        this.youtubeUrlInput = document.getElementById('youtubeUrl');
        this.categoryInput = document.getElementById('categoryInput');
        this.convertBtn = document.getElementById('convertBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.playerSection = document.getElementById('playerSection');
        this.webglCanvas = document.getElementById('webglCanvas');
        this.audioTitle = document.getElementById('audioTitle');
        this.audioDuration = document.getElementById('audioDuration');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.seekBar = document.getElementById('seekBar');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        this.volumeBar = document.getElementById('volumeBar');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.audioList = document.getElementById('audioList');
        this.categoryFilter = document.getElementById('categoryFilter');
        this.sortBy = document.getElementById('sortBy');
        this.sortOrder = document.getElementById('sortOrder');
        this.playlistList = document.getElementById('playlistList');
        this.createPlaylistBtn = document.getElementById('createPlaylistBtn');
        this.albumArt = document.getElementById('albumArt');
        this.audioCategory = document.getElementById('audioCategory');
        this.playlistsTab = document.getElementById('playlistsTab');
        this.navLinks = document.querySelectorAll('.nav-link');

        this.visualizer = null;
        this.currentAudio = null;
        this.currentPlaylist = null;
        this.playlistIndex = 0;

        this.init();
    }

    init() {
        // 初始化WebGL可视化器
        this.visualizer = new WebGLAudioVisualizer(this.webglCanvas, this.audioPlayer);

        // 绑定事件
        this.convertBtn.addEventListener('click', () => this.convertVideo());
        this.youtubeUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.convertVideo();
            }
        });

        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.seekBar.addEventListener('input', (e) => this.seek(e.target.value));
        this.volumeBar.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.downloadBtn.addEventListener('click', () => this.downloadAudio());

        this.categoryFilter.addEventListener('change', () => this.loadAudioList());
        this.sortBy.addEventListener('change', () => this.loadAudioList());
        this.sortOrder.addEventListener('change', () => this.loadAudioList());
        this.createPlaylistBtn.addEventListener('click', () => this.createPlaylist());
        
        // 导航切换
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                this.switchTab(tab);
                this.navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // 音频事件
        this.audioPlayer.addEventListener('loadedmetadata', () => this.onAudioLoaded());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
        this.audioPlayer.addEventListener('play', () => {
            this.visualizer.setPlaying(true);
            this.updatePlayPauseButton(true);
            this.startVinylAnimation();
            this.loadAudioList(); // 更新列表中的播放状态
        });
        this.audioPlayer.addEventListener('pause', () => {
            this.visualizer.setPlaying(false);
            this.updatePlayPauseButton(false);
            this.stopVinylAnimation();
        });
        this.audioPlayer.addEventListener('ended', () => {
            this.visualizer.setPlaying(false);
            this.updatePlayPauseButton(false);
            this.stopVinylAnimation();
            this.playNext();
        });
        this.audioPlayer.addEventListener('error', (e) => {
            console.error('音频加载错误:', e);
            const error = this.audioPlayer.error;
            if (error) {
                let errorMsg = '音频加载失败: ';
                switch (error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMsg += '播放被中止';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMsg += '网络错误，请检查服务器连接';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMsg += '音频解码失败';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMsg += '音频格式不支持或文件不存在';
                        break;
                    default:
                        errorMsg += '未知错误';
                }
                alert(errorMsg);
            }
        });

        // 加载数据
        this.loadCategories();
        this.loadAudioList();
        this.loadPlaylists();
    }

    async convertVideo() {
        const url = this.youtubeUrlInput.value.trim();
        if (!url) {
            alert('请输入YouTube视频URL');
            return;
        }

        if (!this.isValidYouTubeUrl(url)) {
            alert('请输入有效的YouTube视频URL');
            return;
        }

        try {
            this.convertBtn.disabled = true;
            this.progressSection.classList.remove('hidden');
            this.updateProgress(10, '正在解析视频...');

            const category = this.categoryInput.value.trim() || '未分类';
            const audioData = await this.fetchAudioFromYouTube(url, category);
            
            this.updateProgress(100, '转换完成！');
            
            const audioUrl = `http://localhost:3000/api/audio/${audioData.id}`;
            this.currentAudio = audioData;
            this.audioPlayer.src = audioUrl;
            this.audioPlayer.load();

            setTimeout(() => {
                this.progressSection.classList.add('hidden');
                this.playerSection.classList.remove('hidden');
                this.loadAudioList();
                this.loadCategories();
            }, 1000);

        } catch (error) {
            console.error('转换失败:', error);
            alert('转换失败: ' + error.message);
            this.progressSection.classList.add('hidden');
        } finally {
            this.convertBtn.disabled = false;
        }
    }

    async fetchAudioFromYouTube(url, category) {
        try {
            const response = await fetch('http://localhost:3000/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, category })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '转换失败');
            }

            // 获取音频ID（从响应头或重新获取列表）
            const blob = await response.blob();
            await this.loadAudioList();
            const audios = await this.getAudios();
            const latest = audios[audios.length - 1];
            
            return latest;
        } catch (error) {
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('无法连接到服务器。请确保后端服务已启动（运行: npm start）');
            }
            throw error;
        }
    }

    isValidYouTubeUrl(url) {
        const patterns = [
            /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
            /^https?:\/\/youtube\.com\/watch\?v=[\w-]+/,
            /^https?:\/\/youtu\.be\/[\w-]+/
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    updateProgress(percent, text) {
        this.progressBar.style.width = percent + '%';
        this.progressText.textContent = text || percent + '%';
    }

    onAudioLoaded() {
        const duration = this.audioPlayer.duration;
        this.audioDuration.textContent = this.formatTime(duration);
        this.totalTime.textContent = this.formatTime(duration);
        this.seekBar.max = duration;
        
        if (this.currentAudio) {
            this.audioTitle.textContent = this.currentAudio.title;
        }
    }

    togglePlayPause() {
        if (this.audioPlayer.paused) {
            this.audioPlayer.play();
        } else {
            this.audioPlayer.pause();
        }
    }

    updatePlayPauseButton(playing) {
        const icon = this.playPauseBtn.querySelector('.play-icon');
        if (playing) {
            icon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
        } else {
            icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
    }

    seek(value) {
        this.audioPlayer.currentTime = value;
    }

    updateTime() {
        const current = this.audioPlayer.currentTime;
        const duration = this.audioPlayer.duration;
        
        this.currentTime.textContent = this.formatTime(current);
        this.seekBar.value = current;
        
        if (duration) {
            this.totalTime.textContent = this.formatTime(duration);
        }
    }

    setVolume(value) {
        this.audioPlayer.volume = value / 100;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    downloadAudio() {
        if (!this.currentAudio) {
            alert('没有可下载的音频');
            return;
        }

        const link = document.createElement('a');
        link.href = `http://localhost:3000/api/audio/${this.currentAudio.id}`;
        link.download = this.currentAudio.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async getAudios() {
        try {
            const category = this.categoryFilter.value;
            const sortBy = this.sortBy.value;
            const order = this.sortOrder.value;
            const params = new URLSearchParams({ sortBy, order });
            if (category !== '全部') {
                params.append('category', category);
            }
            const response = await fetch(`http://localhost:3000/api/audios?${params}`);
            return await response.json();
        } catch (error) {
            console.error('获取音频列表失败:', error);
            return [];
        }
    }

    async loadAudioList() {
        try {
            const audios = await this.getAudios();
            this.audioList.innerHTML = '';

            if (audios.length === 0) {
                this.audioList.innerHTML = `
                    <div class="empty-state">
                        <p>暂无音频</p>
                        <p class="empty-hint">输入YouTube URL开始转换</p>
                    </div>
                `;
                return;
            }

            audios.forEach((audio, index) => {
                const item = document.createElement('div');
                const isPlaying = this.currentAudio && this.currentAudio.id === audio.id;
                item.className = `track-item ${isPlaying ? 'playing' : ''}`;
                item.innerHTML = `
                    <div class="track-number">${index + 1}</div>
                    <div class="track-info">
                        <div class="track-title">${audio.title}</div>
                        <div class="track-meta">
                            <span class="track-category">${audio.category}</span>
                            <span class="track-duration">${this.formatTime(audio.duration)}</span>
                        </div>
                    </div>
                    <div class="track-actions">
                        <button class="track-action-btn" onclick="app.updateCategory('${audio.id}')" title="编辑分类">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="track-action-btn" onclick="app.deleteAudio('${audio.id}')" title="删除">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                `;
                item.addEventListener('click', (e) => {
                    if (!e.target.closest('.track-action-btn')) {
                        this.playAudio(audio.id);
                    }
                });
                this.audioList.appendChild(item);
            });
        } catch (error) {
            console.error('加载音频列表失败:', error);
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('http://localhost:3000/api/categories');
            const categories = await response.json();
            
            this.categoryFilter.innerHTML = '<option value="全部">全部分类</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                this.categoryFilter.appendChild(option);
            });
        } catch (error) {
            console.error('加载分类失败:', error);
        }
    }

    async playAudio(id) {
        try {
            // 直接从服务器获取所有音频（不受分类过滤影响）
            const response = await fetch('http://localhost:3000/api/audios?sortBy=createdAt&order=desc');
            const audios = await response.json();
            const audio = audios.find(a => a.id === id);
            
            if (!audio) {
                alert('音频不存在');
                return;
            }

            console.log('播放音频:', audio);
            this.currentAudio = audio;
            const audioUrl = `http://localhost:3000/api/audio/${id}`;
            
            // 先停止当前播放
            this.audioPlayer.pause();
            this.audioPlayer.src = '';
            
            // 显示播放器
            this.playerSection.classList.remove('hidden');
            this.youtubeUrlInput.value = audio.url;
            this.audioTitle.textContent = audio.title;
            this.audioDuration.textContent = this.formatTime(audio.duration || 0);
            this.audioCategory.textContent = audio.category;
            
            // 更新唱片中心标签图片
            const labelImage = document.getElementById('labelImage');
            const vinylRecord = document.getElementById('vinylRecord');
            const tonearm = document.getElementById('tonearm');
            
            if (audio.thumbnail) {
                labelImage.innerHTML = `<img src="${audio.thumbnail}" alt="${audio.title}">`;
            } else {
                labelImage.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                `;
            }
            
            // 重置唱盘和唱臂状态
            vinylRecord.classList.remove('playing');
            tonearm.classList.remove('playing');
            
            // 重新加载列表以更新播放状态
            this.loadAudioList();
            
            // 设置新的音频源
            this.audioPlayer.src = audioUrl;
            
            // 加载音频
            this.audioPlayer.load();
            
            // 等待canplay事件后再播放
            const canPlayHandler = () => {
                this.audioPlayer.removeEventListener('canplay', canPlayHandler);
                const playPromise = this.audioPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error('播放失败:', error);
                        // 某些浏览器需要用户交互才能自动播放，这是正常的
                        if (error.name !== 'NotAllowedError') {
                            alert('播放失败: ' + error.message);
                        }
                    });
                }
            };
            
            this.audioPlayer.addEventListener('canplay', canPlayHandler);
            
            // 如果音频已经可以播放，直接播放
            if (this.audioPlayer.readyState >= 3) {
                canPlayHandler();
            }
            
        } catch (error) {
            console.error('播放音频失败:', error);
            alert('播放失败: ' + error.message);
        }
    }

    async updateCategory(id) {
        const newCategory = prompt('输入新分类名称:');
        if (!newCategory) return;

        try {
            const response = await fetch(`http://localhost:3000/api/audio/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: newCategory })
            });

            if (response.ok) {
                this.loadAudioList();
                this.loadCategories();
            }
        } catch (error) {
            console.error('更新分类失败:', error);
        }
    }

    async deleteAudio(id) {
        if (!confirm('确定要删除这个音频吗？')) return;

        try {
            const response = await fetch(`http://localhost:3000/api/audio/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadAudioList();
                this.loadCategories();
            }
        } catch (error) {
            console.error('删除音频失败:', error);
        }
    }

    async loadPlaylists() {
        try {
            const response = await fetch('http://localhost:3000/api/playlists');
            const playlists = await response.json();
            
            this.playlistList.innerHTML = '';

            if (playlists.length === 0) {
                this.playlistList.innerHTML = '<div class="empty-state"><p>暂无播放列表</p></div>';
                return;
            }

            playlists.forEach(playlist => {
                const item = document.createElement('div');
                item.className = 'playlist-card';
                item.innerHTML = `
                    <div class="playlist-card-title">${playlist.name}</div>
                    <div class="playlist-card-description">${playlist.description || '无描述'}</div>
                    <div class="playlist-card-info">包含 ${playlist.audioIds.length} 首音频</div>
                    <div class="track-actions" style="margin-top: 15px; opacity: 1;">
                        <button class="track-action-btn" onclick="app.playPlaylist('${playlist.id}')" title="播放">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                        <button class="track-action-btn" onclick="app.editPlaylist('${playlist.id}')" title="编辑">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="track-action-btn" onclick="app.deletePlaylist('${playlist.id}')" title="删除">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                `;
                this.playlistList.appendChild(item);
            });
        } catch (error) {
            console.error('加载播放列表失败:', error);
        }
    }
    
    switchTab(tab) {
        if (tab === 'library') {
            this.playlistsTab.classList.add('hidden');
            document.querySelector('.main-content').style.display = 'grid';
        } else if (tab === 'playlists') {
            this.playlistsTab.classList.remove('hidden');
            document.querySelector('.main-content').style.display = 'none';
            this.loadPlaylists();
        }
    }
    
    startVinylAnimation() {
        const vinylRecord = document.getElementById('vinylRecord');
        const tonearm = document.getElementById('tonearm');
        if (vinylRecord && tonearm) {
            vinylRecord.classList.add('playing');
            tonearm.classList.add('playing');
        }
    }
    
    stopVinylAnimation() {
        const vinylRecord = document.getElementById('vinylRecord');
        const tonearm = document.getElementById('tonearm');
        if (vinylRecord && tonearm) {
            vinylRecord.classList.remove('playing');
            tonearm.classList.remove('playing');
        }
    }

    async createPlaylist() {
        const name = prompt('输入播放列表名称:');
        if (!name) return;

        const description = prompt('输入描述（可选）:') || '';

        try {
            const response = await fetch('http://localhost:3000/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (response.ok) {
                this.loadPlaylists();
            }
        } catch (error) {
            console.error('创建播放列表失败:', error);
        }
    }

    async playPlaylist(id) {
        try {
            const response = await fetch(`http://localhost:3000/api/playlist/${id}`);
            const playlist = await response.json();
            
            if (playlist.audios.length === 0) {
                alert('播放列表为空');
                return;
            }

            this.currentPlaylist = playlist;
            this.playlistIndex = 0;
            this.playAudioFromPlaylist();
        } catch (error) {
            console.error('播放播放列表失败:', error);
        }
    }

    async playAudioFromPlaylist() {
        if (!this.currentPlaylist || this.playlistIndex >= this.currentPlaylist.audios.length) {
            this.currentPlaylist = null;
            this.playlistIndex = 0;
            return;
        }

        const audio = this.currentPlaylist.audios[this.playlistIndex];
        await this.playAudio(audio.id);
    }

    playNext() {
        if (this.currentPlaylist) {
            this.playlistIndex++;
            this.playAudioFromPlaylist();
        }
    }

    async editPlaylist(id) {
        try {
            const response = await fetch(`http://localhost:3000/api/playlist/${id}`);
            const playlist = await response.json();
            
            const audios = await this.getAudios();
            const audioIds = playlist.audioIds;
            
            let message = '当前播放列表:\n';
            audios.forEach((audio, index) => {
                const checked = audioIds.includes(audio.id) ? '✓' : ' ';
                message += `${checked} [${index + 1}] ${audio.title}\n`;
            });
            
            const input = prompt(`${message}\n输入要添加的音频编号（用逗号分隔，如: 1,3,5）:`);
            if (!input) return;

            const indices = input.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i));
            const newAudioIds = [...new Set([...audioIds, ...indices.map(i => audios[i]?.id).filter(Boolean)])];

            await fetch(`http://localhost:3000/api/playlist/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioIds: newAudioIds })
            });

            this.loadPlaylists();
        } catch (error) {
            console.error('编辑播放列表失败:', error);
        }
    }

    async deletePlaylist(id) {
        if (!confirm('确定要删除这个播放列表吗？')) return;

        try {
            const response = await fetch(`http://localhost:3000/api/playlist/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadPlaylists();
            }
        } catch (error) {
            console.error('删除播放列表失败:', error);
        }
    }
}

// 初始化应用
let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new AudioPlayerApp();
});



