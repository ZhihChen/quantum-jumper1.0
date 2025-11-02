// 量子跃迁者 - 游戏主逻辑
class QuantumJumper {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.currentLevel = 1;
        this.quantumShards = 0;
        this.energy = 100;
        this.maxEnergy = 100;
        this.levelCompleteTriggered = false; // 防止重复触发关卡完成
        this.lastDimensionSwitchTime = 0; // 记录最后一次维度切换时间，用于掉落保护
        this.upperBoundWarningTime = 0; // 记录超出上界的时间，0表示未超出
        this.upperBoundGracePeriod = 5000; // 上界宽限期：5秒
        this.levelRestartCount = {}; // 记录每个关卡的重启次数，用于随机变化
        this.maxLevel = 10; // 最大关卡数
        
        // 维度系统
        this.currentDimension = 0;
        this.dimensions = [
            { name: '正常维度', color: '#3b82f6', gravity: 0.5, timeScale: 1 },
            { name: '反重力', color: '#8b5cf6', gravity: -0.5, timeScale: 1 },
            { name: '时间扭曲', color: '#06b6d4', gravity: 0.3, timeScale: 0.5 },
            { name: '能量场', color: '#f97316', gravity: 0.5, timeScale: 1, forceField: true }
        ];
        
        // 玩家对象
        this.player = {
            x: 100,
            y: 300,
            width: 20,
            height: 20,
            vx: 0,
            vy: 0,
            speed: 5,
            onGround: false,
            trail: []
        };
        
        // 游戏对象数组
        this.platforms = [];
        this.collectibles = [];
        this.hazards = [];
        this.portals = [];
        
        // 粒子系统
        this.particles = [];
        
        // 音效系统
        this.sounds = {};
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        this.backgroundMusic = null;
        
