/**
 * 游戏核心逻辑：保留PC端玩法，新增移动端控制适配
 * 依赖：需引入 mobile-controls.js 的 MobileControls 类
 */
import { MobileControls } from './mobile-controls.js';

class QuantumJumper {
    constructor() {
        // --------------------------
        // 1. 基础属性（保留PC端核心）
        // --------------------------
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // 游戏状态：menu/playing/paused
        this.keys = { a: false, d: false, w: false }; // 方向键状态（供移动端控制修改）
        this.level = 1; // 当前关卡
        this.shards = 0; // 收集的碎片数量
        this.particles = []; // 粒子效果数组
        this.currentDimension = 0; // 当前维度（0-3）
        this.dimensions = 4; // 总维度数

        // --------------------------
        // 2. 移动端新增属性
        // --------------------------
        this.isMobile = true; // 标记为移动端
        this.mobileControls = null; // 移动端控制实例
        this.canvasScale = 1; // 画布缩放比例（适配不同屏幕）
    }

    // 初始化游戏（入口方法）
    init() {
        // 初始化移动端控制（替代PC端键盘事件）
        this.mobileControls = new MobileControls(this);

        // 初始化基础资源和状态
        this.loadSounds();
        this.generateParticles();
        this.loadLevel(this.level);
        this.updateUI(); // 更新关卡/碎片显示
        this.gameLoop(); // 启动游戏循环
        this.startBackgroundMusic();
    }

    // --------------------------
    // 3. 移动端适配方法（新增/修改）
    // --------------------------
    // 调整画布尺寸：适配手机屏幕（支持旋转）
    resizeCanvas() {
        const container = this.canvas.parentElement;
        // 设置画布实际尺寸（与容器一致）
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        // 计算缩放比例（确保游戏元素不模糊）
        this.canvasScale = Math.min(this.canvas.width / 640, this.canvas.height / 1024); // 基准尺寸640x1024
        this.updateUI(); // 重新渲染UI
    }

    // 优化粒子数量：移动端减半（降低性能消耗）
    generateParticles() {
        const particlesContainer = document.getElementById('particles');
        // 清除旧粒子
        particlesContainer.innerHTML = '';
        this.particles = [];

        // 移动端粒子数量：10个（原PC端20个）
        setInterval(() => {
            if (this.particles.length < 10 && this.gameState === 'playing') {
                const particle = document.createElement('div');
                particle.className = 'particle';
                // 随机粒子样式（位置、大小、颜色）
                particle.style.left = `${Math.random() * 100}vw`;
                particle.style.top = `${Math.random() * 100}vh`;
                particle.style.width = `${5 + Math.random() * 10}px`;
                particle.style.height = `${5 + Math.random() * 10}px`;
                particle.style.backgroundColor = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f97316'][this.currentDimension];
                particle.style.opacity = '0.7';
                particle.style.borderRadius = '50%';
                particle.style.position = 'absolute';
                particle.style.animation = `float ${2 + Math.random() * 3}s linear infinite`;

                particlesContainer.appendChild(particle);
                this.particles.push(particle);

                // 粒子生命周期：5秒后移除
                setTimeout(() => {
                    particle.remove();
                    this.particles = this.particles.filter(p => p !== particle);
                }, 5000);
            }
        }, 500);
    }

    // --------------------------
    // 4. 保留PC端核心逻辑（补全必要实现）
    // --------------------------
    // 加载关卡（示例实现）
    loadLevel(levelNum) {
        this.level = levelNum;
        this.shards = 0;
        this.currentDimension = 0;
        // 此处可补充关卡地图生成逻辑（与PC端一致）
        this.updateUI();
    }

    // 切换维度（示例实现）
    switchDimension(dim) {
        if (dim < 0 || dim >= this.dimensions) return;
        this.currentDimension = dim;
        // 此处可补充维度切换的视觉/物理逻辑（与PC端一致）
    }

    // 快速切换维度（映射空格，示例实现）
    quickSwitch() {
        this.currentDimension = (this.currentDimension + 1) % this.dimensions;
        // 激活当前维度按钮（视觉反馈）
        document.querySelectorAll('.dimension-btn').forEach((btn, idx) => {
            btn.classList.toggle('active', idx === this.currentDimension);
        });
    }

