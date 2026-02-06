// Ensure class is available globally
class ColorLoopGame extends Phaser.Scene {
    constructor() {
        super({ key: 'ColorLoopGame' });
    }


    init() {
        // Reset game state
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.ballAngle = 0;
        this.ballSpeed = 0.02;
        this.colors = [0xff3366, 0x33ff66, 0x3366ff, 0xffff33]; // Enhanced colors: Pink, Green, Blue, Yellow
        this.colorNames = ['Red', 'Green', 'Blue', 'Yellow'];
        this.ballColor = 0xffffff; // White ball - contrasts with all ring colors
        this.targetColorIndex = Phaser.Math.Between(0, 3); // Random initial target color
        this.lastTargetColorIndex = this.targetColorIndex; // Track last target to detect changes
        this.currentColorIndex = 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.lastSuccessTime = 0;
        this.comboMultiplier = 1;
        this.particleEmitter = null;
        this.totalCoins = this.loadCoins(); // Load coins from localStorage
        this.coinsEarnedThisGame = 0; // Track coins earned in current game
        this.selectedBallSkin = this.loadSelectedBallSkin();
        this.selectedRingTheme = this.loadSelectedRingTheme();
        this.selectedBackground = this.loadSelectedBackground();
        this.items = this.initializeItems();
        this.shopOverlay = null;
        this.shopPanel = null;
        this.startScreen = null;
        this.currentShopTab = 'ballSkins'; // Track current shop tab
        this.lastSpeedMilestone = 0; // Track last score milestone for speed increase
    }