        // 输入处理
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        
        // 游戏循环
        this.lastTime = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSounds();
        this.generateParticles();
        this.loadLevel(1);
        this.gameLoop();
        this.startBackgroundMusic();
    }
    
    setupEventListeners() {
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            // 防止重复触发
            if (this.keys[e.key.toLowerCase()]) return;
            
            this.keys[e.key.toLowerCase()] = true;
            
            // 维度切换
            if (e.key >= '1' && e.key <= '4') {
                this.switchDimension(parseInt(e.key) - 1);
            }
            
            // 暂停
            if (e.key === 'Escape') {
                this.togglePause();
            }
            
            // 快速切换
            if (e.key === ' ' && this.gameState === 'playing') {
                this.quickSwitch();
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // 鼠标事件
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const direction = e.deltaY > 0 ? 1 : -1;
            this.cycleDimension(direction);
        });
        
        // UI事件
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('quitBtn').addEventListener('click', () => this.quitGame());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('closeSettings').addEventListener('click', () => this.hideSettings());
        
        // 胜利界面事件
        const restartFromVictoryBtn = document.getElementById('restartFromVictoryBtn');
        const quitFromVictoryBtn = document.getElementById('quitFromVictoryBtn');
        if (restartFromVictoryBtn) {
            restartFromVictoryBtn.addEventListener('click', () => {
                document.getElementById('victoryOverlay').classList.add('hidden');
                this.restartGame();
            });
        }
        if (quitFromVictoryBtn) {
            quitFromVictoryBtn.addEventListener('click', () => {
                document.getElementById('victoryOverlay').classList.add('hidden');
                this.quitGame();
            });
        }
        
        // 维度按钮
        document.querySelectorAll('.dimension-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const dimension = parseInt(btn.dataset.dimension);
                this.switchDimension(dimension);
            });
        });
    }
    
    generateParticles() {
        const particlesContainer = document.getElementById('particles');
        
        setInterval(() => {
            if (this.particles.length < 20) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (6 + Math.random() * 4) + 's';
                
                particlesContainer.appendChild(particle);
                
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 10000);
            }
        }, 500);
    }
    
    loadSounds() {
        // 加载音效文件
        this.sounds.dimensionSwitch = new Audio('resources/dimension_switch.mp3');
        this.sounds.collectShard = new Audio('resources/collect_shard.mp3');
        this.sounds.playerJump = new Audio('resources/player_jump.mp3');
        this.sounds.hazardHit = new Audio('resources/hazard_hit.mp3');
        this.sounds.backgroundAmbient = new Audio('resources/background_ambient.mp3');
        
        // 设置音量
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.sfxVolume;
        });
        
        this.sounds.backgroundAmbient.volume = this.musicVolume;
        this.sounds.backgroundAmbient.loop = true;
    }
    
    startBackgroundMusic() {
        if (this.sounds.backgroundAmbient) {
            this.sounds.backgroundAmbient.play().catch(e => {
                console.log('Background music autoplay blocked:', e);
            });
        }
    }
    
    playSound(soundName) {
        if (this.sounds[soundName]) {
            const sound = this.sounds[soundName].cloneNode();
            sound.volume = this.sfxVolume;
            sound.play().catch(e => {
                console.log('Sound play failed:', e);
            });
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('gameOverlay').classList.add('hidden');
        this.levelCompleteTriggered = false; // 重置关卡完成标志
        this.upperBoundWarningTime = 0; // 重置上界警告时间
        // 如果能量耗尽，恢复能量；否则保持当前能量
        if (this.energy <= 0) {
            this.energy = this.maxEnergy;
        }
        this.resetPlayer();
        this.loadLevel(this.currentLevel);
        this.updateUI();
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseMenu').classList.remove('hidden');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseMenu').classList.add('hidden');
        }
    }
    
    restartGame() {
        this.currentLevel = 1;
        this.quantumShards = 0;
        this.energy = this.maxEnergy;
        this.currentDimension = 0;
        this.levelCompleteTriggered = false; // 重置关卡完成标志
        this.gameState = 'playing';
        document.getElementById('pauseMenu').classList.add('hidden');
        this.resetPlayer();
        this.loadLevel(this.currentLevel);
        this.updateUI();
    }
    
    quitGame() {
        this.gameState = 'menu';
        document.getElementById('pauseMenu').classList.add('hidden');
        document.getElementById('gameOverlay').classList.remove('hidden');
    }
    
    showSettings() {
        document.getElementById('settingsModal').classList.remove('hidden');
    }
    
    hideSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
    }
    
    switchDimension(dimension) {
        if (dimension >= 0 && dimension < this.dimensions.length && this.gameState === 'playing') {
            const previousDimension = this.dimensions[this.currentDimension];
            const newDimension = this.dimensions[dimension];
            this.currentDimension = dimension;
            this.lastDimensionSwitchTime = Date.now(); // 记录切换时间，用于掉落保护
            
            // 如果从反重力模式切换到其他模式，且玩家还在上界外，给机会恢复
            if (previousDimension.gravity < 0 && newDimension.gravity >= 0 && this.upperBoundWarningTime > 0) {
                // 切换到正常维度，宽限期继续，但如果玩家回到屏幕内则清除警告
                // 这个检查会在checkCollisions中处理
            }
            
            this.updateDimensionButtons();
            this.createDimensionSwitchEffect();
            this.playSound('dimensionSwitch');
            this.updateUI();
        }
    }
    
    cycleDimension(direction) {
        const previousDimension = this.dimensions[this.currentDimension];
        this.currentDimension = (this.currentDimension + direction + this.dimensions.length) % this.dimensions.length;
        const newDimension = this.dimensions[this.currentDimension];
        this.lastDimensionSwitchTime = Date.now(); // 记录切换时间，用于掉落保护
        
        // 如果从反重力模式切换到其他模式，处理宽限期逻辑
        if (previousDimension.gravity < 0 && newDimension.gravity >= 0 && this.upperBoundWarningTime > 0) {
            // 切换到正常维度，宽限期继续
        }
        
        this.updateDimensionButtons();
        this.createDimensionSwitchEffect();
        this.playSound('dimensionSwitch');
        this.updateUI();
    }
    
    quickSwitch() {
        // 在当前维度和前一个维度间切换
        const prevDimension = this.currentDimension;
        const previousDimension = this.dimensions[this.currentDimension];
        this.currentDimension = (this.currentDimension + 1) % this.dimensions.length;
        const newDimension = this.dimensions[this.currentDimension];
        this.lastDimensionSwitchTime = Date.now(); // 记录切换时间，用于掉落保护
        
        // 如果从反重力模式切换到其他模式，处理宽限期逻辑
        if (previousDimension.gravity < 0 && newDimension.gravity >= 0 && this.upperBoundWarningTime > 0) {
            // 切换到正常维度，宽限期继续
        }
        
        this.updateDimensionButtons();
        this.createDimensionSwitchEffect();
        this.updateUI();
    }
    
    updateDimensionButtons() {
        document.querySelectorAll('.dimension-button').forEach((btn, index) => {
            if (index === this.currentDimension) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    createDimensionSwitchEffect() {
        // 创建维度切换的视觉效果
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: this.player.x + Math.random() * 40 - 20,
                y: this.player.y + Math.random() * 40 - 20,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 30,
                maxLife: 30,
                color: this.dimensions[this.currentDimension].color,
                size: Math.random() * 4 + 2
            });
        }
    }
    
    resetPlayer() {
        this.player.x = 100;
        this.player.y = 300;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.trail = [];
        this.upperBoundWarningTime = 0; // 重置上界警告时间
    }
    
    loadLevel(level) {
        console.log(`=== loadLevel(${level}) called ===`);
        
        // 关键：每关开始时，重置当前关卡的收集品数组（但不重置累计的quantumShards）
        this.platforms = [];
        this.collectibles = []; // 重置当前关卡收集品数组
        this.hazards = [];
        this.portals = [];
        this.levelCompleteTriggered = false; // 重置关卡完成标志
        this.upperBoundWarningTime = 0; // 重置上界警告时间
        
        // 注意：quantumShards 是累计的，不会在这里重置
        console.log(`Loading level ${level} (累计量子碎片: ${this.quantumShards})`);
        
        // 如果是4-10关，增加重启计数（用于随机变化）
        // 注意：每次重新加载同一关时（比如能量耗尽重启），都会增加计数
        // 这样每次重启都会有不同的随机布局
        if (level >= 4 && level <= 10) {
            if (!this.levelRestartCount[level]) {
                this.levelRestartCount[level] = 0; // 首次加载，种子为0
            }
            // 注意：这里不立即增加，而是在每次调用时使用当前值
            // 但为了确保每次重启都有变化，我们在gameOver时已经通过重新调用loadLevel来处理
        }
        
        // 根据关卡生成不同的布局
        switch (level) {
            case 1:
                this.loadLevel1();
                break;
            case 2:
                this.loadLevel2();
                break;
            case 3:
                this.loadLevel3();
                break;
            case 4:
                this.loadLevel4();
                break;
            case 5:
                this.loadLevel5();
                break;
            case 6:
                this.loadLevel6();
                break;
            case 7:
                this.loadLevel7();
                break;
            case 8:
                this.loadLevel8();
                break;
            case 9:
                this.loadLevel9();
                break;
            case 10:
                this.loadLevel10();
                break;
            default:
                // 超过10关显示胜利
                if (level > this.maxLevel) {
                    this.showVictory();
                } else {
                    console.warn(`Unknown level ${level}, loading level 1 as fallback`);
                    this.loadLevel1(); // 默认加载第一关
                }
        }
        
        // 验证关卡加载结果 - 确保当前关卡的所有收集品都正确初始化
        console.log(`Level ${level} loaded successfully:`);
        console.log(`- Platforms: ${this.platforms.length}`);
        console.log(`- Current level collectibles: ${this.collectibles.length}`);
        console.log(`- Total quantum shards (accumulated): ${this.quantumShards}`);
        
        if (this.collectibles.length > 0) {
            // 强制确保所有收集品的collected状态都是false
            let fixed = 0;
            this.collectibles.forEach((c, idx) => {
                if (c.collected !== false) {
                    c.collected = false;
                    fixed++;
                }
            });
            
            if (fixed > 0) {
                console.warn(`- Fixed: Reset ${fixed} collectibles to collected=false`);
            }
            
            const allUncollected = this.collectibles.every(c => c.collected === false);
            console.log(`- All collectibles in current level initialized with collected=false: ${allUncollected}`);
            
            // 验证：确保所有收集品都是当前关卡新创建的
            console.log(`✓ Current level ${level} collectibles ready (will be checked independently for completion)`);
        } else {
            console.error(`- ERROR: No collectibles in level ${level}!`);
        }
    }
    
    // 关卡1：基础教学 - 正常维度
    loadLevel1() {
        this.platforms.push(
            { x: 0, y: 550, width: 800, height: 50, dimension: 0 },
            { x: 200, y: 450, width: 100, height: 20, dimension: 0 },
            { x: 400, y: 350, width: 100, height: 20, dimension: 0 },
            { x: 600, y: 250, width: 100, height: 20, dimension: 0 }
        );
        
        this.collectibles.push(
            { x: 250, y: 400, width: 15, height: 15, collected: false },
            { x: 450, y: 300, width: 15, height: 15, collected: false },
            { x: 650, y: 200, width: 15, height: 15, collected: false }
        );
    }
    
    // 关卡2：引入反重力维度
    loadLevel2() {
        this.platforms.push(
            { x: 0, y: 550, width: 300, height: 50, dimension: 0 },
            { x: 500, y: 550, width: 300, height: 50, dimension: 0 },
            { x: 350, y: 300, width: 100, height: 20, dimension: 1 }, // 反重力平台
            { x: 200, y: 150, width: 100, height: 20, dimension: 0 },
            { x: 500, y: 150, width: 100, height: 20, dimension: 0 }
        );
        
        this.collectibles.push(
            { x: 400, y: 250, width: 15, height: 15, collected: false },
            { x: 250, y: 100, width: 15, height: 15, collected: false },
            { x: 550, y: 100, width: 15, height: 15, collected: false }
        );
    }
    
    // 关卡3：引入时间扭曲和能量场维度，包含危险区域
    loadLevel3() {
        this.platforms.push(
            { x: 0, y: 550, width: 200, height: 50, dimension: 0 },
            { x: 300, y: 450, width: 100, height: 20, dimension: 2 }, // 时间扭曲平台
            { x: 500, y: 350, width: 100, height: 20, dimension: 3 }, // 能量场平台
            { x: 700, y: 250, width: 100, height: 20, dimension: 0 },
            { x: 150, y: 150, width: 80, height: 20, dimension: 0 }
        );
        
        this.hazards.push(
            { x: 250, y: 500, width: 300, height: 20, dimension: 0, type: 'laser' }
        );
        
        this.collectibles.push(
            { x: 350, y: 400, width: 15, height: 15, collected: false },
            { x: 550, y: 300, width: 15, height: 15, collected: false },
            { x: 750, y: 200, width: 15, height: 15, collected: false },
            { x: 190, y: 100, width: 15, height: 15, collected: false }
        );
    }
    
    // 关卡4-10：使用随机变化
    loadLevel4() {
        const baseSeed = ((this.levelRestartCount[4] || 0) * 1000) + (Date.now() % 1000);
        const rng = this.seededRandom(baseSeed);
        this.generateComplexLevel(4, rng);
    }
    
    loadLevel5() {
        const baseSeed = ((this.levelRestartCount[5] || 0) * 1000) + (Date.now() % 1000);
        const rng = this.seededRandom(baseSeed);
        this.generateComplexLevel(5, rng);
    }
    
    loadLevel6() {
        const baseSeed = ((this.levelRestartCount[6] || 0) * 1000) + (Date.now() % 1000);
        const rng = this.seededRandom(baseSeed);
        this.generateComplexLevel(6, rng);
    }
    
    loadLevel7() {
        const baseSeed = ((this.levelRestartCount[7] || 0) * 1000) + (Date.now() % 1000);
        const rng = this.seededRandom(baseSeed);
        this.generateComplexLevel(7, rng);
    }
    
    loadLevel8() {
        const baseSeed = ((this.levelRestartCount[8] || 0) * 1000) + (Date.now() % 1000);
        const rng = this.seededRandom(baseSeed);
        this.generateComplexLevel(8, rng);
    }
    
    loadLevel9() {
        const baseSeed = ((this.levelRestartCount[9] || 0) * 1000) + (Date.now() % 1000);
        const rng = this.seededRandom(baseSeed);
        this.generateComplexLevel(9, rng);
    }
    
    loadLevel10() {
        const baseSeed = ((this.levelRestartCount[10] || 0) * 1000) + (Date.now() % 1000);
        const rng = this.seededRandom(baseSeed);
        this.generateComplexLevel(10, rng);
    }
    
    // 带随机种子的随机数生成器
    seededRandom(seed) {
        let value = seed;
        return () => {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }
    
    // 生成复杂关卡（4-10关）- 难度递增的解谜挑战
    generateComplexLevel(level, rng) {
        // 基础平台（起点）
        this.platforms.push({ x: 0, y: 550, width: 200, height: 50, dimension: 0 });
        
        const numCollectibles = 3 + Math.floor(level / 2);
        console.log(`Generating level ${level}: target collectibles = ${numCollectibles}`);
        
        const platforms = [];
        const collectibles = [];
        const hazards = [];
        
        // 根据关卡难度调整参数
        const basePathStages = 4 + Math.floor(level / 2); // 4-10关：5-9个阶段
        const pathStages = Math.max(basePathStages, numCollectibles + 1); // 确保阶段数至少比收集品数多1
        const hazardDensity = Math.min(0.7, 0.3 + (level - 4) * 0.1); // 4关30%，10关70%
        const requireDimensionSwitch = level >= 6; // 6关以上要求必须切换维度
        
        console.log(`Level ${level}: pathStages=${pathStages}, numCollectibles=${numCollectibles}`);
        
        // 生成主要路径平台（确保可达性）
        let lastX = 200;
        let lastY = 450;
        let usedDimensions = new Set([0]); // 记录已使用的维度
        
        for (let i = 0; i < pathStages; i++) {
            // 确保使用所有四个维度
            let dim;
            if (requireDimensionSwitch && i > 0 && i % 2 === 0) {
                // 强制使用未使用的维度
                const unusedDims = [0, 1, 2, 3].filter(d => !usedDimensions.has(d));
                dim = unusedDims.length > 0 ? unusedDims[Math.floor(rng() * unusedDims.length)] : Math.floor(rng() * 4);
                usedDimensions.add(dim);
            } else {
                dim = Math.floor(rng() * 4);
                usedDimensions.add(dim);
            }
            
            // 根据维度调整位置策略
            let x, y;
            if (dim === 1) {
                // 反重力：平台在中间偏上
                x = lastX + 130 + rng() * 80;
                y = Math.max(150, Math.min(350, lastY - 60 + (rng() - 0.3) * 120));
            } else if (dim === 2) {
                // 时间扭曲：位置适中，但可能需要精确操作
                x = lastX + 120 + rng() * 90;
                y = Math.max(200, Math.min(400, lastY - 50 + (rng() - 0.5) * 100));
            } else if (dim === 3) {
                // 能量场：位置随机，增加挑战
                x = lastX + 140 + rng() * 70;
                y = Math.max(150, Math.min(450, lastY - 70 + (rng() - 0.4) * 140));
            } else {
                // 正常维度：标准跳跃
                x = lastX + 120 + rng() * 100;
                y = Math.max(200, Math.min(450, lastY - 80 + (rng() - 0.5) * 160));
            }
            
            const width = 70 + rng() * 50;
            platforms.push({
                x: x,
                y: y,
                width: width,
                height: 20,
                dimension: dim
            });
            
            // 收集品放在平台上（确保每个收集品都有明确的路径）
            // 确保在前numCollectibles个阶段都放置收集品
            if (collectibles.length < numCollectibles) {
                collectibles.push({
                    x: x + width / 2 - 7,
                    y: y - 25,
                    width: 15,
                    height: 15,
                    collected: false
                });
            }
            
            // 添加危险区域（难度递增，位置更刁钻）
            if (level >= 4 && rng() < hazardDensity) {
                const hazardDim = Math.floor(rng() * 4);
                // 危险区域可能在路径中间或旁边
                const hazardX = lastX + (x - lastX) / 2 + (rng() - 0.5) * 100;
                const hazardY = y + 30 + rng() * 80;
                hazards.push({
                    x: hazardX,
                    y: hazardY,
                    width: 50 + rng() * 50,
                    height: 20,
                    dimension: hazardDim,
                    type: 'laser'
                });
            }
            
            // 添加辅助平台（增加解谜选项）
            if (level >= 7 && rng() > 0.6) {
                const auxDim = Math.floor(rng() * 4);
                platforms.push({
                    x: x - 80 - rng() * 60,
                    y: y + (rng() > 0.5 ? 60 : -60),
                    width: 50 + rng() * 40,
                    height: 20,
                    dimension: auxDim
                });
            }
            
            lastX = x + width;
            lastY = y;
        }
        
        // 添加最终挑战区域（4关以上都有，6关以上更复杂）
        if (level >= 4) {
            const finalDim = Math.floor(rng() * 4);
            const finalPlat = {
                x: Math.min(750, lastX + 50),
                y: 150 + rng() * 200,
                width: 80 + rng() * 40,
                height: 20,
                dimension: finalDim
            };
            platforms.push(finalPlat);
            
            // 如果收集品还不够，在最终平台添加
            if (collectibles.length < numCollectibles) {
                collectibles.push({
                    x: finalPlat.x + finalPlat.width / 2 - 7,
                    y: finalPlat.y - 25,
                    width: 15,
                    height: 15,
                    collected: false
                });
            }
            
            // 最终区域危险（难度递增：6关以上出现）
            if (level >= 6 && rng() > 0.4) {
                hazards.push({
                    x: Math.min(700, lastX),
                    y: 300 + rng() * 150,
                    width: 60 + rng() * 60,
                    height: 20,
                    dimension: Math.floor(rng() * 4),
                    type: 'laser'
                });
            }
        }
        
        // 确保收集品数量足够 - 优先从主要路径平台添加
        let attempts = 0;
        const maxAttempts = platforms.length * 2; // 限制尝试次数，避免无限循环
        
        while (collectibles.length < numCollectibles && platforms.length > 0 && attempts < maxAttempts) {
            attempts++;
            const plat = platforms[Math.floor(rng() * platforms.length)];
            // 检查是否已经有收集品在这个平台附近
            const hasNearbyCollectible = collectibles.some(c => 
                Math.abs(c.x - (plat.x + plat.width / 2)) < 50 && 
                Math.abs(c.y - (plat.y - 25)) < 50
            );
            
            if (!hasNearbyCollectible) {
                collectibles.push({
                    x: plat.x + plat.width / 2 - 7,
                    y: plat.y - 25,
                    width: 15,
                    height: 15,
                    collected: false
                });
            } else {
                // 如果附近已有收集品，尝试其他平台
                const availablePlats = platforms.filter((p) => {
                    const checkX = p.x + p.width / 2;
                    const checkY = p.y - 25;
                    return !collectibles.some(c => 
                        Math.abs(c.x - checkX) < 50 && Math.abs(c.y - checkY) < 50
                    );
                });
                if (availablePlats.length > 0) {
                    const plat2 = availablePlats[Math.floor(rng() * availablePlats.length)];
                    collectibles.push({
                        x: plat2.x + plat2.width / 2 - 7,
                        y: plat2.y - 25,
                        width: 15,
                        height: 15,
                        collected: false
                    });
                } else {
                    // 如果所有平台都有收集品了，强制添加（可能重叠，但至少保证数量）
                    collectibles.push({
                        x: plat.x + plat.width / 2 - 7,
                        y: plat.y - 25,
                        width: 15,
                        height: 15,
                        collected: false
                    });
                }
            }
        }
        
        // 强制确保收集品数量正确 - 这是最后保障
        if (collectibles.length < numCollectibles) {
            console.warn(`Level ${level}: Expected ${numCollectibles} collectibles, got ${collectibles.length}. Force adding remaining...`);
            const remaining = numCollectibles - collectibles.length;
            
            // 从所有平台中选择，优先选择还没有收集品的平台
            const platformsWithoutCollectibles = platforms.filter(p => {
                const checkX = p.x + p.width / 2;
                const checkY = p.y - 25;
                return !collectibles.some(c => 
                    Math.abs(c.x - checkX) < 30 && Math.abs(c.y - checkY) < 30
                );
            });
            
            // 添加剩余的收集品
            for (let i = 0; i < remaining; i++) {
                let targetPlatform;
                if (platformsWithoutCollectibles.length > 0) {
                    // 优先选择没有收集品的平台
                    targetPlatform = platformsWithoutCollectibles[i % platformsWithoutCollectibles.length];
                } else if (platforms.length > 0) {
                    // 如果没有可用平台，强制添加到已有平台（可能重叠）
                    targetPlatform = platforms[i % platforms.length];
                } else {
                    // 如果连平台都没有，添加到基础平台
                    break;
                }
                
                collectibles.push({
                    x: targetPlatform.x + targetPlatform.width / 2 - 7,
                    y: targetPlatform.y - 25,
                    width: 15,
                    height: 15,
                    collected: false
                });
            }
        }
        
        this.platforms.push(...platforms);
        this.collectibles.push(...collectibles);
        this.hazards.push(...hazards);
        
        // 确保所有收集品的collected状态为false
        this.collectibles.forEach((c, idx) => {
            if (c.collected !== false) {
                console.warn(`Level ${level} collectible ${idx}: collected was ${c.collected}, resetting to false`);
                c.collected = false;
            }
        });
        
        // 最终验证：确保至少有一个收集品
        if (this.collectibles.length === 0) {
            console.error(`Level ${level}: No collectibles generated! Adding one to base platform.`);
            this.collectibles.push({
                x: 100,
                y: 500,
                width: 15,
                height: 15,
                collected: false
            });
        }
        
        // 最终强制检查：如果还是不够，强制添加到基础平台
        if (this.collectibles.length < numCollectibles) {
            console.error(`Level ${level}: CRITICAL ERROR! Collectibles count mismatch! Expected ${numCollectibles}, got ${this.collectibles.length}. Adding to base platform.`);
            const remaining = numCollectibles - this.collectibles.length;
            for (let i = 0; i < remaining; i++) {
                this.collectibles.push({
                    x: 100 + i * 50,
                    y: 500,
                    width: 15,
                    height: 15,
                    collected: false
                });
            }
            console.log(`- Fixed: Now have ${this.collectibles.length} collectibles`);
        }
        
        // 最终验证：确保收集品数量正确
        console.log(`Level ${level} generation complete:`);
        console.log(`- Expected collectibles: ${numCollectibles}`);
        console.log(`- Actual collectibles: ${this.collectibles.length}`);
        console.log(`- All collected = false: ${this.collectibles.every(c => c.collected === false)}`);
        
        // 验证最终数量
        if (this.collectibles.length !== numCollectibles) {
            console.error(`Level ${level}: STILL MISMATCH! Expected ${numCollectibles}, got ${this.collectibles.length}`);
        } else {
            console.log(`✓ Level ${level}: Collectibles count verified: ${this.collectibles.length}`);
        }
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        const dimension = this.dimensions[this.currentDimension];
        const timeScale = dimension.timeScale;
        
        // 更新玩家
        this.updatePlayer(deltaTime * timeScale);
        
        // 更新粒子
        this.updateParticles();
        
        // 碰撞检测
        this.checkCollisions();
        
        // 检查胜利条件
        this.checkWinCondition();
    }
    
    updatePlayer(deltaTime) {
        const dimension = this.dimensions[this.currentDimension];
        const isReverseGravity = dimension.gravity < 0; // 判断是否是反重力维度
        
        // 水平移动
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.player.vx = -this.player.speed;
        } else if (this.keys['d'] || this.keys['arrowright']) {
            this.player.vx = this.player.speed;
        } else {
            this.player.vx *= 0.8; // 摩擦力
        }
        
        // 跳跃（在反重力模式下，跳跃应该是向下）
        if ((this.keys['w'] || this.keys['arrowup'] || this.keys[' ']) && this.player.onGround) {
            if (isReverseGravity) {
                this.player.vy = 12; // 反重力模式下向下跳跃
            } else {
                this.player.vy = -12; // 正常模式下向上跳跃
            }
            this.player.onGround = false;
            this.playSound('playerJump');
        }
        
        // 应用重力
        this.player.vy += dimension.gravity;
        
        // 能量场效果
        if (dimension.forceField) {
            // 模拟能量场推动效果
            this.player.vx += Math.sin(Date.now() * 0.001) * 0.1;
            this.player.vy += Math.cos(Date.now() * 0.0015) * 0.1;
        }
        
        // 更新位置
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;
        
        // 水平边界检查（阻止玩家移动到画布外）
        if (this.player.x < 0) {
            this.player.x = 0;
            this.player.vx = 0;
        }
        if (this.player.x > this.canvas.width - this.player.width) {
            this.player.x = this.canvas.width - this.player.width;
            this.player.vx = 0;
        }
        
        // 垂直边界限制（防止无限飞出，但允许反重力模式正常工作）
        // 正常重力模式下，阻止向上超出画布顶部太多
        if (!isReverseGravity && this.player.y < -10) {
            this.player.y = -10;
            this.player.vy = Math.max(0, this.player.vy); // 允许向下移动
        }
        // 反重力模式下，阻止向下超出画布底部太多
        if (isReverseGravity && this.player.y > this.canvas.height - this.player.height + 10) {
            this.player.y = this.canvas.height - this.player.height + 10;
            this.player.vy = Math.min(0, this.player.vy); // 允许向上移动
        }
        
        // 更新轨迹
        this.player.trail.push({ x: this.player.x + this.player.width/2, y: this.player.y + this.player.height/2 });
        if (this.player.trail.length > 20) {
            this.player.trail.shift();
        }
        
        this.player.onGround = false;
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    checkCollisions() {
        const dimension = this.dimensions[this.currentDimension];
        const isReverseGravity = dimension.gravity < 0; // 判断是否是反重力维度
        
        // 平台碰撞
        this.platforms.forEach(platform => {
            if (platform.dimension === this.currentDimension || platform.dimension === undefined) {
                if (this.isColliding(this.player, platform)) {
                    if (isReverseGravity) {
                        // 反重力模式：从下往上碰撞，落在平台下表面
                        // 玩家向上移动且玩家的顶部在平台底部下方或刚刚越过
                        if (this.player.vy < 0 && 
                            this.player.y < platform.y + platform.height && 
                            this.player.y + this.player.height > platform.y + platform.height) {
                            this.player.y = platform.y + platform.height;
                            this.player.vy = 0;
                            this.player.onGround = true;
                        }
                    } else {
                        // 正常重力模式：从上往下碰撞，落在平台上面
                        // 玩家向下移动且玩家的底部在平台顶部上方或刚刚越过
                        if (this.player.vy > 0 && 
                            this.player.y + this.player.height > platform.y && 
                            this.player.y < platform.y) {
                            this.player.y = platform.y - this.player.height;
                            this.player.vy = 0;
                            this.player.onGround = true;
                        }
                    }
                }
            }
        });
        
        // 收集品碰撞 - 只处理当前关卡内的收集品
        this.collectibles.forEach((collectible, index) => {
            // 确保collectible有collected属性
            if (collectible.collected === undefined || collectible.collected === null) {
                collectible.collected = false;
            }
            
            // 检查碰撞：当前关卡内的收集品且还未收集
            if (collectible.collected !== true && this.isColliding(this.player, collectible)) {
                // 标记当前关卡的这个收集品为已收集
                collectible.collected = true;
                
                // 累计量子碎片（全局累计）
                this.quantumShards++;
                
                // 恢复能量
                this.energy = Math.min(this.energy + 10, this.maxEnergy);
                
                // 创建收集效果
                this.createCollectionEffect(collectible);
                
                // 调试信息：显示当前关卡进度和累计总数
                const remainingInCurrentLevel = this.collectibles.filter(c => c.collected !== true).length;
                const totalInCurrentLevel = this.collectibles.length;
                console.log(`✓ Collected shard in level ${this.currentLevel}: ${totalInCurrentLevel - remainingInCurrentLevel}/${totalInCurrentLevel} (总量子碎片: ${this.quantumShards})`);
                
                // 如果当前关卡全部收集完成
                if (remainingInCurrentLevel === 0) {
                    console.log(`🎉 Level ${this.currentLevel} all ${totalInCurrentLevel} collectibles collected!`);
                }
            }
        });
        
        // 危险区域碰撞
        this.hazards.forEach(hazard => {
            if (hazard.dimension === this.currentDimension && this.isColliding(this.player, hazard)) {
                this.takeDamage(20);
            }
        });
        
        // 掉落检测（包括反重力情况）
        // 添加维度切换后的短暂保护期（500ms），避免切换瞬间掉落扣能量
        const timeSinceDimensionSwitch = Date.now() - this.lastDimensionSwitchTime;
        const dimensionSwitchProtection = timeSinceDimensionSwitch < 500;
        const currentTime = Date.now();
        
        if (isReverseGravity) {
            // 反重力模式：从上方掉落
            if (this.player.y < -50 && !dimensionSwitchProtection) {
                // 首次超出上界，记录时间
                if (this.upperBoundWarningTime === 0) {
                    this.upperBoundWarningTime = currentTime;
                }
                
                // 检查是否超过宽限期
                const timeSinceWarning = currentTime - this.upperBoundWarningTime;
                if (timeSinceWarning >= this.upperBoundGracePeriod) {
                    // 宽限期已过，gameover
                    this.takeDamage(50);
                    this.resetPlayer();
                    this.upperBoundWarningTime = 0; // 重置警告时间
                }
                // 否则在宽限期内，允许玩家切换维度来恢复
            } else if (this.player.y >= -50) {
                // 玩家回到屏幕内，清除警告
                this.upperBoundWarningTime = 0;
            }
        } else {
            // 正常重力模式：从下方掉落
            // 如果之前在反重力模式下超出上界，现在切换回正常维度，检查是否恢复
            if (this.upperBoundWarningTime > 0) {
                // 如果玩家回到屏幕内（y >= 0），清除警告
                if (this.player.y >= 0 && this.player.y <= this.canvas.height) {
                    this.upperBoundWarningTime = 0; // 成功恢复，清除警告
                } else {
                    // 还在屏幕外，继续计时
                    const timeSinceWarning = currentTime - this.upperBoundWarningTime;
                    if (timeSinceWarning >= this.upperBoundGracePeriod) {
                        // 宽限期已过，gameover
                        this.takeDamage(50);
                        this.resetPlayer();
                        this.upperBoundWarningTime = 0; // 重置警告时间
                    }
                }
            }
            
            // 正常重力的掉落检测（独立于反重力警告）
            if (this.player.y > this.canvas.height + 50 && !dimensionSwitchProtection) {
                this.takeDamage(50);
                this.resetPlayer();
            }
        }
    }
    
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    createCollectionEffect(collectible) {
        this.playSound('collectShard');
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: collectible.x + collectible.width/2,
                y: collectible.y + collectible.height/2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 40,
                maxLife: 40,
                color: '#00ff00',
                size: Math.random() * 3 + 1
            });
        }
    }
    
    takeDamage(amount) {
        this.energy -= amount;
        this.playSound('hazardHit');
        if (this.energy <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        this.gameState = 'menu';
        document.getElementById('gameOverlay').classList.remove('hidden');
        
        // 重要：不重置当前关卡，保持当前关卡
        // 不重置量子碎片（quantumShards），保持累计值
        // 只重置当前关卡的状态标志
        
        console.log(`Game over at level ${this.currentLevel}`);
        console.log(`- Current level will be restarted (collectibles will be reset)`);
        console.log(`- Quantum shards (累计) remain: ${this.quantumShards}`);
        
        // 如果是4-10关，增加重启计数，下次加载时会有随机变化
        if (this.currentLevel >= 4 && this.currentLevel <= 10) {
            if (!this.levelRestartCount[this.currentLevel]) {
                this.levelRestartCount[this.currentLevel] = 0;
            }
            this.levelRestartCount[this.currentLevel]++; // 增加重启计数
        }
        
        // 注意：收集品数组会在startGame -> loadLevel时重置
        // 量子碎片不会重置（累计值）
        
        // 能量会在startGame时恢复
        this.updateUI();
    }
    
    checkWinCondition() {
        // 确保有收集品且游戏状态正确
        if (this.collectibles.length === 0) {
            console.warn(`Level ${this.currentLevel}: No collectibles! This should not happen.`);
            return;
        }
        
        if (this.gameState !== 'playing') {
            return;
        }
        
        // 关键修复：只检查当前关卡内的收集品状态（不依赖累计的quantumShards）
        // 确保所有collectibles的collected属性都是明确的布尔值
        this.collectibles.forEach((c, idx) => {
            if (c.collected === undefined || c.collected === null) {
                console.warn(`Level ${this.currentLevel} collectible ${idx}: collected is ${c.collected}, fixing to false`);
                c.collected = false;
            }
        });
        
        // 严格检查：当前关卡内所有收集品都必须 collected === true
        const currentLevelCollectibles = this.collectibles; // 当前关卡的收集品数组
        const uncollectedInCurrentLevel = currentLevelCollectibles.filter(c => c.collected !== true);
        const collectedInCurrentLevel = currentLevelCollectibles.filter(c => c.collected === true);
        
        const uncollectedCount = uncollectedInCurrentLevel.length;
        const collectedCount = collectedInCurrentLevel.length;
        const totalInCurrentLevel = currentLevelCollectibles.length;
        
        // 通关条件：当前关卡内所有收集品都已收集（collected === true）
        const allCollectedInCurrentLevel = uncollectedCount === 0 && collectedCount === totalInCurrentLevel && totalInCurrentLevel > 0;
        
        // 每帧检查（只在接近完成时输出）
        if (uncollectedCount <= 2) {
            console.log(`[Level ${this.currentLevel}] Current level progress: ${collectedCount}/${totalInCurrentLevel} collected (量子碎片总数: ${this.quantumShards})`);
        }
        
        // 检查是否当前关卡的所有收集品都已收集
        if (allCollectedInCurrentLevel && !this.levelCompleteTriggered) {
            console.log(`=== LEVEL ${this.currentLevel} COMPLETED ===`);
            console.log(`Current level collectibles: ${totalInCurrentLevel}`);
            console.log(`Collected in current level: ${collectedCount}`);
            console.log(`Uncollected in current level: ${uncollectedCount}`);
            console.log(`Total quantum shards (accumulated): ${this.quantumShards}`);
            console.log(`All collected in current level: ${allCollectedInCurrentLevel}`);
            console.log(`Level complete triggered: ${this.levelCompleteTriggered}`);
            
            // 验证每个收集品的状态
            currentLevelCollectibles.forEach((c, idx) => {
                console.log(`  Collectible ${idx}: collected=${c.collected} (should be true)`);
            });
            
            this.levelCompleteTriggered = true;
            this.showLevelComplete();
            
            // 使用箭头函数确保this绑定正确
            const self = this;
            const currentLevel = this.currentLevel; // 保存关卡号
            setTimeout(() => {
                console.log(`Timeout callback executing for level ${currentLevel}`);
                if (self.currentLevel === currentLevel) { // 确保关卡还没变化
                    self.nextLevel();
                }
            }, 2000);
        } else if (allCollectedInCurrentLevel && this.levelCompleteTriggered) {
            // 已经触发但还没切换，可能是setTimeout没执行
            console.warn(`Level ${this.currentLevel} completed but not advanced. Triggered: ${this.levelCompleteTriggered}`);
        }
    }
    
    showLevelComplete() {
        // 创建关卡完成效果
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
                y: this.canvas.height / 2 + (Math.random() - 0.5) * 200,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 60,
                maxLife: 60,
                color: '#00ff00',
                size: Math.random() * 5 + 2
            });
        }
    }
    
    showVictory() {
        this.gameState = 'victory';
        // 创建胜利效果
        for (let i = 0; i < 100; i++) {
            this.particles.push({
                x: this.canvas.width / 2 + (Math.random() - 0.5) * 400,
                y: this.canvas.height / 2 + (Math.random() - 0.5) * 400,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 100,
                maxLife: 100,
                color: '#00ff00',
                size: Math.random() * 8 + 2
            });
        }
        
        // 显示胜利界面
        document.getElementById('victoryOverlay').classList.remove('hidden');
    }
    
    nextLevel() {
        console.log(`=== nextLevel() called ===`);
        console.log(`Current level: ${this.currentLevel}`);
        console.log(`Max level: ${this.maxLevel}`);
        console.log(`Game state: ${this.gameState}`);
        
        if (this.currentLevel >= this.maxLevel) {
            // 完成所有关卡，显示胜利
            console.log('All levels completed! Showing victory screen.');
            this.showVictory();
        } else {
            const previousLevel = this.currentLevel;
            this.currentLevel++;
            console.log(`Moving from level ${previousLevel} to level ${this.currentLevel}`);
            
            this.energy = this.maxEnergy; // 恢复能量
            this.levelCompleteTriggered = false; // 重置关卡完成标志
            
            console.log(`Loading level ${this.currentLevel}...`);
            this.loadLevel(this.currentLevel);
            
            console.log(`Level ${this.currentLevel} loaded:`);
            console.log(`- Platforms: ${this.platforms.length}`);
            console.log(`- Collectibles: ${this.collectibles.length}`);
            console.log(`- Hazards: ${this.hazards.length}`);
            
            // 验证收集品是否正确初始化
            const uncollected = this.collectibles.filter(c => !c.collected).length;
            const collected = this.collectibles.filter(c => c.collected).length;
            console.log(`- Uncollected: ${uncollected}, Collected: ${collected}`);
            
            if (this.collectibles.length === 0) {
                console.error(`ERROR: Level ${this.currentLevel} has no collectibles!`);
            }
            
            this.resetPlayer();
            this.updateUI();
            
            // 确保游戏状态为playing
            if (this.gameState !== 'playing') {
                console.warn(`Game state was ${this.gameState}, setting to playing`);
                this.gameState = 'playing';
            }
        }
    }
    
    render() {
        // 清空画布
        this.ctx.fillStyle = 'rgba(10, 10, 46, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制维度背景效果
        this.renderDimensionBackground();
        
        // 绘制平台
        this.renderPlatforms();
        
        // 绘制收集品
        this.renderCollectibles();
        
        // 绘制危险区域
        this.renderHazards();
        
        // 绘制玩家轨迹
        this.renderPlayerTrail();
        
        // 绘制玩家
        this.renderPlayer();
        
        // 绘制粒子
        this.renderParticles();
        
        // 绘制维度指示器
        this.renderDimensionIndicator();
        
        // 绘制宽限期警告
        this.renderUpperBoundWarning();
    }
    
    renderDimensionBackground() {
        const dimension = this.dimensions[this.currentDimension];
        
        // 创建渐变背景
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, 0,
            this.canvas.width/2, this.canvas.height/2, this.canvas.width/2
        );
        
        const baseColor = dimension.color;
        gradient.addColorStop(0, baseColor + '20');
        gradient.addColorStop(1, baseColor + '05');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 添加维度特定的视觉效果
        if (dimension.forceField) {
            this.renderForceFieldEffect();
        }
        
        if (dimension.timeScale < 1) {
            this.renderTimeWarpEffect();
        }
    }
    
    renderForceFieldEffect() {
        const time = Date.now() * 0.001;
        for (let i = 0; i < 5; i++) {
            this.ctx.strokeStyle = `rgba(249, 115, 22, ${0.3 - i * 0.05})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(
                this.canvas.width/2 + Math.sin(time + i) * 100,
                this.canvas.height/2 + Math.cos(time + i * 1.5) * 100,
                50 + i * 30,
                0, Math.PI * 2
            );
            this.ctx.stroke();
        }
    }
    
    renderTimeWarpEffect() {
        const time = Date.now() * 0.0005;
        for (let i = 0; i < 3; i++) {
            this.ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 - i * 0.1})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2, this.canvas.height/2, 100 + i * 50, time, time + Math.PI);
            this.ctx.stroke();
        }
    }
    
    renderPlatforms() {
        this.platforms.forEach(platform => {
            if (platform.dimension === this.currentDimension || platform.dimension === undefined) {
                this.ctx.fillStyle = '#ffffff40';
                this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
                
                this.ctx.strokeStyle = '#ffffff80';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
            } else {
                // 其他维度的平台显示为半透明
                this.ctx.fillStyle = '#ffffff20';
                this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            }
        });
    }
    
    renderCollectibles() {
        this.collectibles.forEach(collectible => {
            if (!collectible.collected) {
                const time = Date.now() * 0.005;
                
                // 发光效果
                const glowGradient = this.ctx.createRadialGradient(
                    collectible.x + collectible.width/2,
                    collectible.y + collectible.height/2,
                    0,
                    collectible.x + collectible.width/2,
                    collectible.y + collectible.height/2,
                    20
                );
                glowGradient.addColorStop(0, '#00ff0040');
                glowGradient.addColorStop(1, '#00ff0000');
                
                this.ctx.fillStyle = glowGradient;
                this.ctx.fillRect(
                    collectible.x - 10,
                    collectible.y - 10,
                    collectible.width + 20,
                    collectible.height + 20
                );
                
                // 收集品本体
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(collectible.x, collectible.y, collectible.width, collectible.height);
                
                // 旋转效果
                this.ctx.save();
                this.ctx.translate(collectible.x + collectible.width/2, collectible.y + collectible.height/2);
                this.ctx.rotate(time);
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(-collectible.width/2, -collectible.height/2, collectible.width, collectible.height);
                this.ctx.restore();
            }
        });
    }
    
    renderHazards() {
        this.hazards.forEach(hazard => {
            if (hazard.dimension === this.currentDimension) {
                const time = Date.now() * 0.01;
                
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height);
                
                // 激光效果
                if (hazard.type === 'laser') {
                    this.ctx.strokeStyle = '#ff0000';
                    this.ctx.lineWidth = 3;
                    this.ctx.setLineDash([10, 5]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(hazard.x, hazard.y);
                    this.ctx.lineTo(hazard.x + hazard.width, hazard.y);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                }
            }
        });
    }
    
    renderPlayerTrail() {
        if (this.player.trail.length > 1) {
            this.ctx.strokeStyle = this.dimensions[this.currentDimension].color + '80';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            
            for (let i = 0; i < this.player.trail.length; i++) {
                const point = this.player.trail[i];
                if (i === 0) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            }
            
            this.ctx.stroke();
        }
    }
    
    renderPlayer() {
        const dimension = this.dimensions[this.currentDimension];
        
        // 玩家发光效果
        const glowGradient = this.ctx.createRadialGradient(
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            0,
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            30
        );
        glowGradient.addColorStop(0, dimension.color + '60');
        glowGradient.addColorStop(1, dimension.color + '00');
        
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(
            this.player.x - 10,
            this.player.y - 10,
            this.player.width + 20,
            this.player.height + 20
        );
        
        // 玩家本体
        this.ctx.fillStyle = dimension.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // 玩家边框
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);
    }
    
    renderParticles() {
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    renderDimensionIndicator() {
        // 在屏幕边缘显示当前维度
        this.ctx.fillStyle = this.dimensions[this.currentDimension].color;
        this.ctx.fillRect(0, 0, this.canvas.width, 4);
        this.ctx.fillRect(0, this.canvas.height - 4, this.canvas.width, 4);
        this.ctx.fillRect(0, 0, 4, this.canvas.height);
        this.ctx.fillRect(this.canvas.width - 4, 0, 4, this.canvas.height);
    }
    
    renderUpperBoundWarning() {
        // 如果在上界宽限期内，显示警告
        if (this.upperBoundWarningTime > 0 && this.gameState === 'playing') {
            const currentTime = Date.now();
            const timeSinceWarning = currentTime - this.upperBoundWarningTime;
            const remainingTime = this.upperBoundGracePeriod - timeSinceWarning;
            
            if (remainingTime > 0) {
                // 计算警告强度（越接近0越紧急）
                const warningIntensity = Math.min(1, remainingTime / 1000); // 最后1秒最紧急
                const alpha = 0.5 + (1 - warningIntensity) * 0.5; // 透明度随剩余时间变化
                const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 0.8; // 脉冲效果
                
                // 绘制红色警告背景闪烁效果
                this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.2 * pulse})`;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                // 绘制警告文字（带阴影效果）
                const remainingSeconds = (remainingTime / 1000).toFixed(1);
                this.ctx.font = 'bold 36px Orbitron, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                // 文字阴影
                this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
                this.ctx.fillText('警告：超出边界！', this.canvas.width / 2 + 2, this.canvas.height / 2 - 42);
                this.ctx.fillText(`剩余时间: ${remainingSeconds}秒`, this.canvas.width / 2 + 2, this.canvas.height / 2 - 2);
                this.ctx.fillText('请切换维度返回！', this.canvas.width / 2 + 2, this.canvas.height / 2 + 38);
                
                // 文字主体
                this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                this.ctx.fillText('警告：超出边界！', this.canvas.width / 2, this.canvas.height / 2 - 40);
                this.ctx.fillText(`剩余时间: ${remainingSeconds}秒`, this.canvas.width / 2, this.canvas.height / 2);
                this.ctx.fillText('请切换维度返回！', this.canvas.width / 2, this.canvas.height / 2 + 40);
            }
        }
    }
    
    updateUI() {
        document.getElementById('currentLevel').textContent = this.currentLevel;
        document.getElementById('quantumShards').textContent = this.quantumShards;
        document.getElementById('energyValue').textContent = Math.max(0, this.energy);
        
        const energyPercent = Math.max(0, this.energy) / this.maxEnergy * 100;
        document.getElementById('energyBar').style.width = energyPercent + '%';
    }
    
    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        this.updateUI();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new QuantumJumper();
});