    // 暂停/继续游戏（示例实现）
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseMenu').classList.remove('hidden');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseMenu').classList.add('hidden');
        }
    }

    // 更新UI（关卡、碎片显示）
    updateUI() {
        document.getElementById('levelDisplay').textContent = `关卡: ${this.level}`;
        document.getElementById('shardDisplay').textContent = `碎片: ${this.shards}`;
        // 激活初始维度按钮
        document.querySelectorAll('.dimension-btn').forEach((btn, idx) => {
            btn.classList.toggle('active', idx === this.currentDimension);
        });
    }

    // 加载音效（示例实现）
    loadSounds() {
        this.sounds = {
            jump: new Audio('./resources/sounds/jump.mp3'),
            switch: new Audio('./resources/sounds/switch.mp3'),
            collect: new Audio('./resources/sounds/collect.mp3')
        };
        // 预加载音效
        Object.values(this.sounds).forEach(sound => sound.load());
    }

    // 播放背景音乐（示例实现）
    startBackgroundMusic() {
        this.bgMusic = new Audio('./resources/sounds/bg-music.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.3;
        // 点击屏幕后播放（兼容移动端自动播放限制）
        document.addEventListener('touchstart', () => {
            if (this.gameState === 'menu') this.bgMusic.play();
        }, { once: true });
    }

    // 游戏主循环（核心渲染逻辑）
    gameLoop() {
        if (this.gameState !== 'paused') {
            // 1. 清空画布
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // 2. 缩放画布（适配不同屏幕）
            this.ctx.save();
            this.ctx.scale(this.canvasScale, this.canvasScale);

            // 3. 渲染游戏元素（示例：玩家、平台、维度效果）
            this.renderPlayer();
            this.renderPlatforms();
            this.renderDimensionEffects();

            this.ctx.restore();

            // 4. 处理游戏逻辑（移动、碰撞、收集）
            this.handlePlayerMovement();
            this.handleCollisions();
        }

        // 循环调用
        requestAnimationFrame(() => this.gameLoop());
    }

    // 渲染玩家（示例实现）
    renderPlayer() {
        const playerSize = 30;
        const playerX = this.canvas.width / (2 * this.canvasScale) - playerSize / 2; // 居中X
        const playerY = this.canvas.height / (2 * this.canvasScale) - playerSize / 2; // 居中Y

        // 绘制玩家（颜色随维度变化）
        this.ctx.fillStyle = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f97316'][this.currentDimension];
        this.ctx.fillRect(playerX, playerY, playerSize, playerSize);
    }

    // 渲染平台（示例实现）
    renderPlatforms() {
        // 此处可补充PC端的平台生成/渲染逻辑（与移动端一致）
    }

    // 渲染维度效果（示例实现）
    renderDimensionEffects() {
        // 此处可补充维度切换的视觉效果（与PC端一致）
    }

    // 处理玩家移动（示例实现）
    handlePlayerMovement() {
        // 此处可补充PC端的移动逻辑（依赖 this.keys 状态，移动端已通过控制类修改）
        if (this.keys.w) {
            // 跳跃逻辑（示例）
            this.sounds.jump.play();
        }
    }

    // 处理碰撞检测（示例实现）
    handleCollisions() {
        // 此处可补充PC端的碰撞逻辑（与移动端一致）
    }
}

// --------------------------
// 初始化游戏（页面加载完成后）
// --------------------------
window.addEventListener('load', () => {
    const game = new QuantumJumper();
    // 初始化画布尺寸（适配手机屏幕）
    game.resizeCanvas();
    // 监听屏幕旋转，动态调整画布
    window.addEventListener('resize', () => game.resizeCanvas());
    // 绑定开始游戏按钮
    document.getElementById('startBtn').addEventListener('touchstart', () => {
        game.gameState = 'playing';
        document.getElementById('gameOverlay').classList.add('hidden');
    });
    // 绑定暂停菜单按钮
    document.getElementById('resumeBtn').addEventListener('touchstart', () => game.togglePause());
    document.getElementById('restartBtn').addEventListener('touchstart', () => game.loadLevel(game.level));
    document.getElementById('quitBtn').addEventListener('touchstart', () => {
        game.gameState = 'menu';
        document.getElementById('pauseMenu').classList.add('hidden');
        document.getElementById('gameOverlay').classList.remove('hidden');
    });
    // 启动游戏
    game.init();
});