// WebGL音频可视化器
class WebGLAudioVisualizer {
    constructor(canvas, audioElement) {
        this.canvas = canvas;
        this.audioElement = audioElement;
        this.gl = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationFrameId = null;
        this.isPlaying = false;
        
        this.init();
    }

    init() {
        // 初始化WebGL上下文
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            console.error('WebGL不支持');
            return;
        }

        // 设置画布尺寸
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // 初始化WebGL程序
        this.initShaderProgram();
        this.initBuffers();
        this.initAudioContext();

        // 开始渲染循环
        this.render();
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    initShaderProgram() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute float a_frequency;
            varying float v_frequency;
            varying vec2 v_position;
            
            void main() {
                v_frequency = a_frequency;
                v_position = a_position;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying float v_frequency;
            varying vec2 v_position;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            void main() {
                vec2 uv = (v_position + 1.0) * 0.5;
                uv.y = 1.0 - uv.y;
                
                // 创建渐变背景
                vec3 color1 = vec3(0.44, 0.45, 0.93); // #6c7ae0
                vec3 color2 = vec3(0.64, 0.61, 1.0);  // #a29bfe
                vec3 bgColor = mix(color1, color2, uv.y);
                
                // 音频波形效果
                float wave = abs(sin(v_frequency * 10.0 + u_time * 2.0)) * 0.3;
                float dist = abs(uv.y - 0.5);
                float waveEffect = smoothstep(0.0, 0.1, wave - dist);
                
                // 添加脉冲效果
                float pulse = sin(u_time + v_frequency * 5.0) * 0.5 + 0.5;
                vec3 pulseColor = vec3(1.0, 1.0, 1.0) * pulse * 0.2;
                
                vec3 finalColor = bgColor + waveEffect * vec3(1.0, 1.0, 1.0) + pulseColor;
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.program = this.createProgram(vertexShader, fragmentShader);
        this.gl.useProgram(this.program);

        // 获取属性位置
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.frequencyLocation = this.gl.getAttribLocation(this.program, 'a_frequency');
        this.timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('着色器编译错误:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('程序链接错误:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }

        return program;
    }

    initBuffers() {
        // 创建全屏四边形
        const positions = [
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ];

        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        // 初始化频率数据（稍后会被音频数据更新）
        const frequencies = new Float32Array(4).fill(0);
        this.frequencyBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.frequencyBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, frequencies, this.gl.DYNAMIC_DRAW);
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;

            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            // 连接音频元素到分析器
            if (this.audioElement) {
                this.source = this.audioContext.createMediaElementSource(this.audioElement);
                this.source.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);
            }
        } catch (error) {
            console.error('音频上下文初始化失败:', error);
        }
    }

    updateAudioData() {
        if (this.analyser && this.isPlaying) {
            this.analyser.getByteFrequencyData(this.dataArray);
            
            // 将音频数据映射到顶点
            const frequencies = new Float32Array(4);
            const step = Math.floor(this.dataArray.length / 4);
            
            for (let i = 0; i < 4; i++) {
                let sum = 0;
                for (let j = 0; j < step; j++) {
                    sum += this.dataArray[i * step + j];
                }
                frequencies[i] = (sum / step) / 255.0;
            }

            // 更新频率缓冲区
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.frequencyBuffer);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, frequencies);
        }
    }

    render() {
        if (!this.gl || !this.program) return;

        this.updateAudioData();

        // 清除画布
        this.gl.clearColor(0.88, 0.90, 0.93, 1.0); // 背景色
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // 设置时间统一变量
        const time = performance.now() / 1000.0;
        this.gl.uniform1f(this.timeLocation, time);
        this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);

        // 绑定位置缓冲区
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        // 绑定频率缓冲区
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.frequencyBuffer);
        this.gl.enableVertexAttribArray(this.frequencyLocation);
        this.gl.vertexAttribPointer(this.frequencyLocation, 1, this.gl.FLOAT, false, 0, 0);

        // 绘制
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.animationFrameId = requestAnimationFrame(() => this.render());
    }

    setPlaying(playing) {
        this.isPlaying = playing;
        if (playing && this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

