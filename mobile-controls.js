/**
 * 移动端控制类：处理虚拟摇杆、触摸按钮等交互逻辑
 * 依赖：需在 main.js 中实例化，传入游戏核心对象
 */
export class MobileControls {
    constructor(game) {
        // 关联游戏核心实例
        this.game = game;
        // 虚拟摇杆状态：激活状态、基础坐标、当前坐标、最大活动距离
        this.joystick = {
            active: false,
            baseX: 0,
            baseY: 0,
            currentX: 0,
            currentY: 0,
            maxDistance: 40 // 摇杆最大偏移距离（px）
        };
        // 初始化控制事件
        this.init();
    }

    // 初始化所有控制组件
    init() {
        this.setupJoystick();
        this.setupActionButtons();
        this.setupDimensionButtons();
        this.setupPauseButton();
    }

    // 1. 虚拟摇杆：控制移动+跳跃（映射PC端 WASD）
    setupJoystick() {
        const joystick = document.getElementById('joystick');
        const knob = document.getElementById('joystickKnob');

        // 触摸开始：激活摇杆并记录基础坐标
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 阻止默认触摸行为（如滚动）
            const touch = e.touches[0];
            const rect = joystick.getBoundingClientRect();

            this.joystick.active = true;
            this.joystick.baseX = rect.left + rect.width / 2; // 摇杆中心点X
            this.joystick.baseY = rect.top + rect.height / 2; // 摇杆中心点Y
            this.joystick.currentX = touch.clientX;
            this.joystick.currentY = touch.clientY;

            this.updateJoystickPosition(touch.clientX, touch.clientY);
        });

        // 触摸移动：更新摇杆位置和游戏方向
        document.addEventListener('touchmove', (e) => {
            if (this.joystick.active) {
                e.preventDefault();
                const touch = e.touches[0];
                this.joystick.currentX = touch.clientX;
                this.joystick.currentY = touch.clientY;
                this.updateJoystickPosition(touch.clientX, touch.clientY);
            }
        });

        // 触摸结束：重置摇杆和方向状态
        document.addEventListener('touchend', () => {
            if (this.joystick.active) {
                this.joystick.active = false;
                knob.style.transform = 'translate(-50%, -50%)'; // 摇杆复位
                this.game.keys = { a: false, d: false, w: false }; // 清空方向
            }
        });
    }

    // 更新摇杆视觉位置和游戏方向映射
    updateJoystickPosition(x, y) {
        const dx = x - this.joystick.baseX; // X轴偏移
        const dy = y - this.joystick.baseY; // Y轴偏移
        const distance = Math.sqrt(dx * dx + dy * dy); // 触摸点到摇杆中心距离
        const normalizedDistance = Math.min(distance, this.joystick.maxDistance) / this.joystick.maxDistance; // 归一化偏移

        // 计算触摸角度（映射方向）
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        // 重置所有方向，避免冲突
        this.game.keys = { a: false, d: false, w: false };

        // 根据角度映射方向键
        if (angle > -135 && angle < -45) this.game.keys.w = true; // 上 → 跳跃（W）
        if (angle > 135 || angle < -135) this.game.keys.a = true; // 左 → 左移（A）
        if (angle > -45 && angle < 45) this.game.keys.d = true; // 右 → 右移（D）

        // 更新摇杆旋钮视觉位置
        const knobX = normalizedDistance * dx;
        const knobY = normalizedDistance * dy;
        const knob = document.getElementById('joystickKnob');
        knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    }

    // 2. 动作按钮：跳跃（重复）、快速切换（映射PC端空格）
    setupActionButtons() {
        // 跳跃按钮（补充摇杆跳跃，避免误触）
        const jumpBtn = document.getElementById('jumpBtn');
        jumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.game.keys.w = true;
        });
        jumpBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.game.keys.w = false;
        });

        // 快速切换按钮（映射PC端空格）
        const quickSwitchBtn = document.getElementById('quickSwitchBtn');
        quickSwitchBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.game.gameState === 'playing') {
                this.game.quickSwitch(); // 调用游戏核心的快速切换方法
            }
        });
    }

    // 3. 维度切换按钮：映射PC端 1-4 键
    setupDimensionButtons() {
        document.querySelectorAll('.dimension-btn').forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const dim = parseInt(btn.dataset.dim); // 获取按钮绑定的维度索引
                if (this.game.gameState === 'playing') {
                    this.game.switchDimension(dim); // 调用游戏核心的维度切换方法
                    // 视觉反馈：激活当前维度按钮
                    document.querySelectorAll('.dimension-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });
    }

    // 4. 暂停按钮：映射PC端 ESC 键
    setupPauseButton() {
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.game.togglePause(); // 调用游戏核心的暂停/继续方法
        });
    }
}