    create() {
        // Initialize game state
        this.init();

        // Apply selected ring theme first (before creating arcs)
        const ringTheme = this.items.ringThemes[this.selectedRingTheme];
        if (ringTheme && ringTheme.colors) {
            this.colors = ringTheme.colors;
            // Update colorNames based on selected theme
            if (ringTheme.id === 'ocean') {
                this.colorNames = ['Cyan', 'Pure Blue', 'Aqua Green', 'Ocean Blue'];
            } else if (ringTheme.id === 'pastel') {
                this.colorNames = ['Pink', 'Mint', 'Sky', 'Yellow'];
            } else if (ringTheme.id === 'neon') {
                this.colorNames = ['Magenta', 'Green', 'Yellow', 'Pink'];
            } else if (ringTheme.id === 'sunset') {
                this.colorNames = ['Coral', 'Orange', 'Red', 'Pink'];
            } else {
                // Default/Classic
                this.colorNames = ['Red', 'Green', 'Blue', 'Yellow'];
            }
        }

        // Create smooth blended gradient background with darker red, yellow, and pink
        const bgWidth = this.cameras.main.width;
        const bgHeight = this.cameras.main.height;

        // Create a texture for the gradient background
        const gradientTexture = this.textures.createCanvas('gradient-bg', bgWidth, bgHeight);
        const ctx = gradientTexture.getContext();

        // Create linear gradient from top to bottom
        const gradient = ctx.createLinearGradient(0, 0, 0, bgHeight);

        // Add color stops for smooth blending - darker colors
        gradient.addColorStop(0, '#8B0000');    // Dark red
        gradient.addColorStop(0.2, '#A02040');  // Dark red-pink
        gradient.addColorStop(0.4, '#B83060');  // Medium dark pink
        gradient.addColorStop(0.6, '#CC6600');  // Dark orange
        gradient.addColorStop(0.8, '#CC8800');  // Yellow-orange
        gradient.addColorStop(1, '#AA9900');    // Dark yellow

        // Fill the canvas with the gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, bgWidth, bgHeight);

        // Refresh the texture
        gradientTexture.refresh();

        // Add the gradient as an image
        const bgImage = this.add.image(0, 0, 'gradient-bg');
        bgImage.setOrigin(0, 0);
        bgImage.setDepth(-100);

        // Set a dark base color
        this.cameras.main.setBackgroundColor('#2a0a0a'); // Very dark red base

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        const radius = 150;

        // Create colored arcs (sections of the circle) with enhanced visuals
        this.arcs = [];
        const arcAngle = Math.PI * 2 / 4; // 4 sections, each π/2 radians

        for (let i = 0; i < 4; i++) {
            const startAngle = i * arcAngle - Math.PI / 2; // Start from top (-π/2)
            const graphics = this.add.graphics();
            // Enhanced glow effect with multiple layers
            graphics.lineStyle(45, this.colors[i], 0.6); // Outer glow layer
            graphics.beginPath();
            graphics.arc(centerX, centerY, radius + 2, startAngle, startAngle + arcAngle);
            graphics.strokePath();

            graphics.lineStyle(40, this.colors[i], 1); // Main ring
            graphics.beginPath();
            graphics.arc(centerX, centerY, radius, startAngle, startAngle + arcAngle);
            graphics.strokePath();

            graphics.lineStyle(30, this.colors[i], 0.8); // Inner glow
            graphics.beginPath();
            graphics.arc(centerX, centerY, radius - 2, startAngle, startAngle + arcAngle);
            graphics.strokePath();

            this.arcs.push({ graphics, color: this.colors[i], startAngle, endAngle: startAngle + arcAngle });
        }

        // Create rotating ball - starts at angle 0 (right side)
        // Use selected ball skin
        const ballSkin = this.items.ballSkins[this.selectedBallSkin];
        this.ballColor = ballSkin.color || 0xffffff;
        this.ball = this.add.circle(centerX + radius, centerY, 28, this.ballColor);
        this.ball.setStrokeStyle(4, ballSkin.strokeColor || 0x000000);

        // Add glow effect to ball with shadow
        this.ball.setBlendMode(Phaser.BlendModes.ADD);
        this.ballShadow = this.add.circle(centerX + radius, centerY, 30, this.ballColor, 0.3);
        this.ballShadow.setBlendMode(Phaser.BlendModes.SCREEN);

        // Score text with enhanced styling
        this.scoreText = this.add.text(centerX, 40, 'Score: 0', {
            fontSize: '36px',
            fill: '#ffb6c1',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setShadow(0, 0, '#ffb6c1', 15, true, true).setShadow(0, 0, '#d4a8ff', 25, true, true);

        // Combo text
        this.comboText = this.add.text(centerX, 80, '', {
            fontSize: '24px',
            fill: '#ffff33',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setShadow(0, 0, '#ffff33', 12, true, true).setVisible(false);

        // Combo multiplier text
        this.multiplierText = this.add.text(centerX, 110, '', {
            fontSize: '20px',
            fill: '#ff3366',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setShadow(0, 0, '#ff3366', 10, true, true).setVisible(false);

        // Coin counter with background for better visibility
        const width = this.cameras.main.width;
        const coinBg = this.add.rectangle(40, 32, 140, 35, 0x1a1a3e, 0.9)
            .setOrigin(0, 0.5)
            .setStrokeStyle(2, 0xffb6c1, 0.8)
            .setDepth(50);
        this.coinText = this.add.text(40 + 70, 32, '🪙 ' + (this.totalCoins || 0), {
            fontSize: '24px',
            fill: '#ffff33',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(51).setShadow(0, 0, '#ffff33', 12, true, true);

        // Also add coin counter in top-right corner
        this.coinTextTopRight = this.add.text(width - 40, 50, '🪙 ' + (this.totalCoins || 0), {
            fontSize: '24px',
            fill: '#ffff33',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(1, 0.5).setDepth(51).setShadow(0, 0, '#ffff33', 12, true, true);

        // Shop button
        this.shopButton = this.add.rectangle(width - 140, 32, 100, 35, 0x1a1a3e, 0.9)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffb6c1, 0.8)
            .setInteractive({ useHandCursor: true, pixelPerfect: false })
            .setDepth(100)
            .setScrollFactor(0);
        this.shopLabel = this.add.text(width - 140, 32, '🛍️ Shop', {
            fontSize: '18px',
            fill: '#ffb6c1',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(101).setShadow(0, 0, '#ffb6c1', 10, true, true).setScrollFactor(0);
        this.shopButton.on('pointerover', () => {
            this.tweens.add({ targets: this.shopButton, scaleX: 1.05, scaleY: 1.05, duration: 140 });
        });
        this.shopButton.on('pointerout', () => {
            this.tweens.add({ targets: this.shopButton, scaleX: 1, scaleY: 1, duration: 140 });
        });
        const shopButtonClick = () => {
            console.log('Shop button clicked!');
            if (window.soundManager) window.soundManager.playClick();
            // Shop button should work even when game is over
            // Close start screen if it's open (but don't start the game)
            if (this.startScreen) {
                const children = this.startScreen.getData('children') || [];
                children.forEach(child => {
                    if (child && child.active) {
                        child.destroy();
                    }
                });
                this.startScreen.destroy();
                this.startScreen = null;
            }
            // Close shop if already open, otherwise open it
            if (this.shopOverlay) {
                this.closeShop();
            } else {
                this.showShop();
            }
        };

        this.shopButton.on('pointerdown', shopButtonClick);
        this.shopLabel.setInteractive({ useHandCursor: true, pixelPerfect: false })
            .on('pointerover', () => this.shopButton.emit('pointerover'))
            .on('pointerout', () => this.shopButton.emit('pointerout'))
            .on('pointerdown', shopButtonClick);

        // Target indicator - shows which color to aim for (exact color match, no glow)
        this.targetIndicator = this.add.circle(centerX, centerY - 200, 35, this.colors[this.targetColorIndex]);
        this.targetIndicator.setStrokeStyle(5, 0xffb6c1, 0.9);
        // Glow disabled - using exact color match instead
        this.targetIndicatorGlow = this.add.circle(centerX, centerY - 200, 40, this.colors[this.targetColorIndex], 0.2);
        // Use normal blend mode instead of ADD to prevent brightness increase
        this.targetIndicatorGlow.setBlendMode(Phaser.BlendModes.NORMAL);
        // Initialize lastTargetColorIndex to match current target
        this.lastTargetColorIndex = this.targetColorIndex;

        // Target text
        this.targetText = this.add.text(centerX, centerY - 260, 'Target:', {
            fontSize: '22px',
            fill: '#ffb6c1',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setShadow(0, 0, '#ffb6c1', 15, true, true);

        // Instructions (hidden initially, shown after start)
        this.instructionText = this.add.text(centerX, centerY + 250, 'Tap when the white ball crosses the target color!', {
            fontSize: '20px',
            fill: '#d4a8ff',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setShadow(0, 0, '#d4a8ff', 12, true, true).setVisible(false);

        // Game over text (hidden initially)
        this.gameOverText = this.add.text(centerX, centerY, '', {
            fontSize: '48px',
            fill: '#ff0000',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setVisible(false);

        // Input
        this.input.on('pointerdown', (pointer, gameObjects) => {
            // Don't handle tap if clicking on UI elements (shop button, start button, etc.)
            const x = pointer.x;
            const y = pointer.y;

            // Check if clicked on shop button area (manual bounds check)
            const shopX = this.cameras.main.width - 140;
            const shopY = 32;
            if (x >= shopX - 50 && x <= shopX + 50 && y >= shopY - 17.5 && y <= shopY + 17.5) {
                return; // Let shop button handler deal with it
            }

            // Don't handle tap if clicking on interactive game objects
            if (gameObjects && gameObjects.length > 0) {
                // Check if clicked on shop button, shop label, or other UI
                const clickedOnUI = gameObjects.some(obj =>
                    obj === this.shopButton || obj === this.shopLabel ||
                    (obj.type && (obj.type === 'Text' || obj.type === 'Rectangle'))
                );
                if (clickedOnUI) return;
            }

            // Don't handle tap if start screen is visible or game is over
            if (this.startScreen || this.gameOver || !this.gameStarted) return;
            this.handleTap();
        });

        // Music toggle button
        const height = this.cameras.main.height;
        const musicButtonX = width - 30;
        const musicButtonY = height - 30;
        this.musicButton = this.add.rectangle(musicButtonX, musicButtonY, 50, 50, 0x000000, 0.5)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff, 0.8)
            .setInteractive({ useHandCursor: true })
            .setDepth(100);
        this.musicIcon = this.add.text(musicButtonX, musicButtonY, window.soundManager && window.soundManager.musicEnabled ? '🎵' : '🔇', {
            fontSize: '24px',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setDepth(101);
        this.musicButton.on('pointerdown', () => {
            if (window.soundManager) {
                window.soundManager.resumeContext();
                window.soundManager.playClick();
                const enabled = window.soundManager.toggleMusic();
                this.musicIcon.setText(enabled ? '🎵' : '🔇');
            }
        });

        // Add enhanced glow effects and animations
        this.tweens.add({
            targets: this.ball,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Target indicator - no animation (static display)

        // Particle pool for effects
        this.particlePool = [];

        // Start background music if enabled (after a short delay to ensure audio context is ready)
        if (window.soundManager && window.soundManager.musicEnabled) {
            this.time.delayedCall(500, () => {
                if (window.soundManager && window.soundManager.musicEnabled) {
                    window.soundManager.startBackgroundMusic();
                }
            });
        }

        // Create start screen
        this.createStartScreen();
    }

    createStartScreen() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Start screen overlay
        this.startScreen = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.6)
            .setDepth(20);

        // Start button (star) - placed at the bottom
        const buttonY = height - 80; // Position near bottom of screen
        const startButton = this.add.rectangle(centerX, buttonY, 120, 60, 0x4d2b6f, 0.95)
            .setDepth(21)
            .setStrokeStyle(3, 0xffd700, 0.9)
            .setInteractive({ useHandCursor: true });

        const startButtonText = this.add.text(centerX, buttonY, '⭐ Start', {
            fontSize: '28px',
            fill: '#ffd700',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(22).setShadow(0, 0, '#ffd700', 12, true, true);

        // Hover effects
        startButton.on('pointerover', () => {
            this.tweens.add({ targets: startButton, scaleX: 1.1, scaleY: 1.1, duration: 150 });
            this.tweens.add({ targets: startButtonText, scaleX: 1.1, scaleY: 1.1, duration: 150 });
        });
        startButton.on('pointerout', () => {
            this.tweens.add({ targets: startButton, scaleX: 1, scaleY: 1, duration: 150 });
            this.tweens.add({ targets: startButtonText, scaleX: 1, scaleY: 1, duration: 150 });
        });

        // Start game handler
        const startGame = (pointer) => {
            if (window.soundManager) {
                window.soundManager.resumeContext();
                window.soundManager.playClick();
            }
            this.gameStarted = true;
            if (this.startScreen) {
                this.startScreen.destroy();
            }
            if (startButton && startButton.active) {
                startButton.destroy();
            }
            if (startButtonText && startButtonText.active) {
                startButtonText.destroy();
            }
            this.startScreen = null;
            // Show instruction text
            this.instructionText.setVisible(true);
            this.instructionText.setText('Tap when the white ball crosses the target color!');
        };

        startButton.on('pointerdown', startGame);
        startButtonText.setInteractive({ useHandCursor: true }).on('pointerdown', startGame);

        // Store children for cleanup
        this.startScreen.setData('children', [startButton, startButtonText]);
    }

    update() {
        if (this.gameOver || !this.gameStarted) return;

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        const radius = 150;

        // Rotate ball continuously
        this.ballAngle += this.ballSpeed;

        // Normalize angle to 0-2π range
        let normalizedAngle = this.ballAngle % (Math.PI * 2);
        if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

        // Update ball position
        const x = centerX + Math.cos(this.ballAngle) * radius;
        const y = centerY + Math.sin(this.ballAngle) * radius;
        this.ball.setPosition(x, y);

        // Update ball shadow position to match
        if (this.ballShadow) {
            this.ballShadow.setPosition(x, y);
        }

        // Determine which colored section the ball is currently over
        // Arcs start from -π/2 (top), so we need to adjust
        // Convert ball angle to match arc coordinate system
        let arcAngle = (normalizedAngle + Math.PI / 2) % (Math.PI * 2);
        // Handle edge case where arcAngle might be exactly Math.PI * 2
        if (arcAngle >= Math.PI * 2 - 0.0001) arcAngle = 0;

        // Calculate which section (0-3): Red, Green, Blue, Yellow
        // Section 0: -π/2 to 0 (top-right to right)
        // Section 1: 0 to π/2 (right to bottom-right)
        // Section 2: π/2 to π (bottom-right to bottom-left)
        // Section 3: π to 3π/2 (bottom-left to top-left)
        const sectionIndex = Math.floor(arcAngle / (Math.PI / 2));
        this.currentColorIndex = Math.max(0, Math.min(3, sectionIndex));

        // Keep ball color constant (white) - it should contrast with the rings
        // Don't change ball color, keep it white so it stands out
        this.ball.setFillStyle(this.ballColor);

        // Add subtle pulsing glow effect
        this.ball.setAlpha(0.95 + Math.sin(this.ballAngle * 4) * 0.05);

        // Update target indicator (no animation - static display)
        // Always ensure it uses the correct color from current palette
        if (this.targetIndicator && this.targetIndicator.active) {
            // Ensure targetColorIndex is valid for current colors array
            const validTargetIndex = Math.max(0, Math.min(3, this.targetColorIndex));
            if (validTargetIndex !== this.targetColorIndex) {
                this.targetColorIndex = validTargetIndex;
            }

            // Always get color from current colors array to ensure it matches palette
            const currentTargetColor = this.colors[this.targetColorIndex];

            // Update color if target changed
            if (this.targetColorIndex !== this.lastTargetColorIndex) {
                if (currentTargetColor !== undefined && currentTargetColor !== null) {
                    this.targetIndicator.setFillStyle(currentTargetColor);
                    if (this.targetIndicatorGlow && this.targetIndicatorGlow.active) {
                        this.targetIndicatorGlow.setFillStyle(currentTargetColor);
                    }
                }
                this.lastTargetColorIndex = this.targetColorIndex;
            }

            // Always ensure color matches current palette (in case palette was changed)
            // Update every frame to catch any palette changes
            if (currentTargetColor !== undefined && currentTargetColor !== null) {
                this.targetIndicator.setFillStyle(currentTargetColor);
                if (this.targetIndicatorGlow && this.targetIndicatorGlow.active) {
                    this.targetIndicatorGlow.setFillStyle(currentTargetColor);
                }
            }

            // Keep target indicator at constant alpha (no pulsing)
            this.targetIndicator.setAlpha(1.0);
            // Reduce glow alpha to prevent brightness effect
            if (this.targetIndicatorGlow && this.targetIndicatorGlow.active) {
                this.targetIndicatorGlow.setAlpha(0.1);
            }
        }

        // Update combo display visibility (fade out after 2 seconds of inactivity)
        const currentTime = this.time.now;
        if (this.combo > 0 && currentTime - this.lastSuccessTime > 2000) {
            this.combo = 0;
            this.comboMultiplier = 1;
            this.comboText.setVisible(false);
            this.multiplierText.setVisible(false);
        }
    }

    handleTap() {
        if (this.gameOver || !this.gameStarted) return;

        // Calculate which arc section the ball is currently over (use EXACT same calculation as update())
        // This ensures consistency between visual display and tap detection
        let normalizedAngle = this.ballAngle % (Math.PI * 2);
        if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

        // Convert to arc coordinate system (shift by π/2 so -π/2 becomes 0)
        // Use EXACT same edge case handling as update() function
        let arcAngle = (normalizedAngle + Math.PI / 2) % (Math.PI * 2);
        // Handle edge case where arcAngle might be exactly Math.PI * 2 (same as update())
        if (arcAngle >= Math.PI * 2 - 0.0001) arcAngle = 0;

        // Calculate section: each section is π/2 radians wide (same as update())
        const sectionIndex = Math.floor(arcAngle / (Math.PI / 2));
        // Ensure sectionIndex is between 0 and 3 (same as update())
        const currentArcSection = Math.max(0, Math.min(3, sectionIndex));

        // For debugging: log the calculation if target is Pure Blue (index 1)
        // if (this.targetColorIndex === 1) {
        //     console.log('Ball angle:', this.ballAngle, 'Normalized:', normalizedAngle, 'ArcAngle:', arcAngle, 'Section:', currentArcSection, 'Target:', this.targetColorIndex);
        // }

        // Check if the ball is over the target color section
        if (currentArcSection === this.targetColorIndex) {
            // Success! Ball is over the target color section
            if (window.soundManager) window.soundManager.playSuccess();

            // Update combo system
            const currentTime = this.time.now;
            if (currentTime - this.lastSuccessTime < 2000 && this.lastSuccessTime > 0) {
                // Combo continues - increase multiplier
                this.combo++;
                this.comboMultiplier = Math.min(1 + Math.floor(this.combo / 3), 5); // Max 5x multiplier
            } else {
                // New combo starts
                this.combo = 1;
                this.comboMultiplier = 1;
            }
            this.lastSuccessTime = currentTime;
            this.maxCombo = Math.max(this.maxCombo, this.combo);

            // Update score with multiplier
            const pointsEarned = 100 * this.comboMultiplier;
            this.score += pointsEarned;
            this.scoreText.setText('Score: ' + this.score);

            // Update coins (1 point = 0.5 coin)
            const coinsEarned = Math.floor(pointsEarned * 0.5); // 1 point = 0.5 coin
            this.coinsEarnedThisGame += coinsEarned;
            this.totalCoins += coinsEarned;
            this.saveCoins(this.totalCoins);
            this.updateCoinCounter();

            // Update combo display
            if (this.combo > 1) {
                this.comboText.setText('COMBO x' + this.combo + '!');
                this.comboText.setVisible(true);
                this.multiplierText.setText('×' + this.comboMultiplier + ' Multiplier');
                this.multiplierText.setVisible(true);

                // Animate combo text
                this.tweens.add({
                    targets: [this.comboText, this.multiplierText],
                    scaleX: 1.3,
                    scaleY: 1.3,
                    duration: 200,
                    yoyo: true,
                    ease: 'Back.easeOut'
                });
            } else {
                this.comboText.setVisible(false);
                this.multiplierText.setVisible(false);
            }

            // Increase speed based on score: +0.01 speed for every 500 points
            const currentMilestone = Math.floor(this.score / 500);
            const speedIncrease = (currentMilestone - this.lastSpeedMilestone) * 0.01;
            if (speedIncrease > 0) {
                this.ballSpeed += speedIncrease;
                this.lastSpeedMilestone = currentMilestone;
            }

            // Limit max speed for playability
            if (this.ballSpeed > 0.09) {
                this.ballSpeed = 0.09;
            }

            // Change target to a random different color for next round
            // Only change target AFTER successful tap
            const oldTarget = this.targetColorIndex;
            let newTarget;
            let attempts = 0;
            do {
                newTarget = Phaser.Math.Between(0, 3);
                attempts++;
                // Safety: avoid infinite loop
                if (attempts > 10) break;
            } while (newTarget === oldTarget && this.score > 100); // Ensure it's different after first few rounds

            // Update target color index (ONLY place target should change)
            // Ensure newTarget is valid
            const validNewTarget = Math.max(0, Math.min(3, newTarget));
            this.targetColorIndex = validNewTarget;
            this.lastTargetColorIndex = validNewTarget; // Mark that target has changed

            // Always get color from current colors array to ensure it matches palette
            const newTargetColor = this.colors[this.targetColorIndex];

            // Update target indicator with new color (must be from current palette)
            if (this.targetIndicator && newTargetColor !== undefined && newTargetColor !== null) {
                this.targetIndicator.setFillStyle(newTargetColor);
            }
            if (this.targetIndicatorGlow && newTargetColor !== undefined && newTargetColor !== null) {
                this.targetIndicatorGlow.setFillStyle(newTargetColor);
            }

            // Enhanced success effects
            this.tweens.add({
                targets: [this.ball, this.ballShadow],
                scaleX: 2.0,
                scaleY: 2.0,
                duration: 150,
                yoyo: true,
                ease: 'Back.easeOut'
            });

            this.tweens.add({
                targets: [this.targetIndicator, this.targetIndicatorGlow],
                scaleX: 1.6,
                scaleY: 1.6,
                duration: 250,
                yoyo: true,
                ease: 'Back.easeOut'
            });

            // Enhanced flash effect with combo color
            const flashColor = this.combo > 3 ? 0xffff00 : 0x00ff00; // Yellow for high combo, green otherwise
            const r = (flashColor >> 16) & 0xff;
            const g = (flashColor >> 8) & 0xff;
            const b = flashColor & 0xff;
            this.cameras.main.flash(150, r, g, b);

            // Enhanced particle burst effect
            const particleCount = 8 + Math.min(this.combo, 8);
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const particle = this.add.circle(
                    this.ball.x,
                    this.ball.y,
                    6 + Math.random() * 3,
                    this.colors[this.targetColorIndex]
                );
                particle.setBlendMode(Phaser.BlendModes.ADD);
                const distance = 60 + Math.random() * 40;
                this.tweens.add({
                    targets: particle,
                    x: this.ball.x + Math.cos(angle) * distance,
                    y: this.ball.y + Math.sin(angle) * distance,
                    alpha: 0,
                    scale: 0,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => particle.destroy()
                });
            }

            // Score popup animation
            const scorePopup = this.add.text(this.ball.x, this.ball.y - 30, '+' + pointsEarned, {
                fontSize: '28px',
                fill: '#ffff00',
                fontFamily: 'Arial',
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            this.tweens.add({
                targets: scorePopup,
                y: scorePopup.y - 50,
                alpha: 0,
                scale: 1.5,
                duration: 600,
                ease: 'Power2',
                onComplete: () => scorePopup.destroy()
            });

            // Coin popup animation
            const coinPopup = this.add.text(this.ball.x, this.ball.y - 10, '🪙 +' + coinsEarned, {
                fontSize: '24px',
                fill: '#ffff33',
                fontFamily: 'Arial',
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            this.tweens.add({
                targets: coinPopup,
                y: coinPopup.y - 40,
                alpha: 0,
                scale: 1.3,
                duration: 600,
                ease: 'Power2',
                onComplete: () => coinPopup.destroy()
            });
        } else {
            // Game over - ball is not over the target color section
            if (window.soundManager) window.soundManager.playFail();

            // Reset combo on miss
            this.combo = 0;
            this.comboMultiplier = 1;
            this.comboText.setVisible(false);
            this.multiplierText.setVisible(false);

            this.endGame();
        }
    }

    endGame() {
        if (this.gameOver) return; // Prevent multiple calls
        this.gameOver = true;
        if (window.soundManager) window.soundManager.playGameOver();

        // Enhanced game over display with combo info
        let gameOverMessage = 'Game Over!\nFinal Score: ' + this.score;
        if (this.coinsEarnedThisGame > 0) {
            gameOverMessage += '\n🪙 Coins Earned: ' + this.coinsEarnedThisGame;
        }
        if (this.maxCombo > 1) {
            gameOverMessage += '\nMax Combo: x' + this.maxCombo;
        }
        this.gameOverText.setText(gameOverMessage);
        this.gameOverText.setVisible(true);

        // Animate game over text
        this.tweens.add({
            targets: this.gameOverText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            yoyo: true,
            repeat: 1,
            ease: 'Back.easeOut'
        });

        this.instructionText.setText('Game Over');

        // Remove input handler
        this.input.off('pointerdown');

        // Create start button to play again
        const centerX = this.cameras.main.width / 2;
        const height = this.cameras.main.height;
        const buttonY = height - 80;

        const startButton = this.add.rectangle(centerX, buttonY, 120, 60, 0x4d2b6f, 0.95)
            .setDepth(100)
            .setStrokeStyle(3, 0xffd700, 0.9)
            .setInteractive({ useHandCursor: true });

        const startButtonText = this.add.text(centerX, buttonY, '⭐ Start', {
            fontSize: '28px',
            fill: '#ffd700',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(101).setShadow(0, 0, '#ffd700', 12, true, true);

        // Hover effects
        startButton.on('pointerover', () => {
            this.tweens.add({ targets: startButton, scaleX: 1.1, scaleY: 1.1, duration: 150 });
            this.tweens.add({ targets: startButtonText, scaleX: 1.1, scaleY: 1.1, duration: 150 });
        });
        startButton.on('pointerout', () => {
            this.tweens.add({ targets: startButton, scaleX: 1, scaleY: 1, duration: 150 });
            this.tweens.add({ targets: startButtonText, scaleX: 1, scaleY: 1, duration: 150 });
        });

        // Start new game handler
        const startNewGame = () => {
            if (window.soundManager) {
                window.soundManager.resumeContext();
                window.soundManager.playClick();
            }
            // Restart the scene to start a new game
            this.scene.restart();
        };

        startButton.on('pointerdown', startNewGame);
        startButtonText.setInteractive({ useHandCursor: true }).on('pointerdown', startNewGame);
    }

    // Coin management
    loadCoins() {
        const saved = localStorage.getItem('colorLoopCoins');
        return saved ? parseInt(saved, 10) : 0;
    }

    saveCoins(coins) {
        localStorage.setItem('colorLoopCoins', coins.toString());
    }

    updateCoinCounter() {
        // Ensure totalCoins is loaded
        if (typeof this.totalCoins === 'undefined' || this.totalCoins === null) {
            this.totalCoins = this.loadCoins();
        }

        // Update coin counter displays
        if (this.coinText) {
            this.coinText.setText('🪙 ' + this.totalCoins);
        }
        if (this.coinTextTopRight) {
            this.coinTextTopRight.setText('🪙 ' + this.totalCoins);
        }
    }

    // Shop management
    initializeItems() {
        return {
            ballSkins: {
                'default': { id: 'default', name: 'White Ball', icon: '⚪', color: 0xffffff, strokeColor: 0x000000, price: 0, owned: true },
                'gold': { id: 'gold', name: 'Gold Ball', icon: '🟡', color: 0xffd700, strokeColor: 0x000000, price: 500, owned: this.isItemOwned('ball_gold') },
                'neon': { id: 'neon', name: 'Neon Ball', icon: '💚', color: 0x00ff00, strokeColor: 0x00ff00, price: 750, owned: this.isItemOwned('ball_neon') },
                'fire': { id: 'fire', name: 'Fire Ball', icon: '🔥', color: 0xff4500, strokeColor: 0xff0000, price: 1000, owned: this.isItemOwned('ball_fire') },
                'ice': { id: 'ice', name: 'Ice Ball', icon: '❄️', color: 0x00ffff, strokeColor: 0x00bfff, price: 1000, owned: this.isItemOwned('ball_ice') }
            },
            ringThemes: {
                'default': { id: 'default', name: 'Classic', icon: '🌈', colors: [0xff3366, 0x33ff66, 0x3366ff, 0xffff33], price: 0, owned: true },
                'pastel': { id: 'pastel', name: 'Pastel', icon: '🎨', colors: [0xffb3d9, 0xb3ffd9, 0xb3d9ff, 0xffffb3], price: 750, owned: this.isItemOwned('ring_pastel') },
                'neon': { id: 'neon', name: 'Neon', icon: '💡', colors: [0xff00ff, 0x00ff00, 0xffff00, 0xff0080], price: 1000, owned: this.isItemOwned('ring_neon') },
                'sunset': { id: 'sunset', name: 'Sunset', icon: '🌅', colors: [0xff6b6b, 0xffa500, 0xff4500, 0xff1493], price: 1000, owned: this.isItemOwned('ring_sunset') },
                'ocean': { id: 'ocean', name: 'Ocean', icon: '🌊', colors: [0x00ffff, 0x0000ff, 0x00ffaa, 0x0080cc], price: 1000, owned: this.isItemOwned('ring_ocean') }
            },
            backgrounds: {
                'default': { id: 'default', name: 'Dark Blue', icon: '🌙', color: '#1a1a3e', price: 0, owned: true },
                'purple': { id: 'purple', name: 'Purple Night', icon: '🟣', color: '#2d1b4e', price: 500, owned: this.isItemOwned('bg_purple') },
                'black': { id: 'black', name: 'Pure Black', icon: '⬛', color: '#000000', price: 500, owned: this.isItemOwned('bg_black') },
                'space': { id: 'space', name: 'Space', icon: '🌌', color: '#0a1229', price: 750, owned: this.isItemOwned('bg_space') },
                'green': { id: 'green', name: 'Forest', icon: '🌲', color: '#1a2e1a', price: 750, owned: this.isItemOwned('bg_green') }
            }
        };
    }

    loadSelectedBallSkin() {
        const saved = localStorage.getItem('colorLoopSelectedBallSkin');
        return saved || 'default';
    }

    saveSelectedBallSkin(skinId) {
        localStorage.setItem('colorLoopSelectedBallSkin', skinId);
    }

    loadSelectedRingTheme() {
        const saved = localStorage.getItem('colorLoopSelectedRingTheme');
        return saved || 'default';
    }

    saveSelectedRingTheme(themeId) {
        localStorage.setItem('colorLoopSelectedRingTheme', themeId);
    }

    loadSelectedBackground() {
        const saved = localStorage.getItem('colorLoopSelectedBackground');
        return saved || 'default';
    }

    saveSelectedBackground(bgId) {
        localStorage.setItem('colorLoopSelectedBackground', bgId);
    }

    isItemOwned(itemId) {
        const owned = localStorage.getItem('colorLoopOwnedItems');
        if (!owned) return false;
        const ownedList = JSON.parse(owned);
        return ownedList.includes(itemId);
    }

    unlockItem(itemId) {
        const owned = localStorage.getItem('colorLoopOwnedItems');
        let ownedList = owned ? JSON.parse(owned) : [];
        if (!ownedList.includes(itemId)) {
            ownedList.push(itemId);
            localStorage.setItem('colorLoopOwnedItems', JSON.stringify(ownedList));
        }
    }

    showShop() {
        if (this.shopOverlay) return; // Don't open if already open

        // Close start screen if open
        if (this.startScreen) {
            const children = this.startScreen.getData('children') || [];
            children.forEach(child => {
                if (child && child.active) {
                    child.destroy();
                }
            });
            this.startScreen.destroy();
            this.startScreen = null;
        }

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Overlay
        this.shopOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setDepth(30)
            .setInteractive();

        // Shop panel
        const panelWidth = width * 0.8;
        const panelHeight = height * 0.8;
        this.shopPanel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x1a1a3e, 0.95)
            .setDepth(31)
            .setStrokeStyle(3, 0xffb6c1, 0.9);

        // Title
        const titleText = this.add.text(width / 2, height / 2 - panelHeight / 2 + 40, '🛍️ Color Loop Shop', {
            fontSize: '36px',
            fill: '#ffb6c1',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(32).setShadow(0, 0, '#ffb6c1', 15, true, true);

        // Coins display
        const coinDisplay = this.add.text(width / 2, height / 2 - panelHeight / 2 + 80, `🪙 Coins: ${this.totalCoins}`, {
            fontSize: '24px',
            fill: '#ffff33',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(32);
        this.shopPanel.setData('coinDisplay', coinDisplay);

        // Reset coins button
        const resetCoinsButton = this.add.rectangle(width / 2 + 180, height / 2 - panelHeight / 2 + 80, 100, 35, 0xff0000, 0.9)
            .setDepth(32)
            .setStrokeStyle(2, 0xff6666, 0.9)
            .setInteractive({ useHandCursor: true });
        const resetCoinsText = this.add.text(width / 2 + 180, height / 2 - panelHeight / 2 + 80, 'Reset Coins', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(33);

        resetCoinsButton.on('pointerover', () => {
            this.tweens.add({ targets: resetCoinsButton, scaleX: 1.05, scaleY: 1.05, duration: 150 });
        });
        resetCoinsButton.on('pointerout', () => {
            this.tweens.add({ targets: resetCoinsButton, scaleX: 1, scaleY: 1, duration: 150 });
        });

        resetCoinsButton.on('pointerdown', () => {
            if (window.soundManager) window.soundManager.playClick();
            this.totalCoins = 0;
            this.saveCoins(0);
            this.updateCoinCounter();
            coinDisplay.setText(`🪙 Coins: 0`);
            if (window.soundManager) window.soundManager.playMatch();
        });
        resetCoinsText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            if (window.soundManager) window.soundManager.playClick();
            this.totalCoins = 0;
            this.saveCoins(0);
            this.updateCoinCounter();
            coinDisplay.setText(`🪙 Coins: 0`);
            if (window.soundManager) window.soundManager.playMatch();
        });

        // Store all shop children for cleanup
        const shopChildren = [titleText, coinDisplay, resetCoinsButton, resetCoinsText];

        // Tab buttons
        const tabY = height / 2 - panelHeight / 2 + 130;
        const tabWidth = panelWidth / 3;
        const tabHeight = 40;
        const tabSpacing = 10;

        // Create slide containers
        const ballSkinsSlide = { visible: true, children: [] };
        const ringThemesSlide = { visible: false, children: [] };
        const backgroundsSlide = { visible: false, children: [] };

        const slides = {
            'ballSkins': ballSkinsSlide,
            'ringThemes': ringThemesSlide,
            'backgrounds': backgroundsSlide
        };
        this.shopPanel.setData('slides', slides);

        // Ball Skins tab
        const ballTabBg = this.add.rectangle(width / 2 - tabWidth, tabY, tabWidth - tabSpacing, tabHeight,
            this.currentShopTab === 'ballSkins' ? 0x4d2b6f : 0x2d1b4e, 0.9)
            .setDepth(32)
            .setStrokeStyle(2, this.currentShopTab === 'ballSkins' ? 0xffb6c1 : 0xd4a8ff, 0.8)
            .setInteractive({ useHandCursor: true });
        const ballTabText = this.add.text(width / 2 - tabWidth, tabY, '⚪ Balls', {
            fontSize: '16px',
            fill: '#d9f7ff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(33);

        // Ring Themes tab
        const ringTabBg = this.add.rectangle(width / 2, tabY, tabWidth - tabSpacing, tabHeight,
            this.currentShopTab === 'ringThemes' ? 0x4d2b6f : 0x2d1b4e, 0.9)
            .setDepth(32)
            .setStrokeStyle(2, this.currentShopTab === 'ringThemes' ? 0xffb6c1 : 0xd4a8ff, 0.8)
            .setInteractive({ useHandCursor: true });
        const ringTabText = this.add.text(width / 2, tabY, '🌈 Rings', {
            fontSize: '16px',
            fill: '#d9f7ff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(33);

        // Backgrounds tab
        const bgTabBg = this.add.rectangle(width / 2 + tabWidth, tabY, tabWidth - tabSpacing, tabHeight,
            this.currentShopTab === 'backgrounds' ? 0x4d2b6f : 0x2d1b4e, 0.9)
            .setDepth(32)
            .setStrokeStyle(2, this.currentShopTab === 'backgrounds' ? 0xffb6c1 : 0xd4a8ff, 0.8)
            .setInteractive({ useHandCursor: true });
        const bgTabText = this.add.text(width / 2 + tabWidth, tabY, '🎨 BGs', {
            fontSize: '16px',
            fill: '#d9f7ff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(33);

        // Tab switching function
        const switchTab = (tabName) => {
            if (window.soundManager) window.soundManager.playClick();
            this.currentShopTab = tabName;

            // Update tab visuals
            const tabs = [
                { bg: ballTabBg, text: ballTabText, name: 'ballSkins' },
                { bg: ringTabBg, text: ringTabText, name: 'ringThemes' },
                { bg: bgTabBg, text: bgTabText, name: 'backgrounds' }
            ];

            tabs.forEach(tab => {
                if (tab.name === tabName) {
                    tab.bg.setFillStyle(0x4d2b6f, 0.9);
                    tab.bg.setStrokeStyle(2, 0xffb6c1, 0.8);
                } else {
                    tab.bg.setFillStyle(0x2d1b4e, 0.9);
                    tab.bg.setStrokeStyle(2, 0xd4a8ff, 0.8);
                }
            });

            // Show/hide slides
            Object.keys(slides).forEach(slideName => {
                const slide = slides[slideName];
                slide.visible = (slideName === tabName);
                slide.children.forEach(child => {
                    if (child && child.active) {
                        child.setVisible(slide.visible);
                    }
                });
            });
        };

        ballTabBg.on('pointerdown', () => switchTab('ballSkins'));
        ballTabText.setInteractive({ useHandCursor: true }).on('pointerdown', () => switchTab('ballSkins'));
        ringTabBg.on('pointerdown', () => switchTab('ringThemes'));
        ringTabText.setInteractive({ useHandCursor: true }).on('pointerdown', () => switchTab('ringThemes'));
        bgTabBg.on('pointerdown', () => switchTab('backgrounds'));
        bgTabText.setInteractive({ useHandCursor: true }).on('pointerdown', () => switchTab('backgrounds'));

        shopChildren.push(ballTabBg, ballTabText, ringTabBg, ringTabText, bgTabBg, bgTabText);

        // Item categories
        let yOffset = height / 2 - panelHeight / 2 + 180;
        const itemSpacing = 60;
        const itemsPerRow = 2;

        // Ball Skins section
        const ballTitle = this.add.text(width / 2, yOffset, '⚪ Ball Skins', {
            fontSize: '24px',
            fill: '#d4a8ff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(32).setVisible(ballSkinsSlide.visible);
        ballSkinsSlide.children.push(ballTitle);
        shopChildren.push(ballTitle);
        yOffset += 40;

        const ballSkins = Object.keys(this.items.ballSkins);
        ballSkins.forEach((skinId, index) => {
            const skin = this.items.ballSkins[skinId];
            const x = width / 2 - 100 + (index % itemsPerRow) * 200;
            const y = yOffset + Math.floor(index / itemsPerRow) * itemSpacing;

            const cardBg = this.add.rectangle(x, y, 180, 50,
                this.selectedBallSkin === skinId ? 0x4d2b6f : 0x2d1b4e, 0.9)
                .setDepth(32)
                .setStrokeStyle(2, this.selectedBallSkin === skinId ? 0xffb6c1 : 0xd4a8ff, 0.8)
                .setInteractive({ useHandCursor: true });

            const itemDisplay = this.add.text(x - 60, y, `${skin.icon} ${skin.name}`, {
                fontSize: '16px',
                fill: '#d9f7ff',
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0, 0.5).setDepth(33);

            let statusText = '';
            let statusColor = '#8ad8ff';
            if (skin.owned) {
                statusText = this.selectedBallSkin === skinId ? '✓ Selected' : '✓ Owned';
                statusColor = '#7dff5d';
            } else {
                statusText = `🪙 ${skin.price}`;
                statusColor = '#ffd700';
            }

            const status = this.add.text(x + 70, y, statusText, {
                fontSize: '14px',
                fill: statusColor,
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0.5).setDepth(33);

            const handleClick = () => {
                if (window.soundManager) window.soundManager.playClick();

                if (skin.owned) {
                    this.selectedBallSkin = skinId;
                    this.saveSelectedBallSkin(skinId);
                    this.closeShop();
                    this.scene.restart();
                } else if (this.totalCoins >= skin.price) {
                    this.totalCoins -= skin.price;
                    this.saveCoins(this.totalCoins);
                    this.unlockItem('ball_' + skinId);
                    skin.owned = true;
                    status.setText('✓ Owned');
                    status.setFill('#7dff5d');
                    this.updateCoinCounter();
                    const coinDisplay = this.shopPanel.getData('coinDisplay');
                    if (coinDisplay) {
                        coinDisplay.setText(`🪙 Coins: ${this.totalCoins}`);
                    }
                    if (window.soundManager) window.soundManager.playMatch();
                } else {
                    if (window.soundManager) window.soundManager.playMiss();
                    const errorText = this.add.text(x, y + 30, 'Not enough coins!', {
                        fontSize: '14px',
                        fill: '#ff477e',
                        fontFamily: 'Arial',
                        fontWeight: 'bold'
                    }).setOrigin(0.5).setDepth(34);
                    this.tweens.add({
                        targets: errorText,
                        alpha: 0,
                        y: errorText.y - 20,
                        duration: 1000,
                        onComplete: () => errorText.destroy()
                    });
                }
            };

            cardBg.setVisible(ballSkinsSlide.visible);
            itemDisplay.setVisible(ballSkinsSlide.visible);
            status.setVisible(ballSkinsSlide.visible);

            cardBg.on('pointerdown', handleClick);
            itemDisplay.setInteractive({ useHandCursor: true }).on('pointerdown', handleClick);
            status.setInteractive({ useHandCursor: true }).on('pointerdown', handleClick);

            ballSkinsSlide.children.push(cardBg, itemDisplay, status);
            shopChildren.push(cardBg, itemDisplay, status);
        });

        // Ring Themes section (separate slide)
        let ringYOffset = height / 2 - panelHeight / 2 + 180;
        const ringTitle = this.add.text(width / 2, ringYOffset, '🌈 Ring Themes', {
            fontSize: '24px',
            fill: '#d4a8ff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(32).setVisible(ringThemesSlide.visible);
        ringThemesSlide.children.push(ringTitle);
        shopChildren.push(ringTitle);
        ringYOffset += 40;

        const ringThemes = Object.keys(this.items.ringThemes);
        ringThemes.forEach((themeId, index) => {
            const theme = this.items.ringThemes[themeId];
            const x = width / 2 - 100 + (index % itemsPerRow) * 200;
            const y = ringYOffset + Math.floor(index / itemsPerRow) * itemSpacing;

            const cardBg = this.add.rectangle(x, y, 180, 50,
                this.selectedRingTheme === themeId ? 0x4d2b6f : 0x2d1b4e, 0.9)
                .setDepth(32)
                .setStrokeStyle(2, this.selectedRingTheme === themeId ? 0xffb6c1 : 0xd4a8ff, 0.8)
                .setInteractive({ useHandCursor: true });

            const itemDisplay = this.add.text(x - 60, y, `${theme.icon} ${theme.name}`, {
                fontSize: '16px',
                fill: '#d9f7ff',
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0, 0.5).setDepth(33);

            let statusText = '';
            let statusColor = '#8ad8ff';
            if (theme.owned) {
                statusText = this.selectedRingTheme === themeId ? '✓ Selected' : '✓ Owned';
                statusColor = '#7dff5d';
            } else {
                statusText = `🪙 ${theme.price}`;
                statusColor = '#ffd700';
            }

            const status = this.add.text(x + 70, y, statusText, {
                fontSize: '14px',
                fill: statusColor,
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0.5).setDepth(33);

            const handleClick = () => {
                if (window.soundManager) window.soundManager.playClick();

                if (theme.owned) {
                    this.selectedRingTheme = themeId;
                    this.saveSelectedRingTheme(themeId);
                    this.closeShop();
                    this.scene.restart();
                } else if (this.totalCoins >= theme.price) {
                    this.totalCoins -= theme.price;
                    this.saveCoins(this.totalCoins);
                    this.unlockItem('ring_' + themeId);
                    theme.owned = true;
                    status.setText('✓ Owned');
                    status.setFill('#7dff5d');
                    this.updateCoinCounter();
                    const coinDisplay = this.shopPanel.getData('coinDisplay');
                    if (coinDisplay) {
                        coinDisplay.setText(`🪙 Coins: ${this.totalCoins}`);
                    }
                    if (window.soundManager) window.soundManager.playMatch();
                } else {
                    if (window.soundManager) window.soundManager.playMiss();
                    const errorText = this.add.text(x, y + 30, 'Not enough coins!', {
                        fontSize: '14px',
                        fill: '#ff477e',
                        fontFamily: 'Arial',
                        fontWeight: 'bold'
                    }).setOrigin(0.5).setDepth(34);
                    this.tweens.add({
                        targets: errorText,
                        alpha: 0,
                        y: errorText.y - 20,
                        duration: 1000,
                        onComplete: () => errorText.destroy()
                    });
                }
            };

            cardBg.setVisible(ringThemesSlide.visible);
            itemDisplay.setVisible(ringThemesSlide.visible);
            status.setVisible(ringThemesSlide.visible);

            cardBg.on('pointerdown', handleClick);
            itemDisplay.setInteractive({ useHandCursor: true }).on('pointerdown', handleClick);
            status.setInteractive({ useHandCursor: true }).on('pointerdown', handleClick);

            ringThemesSlide.children.push(cardBg, itemDisplay, status);
            shopChildren.push(cardBg, itemDisplay, status);
        });

        // Backgrounds section (separate slide)
        let bgYOffset = height / 2 - panelHeight / 2 + 180;
        const bgTitle = this.add.text(width / 2, bgYOffset, '🎨 Backgrounds', {
            fontSize: '24px',
            fill: '#d4a8ff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(32).setVisible(backgroundsSlide.visible);
        backgroundsSlide.children.push(bgTitle);
        shopChildren.push(bgTitle);
        bgYOffset += 40;

        const backgrounds = Object.keys(this.items.backgrounds);
        backgrounds.forEach((bgId, index) => {
            const bg = this.items.backgrounds[bgId];
            const x = width / 2 - 100 + (index % itemsPerRow) * 200;
            const y = bgYOffset + Math.floor(index / itemsPerRow) * itemSpacing;

            const cardBg = this.add.rectangle(x, y, 180, 50,
                this.selectedBackground === bgId ? 0x4d2b6f : 0x2d1b4e, 0.9)
                .setDepth(32)
                .setStrokeStyle(2, this.selectedBackground === bgId ? 0xffb6c1 : 0xd4a8ff, 0.8)
                .setInteractive({ useHandCursor: true });

            const itemDisplay = this.add.text(x - 60, y, `${bg.icon} ${bg.name}`, {
                fontSize: '16px',
                fill: '#d9f7ff',
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0, 0.5).setDepth(33);

            let statusText = '';
            let statusColor = '#8ad8ff';
            if (bg.owned) {
                statusText = this.selectedBackground === bgId ? '✓ Selected' : '✓ Owned';
                statusColor = '#7dff5d';
            } else {
                statusText = `🪙 ${bg.price}`;
                statusColor = '#ffd700';
            }

            const status = this.add.text(x + 70, y, statusText, {
                fontSize: '14px',
                fill: statusColor,
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0.5).setDepth(33);

            const handleClick = () => {
                if (window.soundManager) window.soundManager.playClick();

                if (bg.owned) {
                    this.selectedBackground = bgId;
                    this.saveSelectedBackground(bgId);
                    this.closeShop();
                    this.scene.restart();
                } else if (this.totalCoins >= bg.price) {
                    this.totalCoins -= bg.price;
                    this.saveCoins(this.totalCoins);
                    this.unlockItem('bg_' + bgId);
                    bg.owned = true;
                    status.setText('✓ Owned');
                    status.setFill('#7dff5d');
                    this.updateCoinCounter();
                    const coinDisplay = this.shopPanel.getData('coinDisplay');
                    if (coinDisplay) {
                        coinDisplay.setText(`🪙 Coins: ${this.totalCoins}`);
                    }
                    if (window.soundManager) window.soundManager.playMatch();
                } else {
                    if (window.soundManager) window.soundManager.playMiss();
                    const errorText = this.add.text(x, y + 30, 'Not enough coins!', {
                        fontSize: '14px',
                        fill: '#ff477e',
                        fontFamily: 'Arial',
                        fontWeight: 'bold'
                    }).setOrigin(0.5).setDepth(34);
                    this.tweens.add({
                        targets: errorText,
                        alpha: 0,
                        y: errorText.y - 20,
                        duration: 1000,
                        onComplete: () => errorText.destroy()
                    });
                }
            };

            cardBg.setVisible(backgroundsSlide.visible);
            itemDisplay.setVisible(backgroundsSlide.visible);
            status.setVisible(backgroundsSlide.visible);

            cardBg.on('pointerdown', handleClick);
            itemDisplay.setInteractive({ useHandCursor: true }).on('pointerdown', handleClick);
            status.setInteractive({ useHandCursor: true }).on('pointerdown', handleClick);

            backgroundsSlide.children.push(cardBg, itemDisplay, status);
            shopChildren.push(cardBg, itemDisplay, status);
        });

        // Close button
        const closeButton = this.add.rectangle(width / 2 - 90, height / 2 + panelHeight / 2 - 40, 150, 50, 0x4d2b6f, 0.95)
            .setDepth(32)
            .setStrokeStyle(2, 0xffffff, 0.9)
            .setInteractive({ useHandCursor: true });
        const closeText = this.add.text(width / 2 - 90, height / 2 + panelHeight / 2 - 40, 'Close', {
            fontSize: '20px',
            fill: '#d9f7ff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(33);

        const closeShop = () => {
            if (window.soundManager) window.soundManager.playClick();
            this.closeShop();
        };

        closeButton.on('pointerdown', closeShop);
        closeText.setInteractive({ useHandCursor: true }).on('pointerdown', closeShop);
        this.shopOverlay.on('pointerdown', closeShop);

        // Restart Game button (resets everything)
        const restartGameButton = this.add.rectangle(width / 2 + 90, height / 2 + panelHeight / 2 - 40, 150, 50, 0xff0000, 0.95)
            .setDepth(32)
            .setStrokeStyle(2, 0xff6666, 0.9)
            .setInteractive({ useHandCursor: true });
        const restartGameText = this.add.text(width / 2 + 90, height / 2 + panelHeight / 2 - 40, '🔄 Restart Game', {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(33);

        restartGameButton.on('pointerover', () => {
            this.tweens.add({ targets: restartGameButton, scaleX: 1.05, scaleY: 1.05, duration: 150 });
        });
        restartGameButton.on('pointerout', () => {
            this.tweens.add({ targets: restartGameButton, scaleX: 1, scaleY: 1, duration: 150 });
        });

        const restartGame = () => {
            if (window.soundManager) window.soundManager.playClick();
            // Reset coins to 0
            this.totalCoins = 0;
            this.saveCoins(0);

            // Clear all purchased items
            localStorage.removeItem('colorLoopOwnedItems');

            // Reset all selected items to defaults
            localStorage.removeItem('colorLoopSelectedBallSkin');
            localStorage.removeItem('colorLoopSelectedRingTheme');
            localStorage.removeItem('colorLoopSelectedBackground');

            // Restart the scene to apply all changes
            this.scene.restart();
        };

        restartGameButton.on('pointerdown', restartGame);
        restartGameText.setInteractive({ useHandCursor: true }).on('pointerdown', restartGame);

        shopChildren.push(closeButton, closeText, restartGameButton, restartGameText);
        this.shopPanel.setData('children', shopChildren);
    }

    closeShop() {
        // Destroy all shop-related objects
        if (this.shopOverlay) {
            this.shopOverlay.destroy();
            this.shopOverlay = null;
        }
        if (this.shopPanel) {
            // Destroy all children of the shop panel
            const children = this.shopPanel.getData('children') || [];
            children.forEach(child => {
                if (child && child.active) {
                    child.destroy();
                }
            });
            this.shopPanel.destroy(true);
            this.shopPanel = null;
        }

        // Recreate start screen if game hasn't started yet
        if (!this.gameStarted && !this.startScreen) {
            this.createStartScreen();
        }
    }
}

// Explicitly assign to window
window.ColorLoopGame = ColorLoopGame;

