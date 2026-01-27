(function() {
    'use strict';

    // Get canvas and context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const gameOverEl = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');
    const restartBtn = document.getElementById('restartBtn');
    const highScoreEl = document.getElementById('highScore');
    const highScoreDisplayEl = document.getElementById('highScoreDisplay');
    const newRecordEl = document.getElementById('newRecord');
    const startScreenEl = document.getElementById('startScreen');
    const startBtn = document.getElementById('startBtn');
    const startHighScoreEl = document.getElementById('startHighScore');
    
    // Audio context for sound generation
    let audioContext = null;
    let backgroundMusicPlaying = false;
    let backgroundMusicOscillators = [];
    let lastMilestoneScore = 0;
    
    // Particle system for visual effects
    const particles = [];
    
    // Background animation particles
    const backgroundParticles = [];
    let backgroundAnimationTime = 0;
    
    // Haptic feedback support
    let hapticEnabled = false;
    if ('vibrate' in navigator) {
        hapticEnabled = true;
    }
    
    // Image assets
    const images = {
        hand: new Image(),
        monster1: new Image(),
        monster2: new Image(),
        monster3: new Image(),
        monster4: new Image()
    };
    
    // Image loading state
    let imagesLoaded = 0;
    const totalImages = Object.keys(images).length;
    
    // Load all images
    function loadImages() {
        return new Promise((resolve) => {
            let loaded = 0;
            
            images.hand.src = '/images/hand.png';
            images.monster1.src = '/images/moster1-removebg-preview.png';
            images.monster2.src = '/images/moster2-removebg-preview.png';
            images.monster3.src = '/images/moster3-removebg-preview.png';
            images.monster4.src = '/images/moster4-removebg-preview.png';
            
            function onImageLoad() {
                loaded++;
                if (loaded === totalImages) {
                    resolve();
                }
            }
            
            function onImageError() {
                console.warn('Image failed to load');
                loaded++;
                if (loaded === totalImages) {
                    resolve();
                }
            }
            
            Object.values(images).forEach(img => {
                if (img.complete) {
                    onImageLoad();
                } else {
                    img.onload = onImageLoad;
                    img.onerror = onImageError;
                }
            });
        });
    }

    // Set canvas size - larger and centered
    function resizeCanvas() {
        // Full screen canvas
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Game state
    let score = 0;
    let level = 1;
    let gameRunning = false;
    let animationId = null;
    let lastTime = 0;
    let scoreTimer = 0;
    let highScore = 0;
    
    // Load high score from localStorage
    function loadHighScore() {
        const saved = localStorage.getItem('mmmFingersHighScore');
        if (saved) {
            highScore = parseInt(saved, 10);
            if (highScoreEl) {
                highScoreEl.textContent = `Best: ${highScore}`;
            }
            if (highScoreDisplayEl) {
                highScoreDisplayEl.textContent = `Best Score: ${highScore}`;
            }
            if (startHighScoreEl) {
                startHighScoreEl.textContent = highScore;
            }
        }
    }
    
    // Save high score to localStorage
    function saveHighScore(newScore) {
        if (newScore > highScore) {
            highScore = newScore;
            localStorage.setItem('mmmFingersHighScore', highScore.toString());
            if (highScoreEl) {
                highScoreEl.textContent = `Best: ${highScore}`;
            }
            if (highScoreDisplayEl) {
                highScoreDisplayEl.textContent = `Best Score: ${highScore}`;
            }
            if (startHighScoreEl) {
                startHighScoreEl.textContent = highScore;
            }
            return true; // New record
        }
        return false; // No new record
    }
    
    // Initialize audio context
    function initAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }
    }
    
    // Generate and play a tone
    function playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!audioContext) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }
    
    // Enhanced SFX system
    function playSwipeSound() {
        // Soft whoosh sound for swiping
        playTone(200, 0.05, 'sine', 0.15);
        playTone(300, 0.05, 'sine', 0.1);
    }
    
    function playScoreSound() {
        // Pleasant tick sound for score increase
        playTone(600, 0.08, 'sine', 0.2);
    }
    
    function playCollisionSound() {
        // More dramatic and impactful sound for collision
        playTone(80, 0.3, 'sawtooth', 0.6);
        playTone(60, 0.3, 'sawtooth', 0.5);
        setTimeout(() => playTone(100, 0.2, 'sawtooth', 0.4), 100);
        setTimeout(() => playTone(120, 0.15, 'sawtooth', 0.3), 200);
    }
    
    function playGameOverSound() {
        // Dramatic descending game over sound - more impactful and emotional
        if (!audioContext) return;
        
        // Low dramatic impact
        playTone(150, 0.4, 'sawtooth', 0.7);
        playTone(120, 0.4, 'sawtooth', 0.6);
        
        // Descending tones for dramatic effect
        setTimeout(() => {
            playTone(100, 0.3, 'sawtooth', 0.5);
            playTone(80, 0.3, 'sawtooth', 0.4);
        }, 200);
        
        // Final low impact
        setTimeout(() => {
            playTone(60, 0.5, 'sawtooth', 0.6);
            playTone(50, 0.5, 'sawtooth', 0.5);
        }, 400);
        
        // Subtle high tone for contrast
        setTimeout(() => {
            playTone(200, 0.2, 'sine', 0.3);
        }, 600);
    }
    
    function playNearMissSound() {
        // Warning sound when close to monster
        playTone(400, 0.1, 'sine', 0.15);
    }
    
    function playLevelUpSound() {
        // Ascending chord for level up
        playTone(523, 0.15, 'sine', 0.25); // C5
        setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 100); // E5
        setTimeout(() => playTone(784, 0.2, 'sine', 0.25), 200); // G5
    }
    
    // Haptic feedback system
    function triggerHaptic(pattern) {
        if (!hapticEnabled) return;
        try {
            if (typeof pattern === 'number') {
                navigator.vibrate(pattern);
            } else {
                navigator.vibrate(pattern);
            }
        } catch (e) {
            // Haptic not supported or failed
        }
    }
    
    function hapticSwipe() {
        triggerHaptic(25); // Stronger vibration for swipe
    }
    
    function hapticCollision() {
        triggerHaptic([100, 50, 100, 50, 150]); // Much stronger vibration pattern for collision
    }
    
    function hapticNearMiss() {
        triggerHaptic(40); // Stronger vibration for near miss
    }
    
    function hapticScore() {
        triggerHaptic(15); // Stronger vibration for score
    }
    
    function hapticLevelUp() {
        triggerHaptic([50, 30, 50, 30, 80, 30, 100]); // Stronger celebration pattern
    }
    
    // Play milestone sound (100, 200, 300, etc.)
    function playMilestoneSound() {
        // Play a pleasant ascending tone
        playTone(440, 0.1, 'sine', 0.2); // A4
        setTimeout(() => playTone(554, 0.1, 'sine', 0.2), 100); // C#5
        setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 200); // E5
        hapticLevelUp();
    }
    
    // Create particle effect
    function createParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                size: 3 + Math.random() * 4,
                color: color
            });
        }
    }
    
    // Initialize background particles for animated background
    function initBackgroundParticles() {
        backgroundParticles.length = 0;
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            backgroundParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                size: 3 + Math.random() * 5,
                opacity: 0.15 + Math.random() * 0.25,
                color: `hsl(${180 + Math.random() * 60}, 70%, ${70 + Math.random() * 20}%)`,
                glow: Math.random() > 0.7 // Some particles have glow
            });
        }
    }
    
    // Update and draw background particles
    function updateBackgroundParticles() {
        if (!gameRunning) return;
        
        backgroundAnimationTime += 0.01;
        
        for (let i = 0; i < backgroundParticles.length; i++) {
            const p = backgroundParticles[i];
            
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap around screen
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            
            // Animate opacity
            p.opacity = 0.15 + Math.sin(backgroundAnimationTime + i) * 0.2;
            
            // Draw particle with glow effect
            ctx.save();
            if (p.glow) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = p.color;
            }
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    
    // Update and draw particles
    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.life -= p.decay;
            
            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }
    
    // Play new record sound
    function playNewRecordSound() {
        // Play a fanfare
        playTone(523, 0.2, 'sine', 0.3); // C5
        setTimeout(() => playTone(659, 0.2, 'sine', 0.3), 150); // E5
        setTimeout(() => playTone(784, 0.3, 'sine', 0.3), 300); // G5
        setTimeout(() => playTone(1047, 0.4, 'sine', 0.3), 450); // C6
    }
    
    // Play background music (continuous looping track)
    function playBackgroundMusic() {
        if (!audioContext || backgroundMusicPlaying) return;
        
        backgroundMusicPlaying = true;
        backgroundMusicOscillators = [];
        
        const createContinuousLayer = (freq, type, volume, phase = 0) => {
            if (!gameRunning || !backgroundMusicPlaying) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = type;
            
            // Smooth fade in
            const now = audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 1);
            gainNode.gain.setValueAtTime(volume, now + 1);
            
            oscillator.start(now + phase);
            
            backgroundMusicOscillators.push({ oscillator, gainNode });
        };
        
        // Create continuous ambient background music with multiple layers
        // Bass layer - continuous low tone
        createContinuousLayer(110, 'sine', 0.12); // A2 - slightly louder
        
        // Mid layer - continuous harmony
        setTimeout(() => createContinuousLayer(220, 'sine', 0.08), 200); // A3
        
        // High layer - subtle melody
        setTimeout(() => createContinuousLayer(330, 'sine', 0.05), 400); // E4
        
        // Additional layer for depth - very subtle
        setTimeout(() => createContinuousLayer(165, 'triangle', 0.04), 600); // E3
        
        // Create a subtle rhythm pattern (every 4 seconds)
        const createRhythmLayer = () => {
            if (!gameRunning || !backgroundMusicPlaying) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 440; // A4
            oscillator.type = 'sine';
            
            const now = audioContext.currentTime;
            // Quick pulse every 4 seconds
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.06, now + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
            
            oscillator.start(now);
            oscillator.stop(now + 0.2);
            
            backgroundMusicOscillators.push({ oscillator, gainNode });
            
            // Schedule next pulse
            setTimeout(() => {
                if (gameRunning && backgroundMusicPlaying) {
                    createRhythmLayer();
                }
            }, 4000);
        };
        
        // Start rhythm after initial fade in
        setTimeout(() => createRhythmLayer(), 1000);
    }
    
    // Stop background music
    function stopBackgroundMusic() {
        backgroundMusicPlaying = false;
        backgroundMusicOscillators.forEach(({ oscillator, gainNode }) => {
            try {
                gainNode.gain.cancelScheduledValues(audioContext.currentTime);
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                oscillator.stop();
            } catch (e) {
                // Already stopped
            }
        });
        backgroundMusicOscillators = [];
    }
    
    // Show new record notification
    function showNewRecordNotification() {
        newRecordEl.style.display = 'block';
        playNewRecordSound();
        setTimeout(() => {
            newRecordEl.style.display = 'none';
        }, 3000);
    }

    // Finger (player) properties
    const finger = {
        x: 0,
        y: 0,
        width: 45,  // Will be updated based on image
        height: 60, // Will be updated based on image
        targetX: 0,
        targetY: 0,
        trail: [], // Path trail
        imageWidth: 45,
        imageHeight: 60
    };

    // Monsters (obstacles)
    const monsters = [];
    
    // Different monster types - cycles every 50 score
    const monsterTypeDefinitions = {
        // Monster 1
        monster1: [
            { 
                type: 'monster1', 
                image: images.monster1,
                size: 75
            }
        ],
        // Monster 2
        monster2: [
            { 
                type: 'monster2', 
                image: images.monster2,
                size: 100
            }
        ],
        // Monster 3
        monster3: [
            { 
                type: 'monster3', 
                image: images.monster3,
                size: 140
            }
        ],
        // Monster 4
        monster4: [
            { 
                type: 'monster4', 
                image: images.monster4,
                size: 120
            }
        ]
    };

    // Game settings
    const settings = {
        monsterSpawnRate: 0.05, // Increased from 0.015 - more monsters spawn
        monsterSpeed: 8.0, // Increased base speed for faster enemy movement
        trailLength: 15,
        scoreRate: 0.1, // Score per frame
        scorePerSecond: 2, // Score increases 2 times per second
        levelUpScore: 50 // Score needed to level up - speed increases every 50 score
    };

    // Get current level based on score
    function getCurrentLevel() {
        return Math.floor(score / settings.levelUpScore) + 1;
    }

    // Get available monster types - changes every 50 score
    function getMonsterTypesForLevel() {
        // Calculate which monster cycle we're in (every 50 points)
        const monsterCycle = Math.floor(score / 50) % 4;
        
        // Cycle through monsters: 0=monster1, 1=monster2, 2=monster3, 3=monster4
        if (monsterCycle === 0) return monsterTypeDefinitions.monster1; // 0-49: monster1
        if (monsterCycle === 1) return monsterTypeDefinitions.monster2; // 50-99: monster2
        if (monsterCycle === 2) return monsterTypeDefinitions.monster3; // 100-149: monster3
        return monsterTypeDefinitions.monster4; // 150-199: monster4, then cycles back
    }

    // Initialize finger position
    function initFinger() {
        finger.x = canvas.width / 2;
        finger.y = canvas.height / 2;
        finger.targetX = finger.x;
        finger.targetY = finger.y;
        finger.trail = [];
        
        // Update finger dimensions based on image if loaded
        if (images.hand.complete && images.hand.width > 0) {
            // Scale hand image to reasonable size (smaller)
            const scale = 0.3; // Scale factor - reduced for smaller hand
            finger.imageWidth = images.hand.width * scale;
            finger.imageHeight = images.hand.height * scale;
            finger.width = finger.imageWidth;
            finger.height = finger.imageHeight;
        }
    }

    // Draw hand using image
    function drawFinger() {
        if (!images.hand.complete || images.hand.width === 0) return;
        
        const x = finger.x;
        const y = finger.y;
        
        // Draw shadow
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        
        // Draw hand image
        const drawWidth = finger.imageWidth;
        const drawHeight = finger.imageHeight;
        
        ctx.drawImage(
            images.hand,
            x - drawWidth / 2,
            y - drawHeight / 2,
            drawWidth,
            drawHeight
        );
        
        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    }

    // Draw enhanced trail with glow effect
    function drawTrail() {
        if (finger.trail.length < 2) return;

        // Outer glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#87CEEB';
        ctx.strokeStyle = '#87CEEB';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.3;

        ctx.beginPath();
        ctx.moveTo(finger.trail[0].x, finger.trail[0].y);
        for (let i = 1; i < finger.trail.length; i++) {
            ctx.lineTo(finger.trail[i].x, finger.trail[i].y);
        }
        ctx.stroke();

        // Main trail
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4ECDC4';
        ctx.strokeStyle = '#87CEEB';
        ctx.lineWidth = 10;
        ctx.globalAlpha = 0.7;
        ctx.stroke();

        // Inner bright trail
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.9;
        ctx.stroke();

        // Reset
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }

    // Spawn monster - only from top, moving downward
    function spawnMonster() {
        // Increase spawn rate with level (more aggressive progression)
        const spawnRate = settings.monsterSpawnRate * (1 + (level - 1) * 0.5);
        if (Math.random() < spawnRate) {
            const availableTypes = getMonsterTypesForLevel();
            const typeDef = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            const size = typeDef.size;
            
            // Spawn only from top
            const x = Math.random() * canvas.width;
            const y = -size;
            
            // Move downward only (slight horizontal variation for visual interest)
            const vx = (Math.random() - 0.5) * 0.3; // Small horizontal drift
            // Speed increases every 50 score (each level) - more aggressive scaling
            const vy = settings.monsterSpeed * (1 + (level - 1) * 0.6) + Math.random() * 0.8; // Faster downward movement with aggressive level scaling

            monsters.push({
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                typeDef: typeDef,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.05
            });
        }
    }

    // Draw monster using image
    function drawMonster(monster) {
        const typeDef = monster.typeDef;
        const monsterImage = typeDef.image;
        
        // Check if image is loaded
        if (!monsterImage || !monsterImage.complete || monsterImage.width === 0) {
            return;
        }
        
        ctx.save();
        ctx.translate(monster.x, monster.y);
        ctx.rotate(monster.rotation);
        
        // Add glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
        
        const size = typeDef.size;
        const drawWidth = size;
        const drawHeight = (monsterImage.height / monsterImage.width) * size;
        
        // Draw monster image
        ctx.drawImage(
            monsterImage,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Update monster
    function updateMonster(monster) {
        monster.x += monster.vx;
        monster.y += monster.vy;
        monster.rotation += monster.rotationSpeed;

        // Check collision with finger (using smaller, more accurate hitbox)
        const dx = finger.x - monster.x;
        const dy = finger.y - monster.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Use smaller collision radius - only the finger tip area, not the full hand image
        const fingerRadius = Math.min(finger.imageWidth || finger.width, finger.imageHeight || finger.height) * 0.25; // 25% of smaller dimension
        const monsterRadius = monster.typeDef.size / 2;
        const minDistance = fingerRadius + monsterRadius;
        const warningDistance = minDistance + 20; // Warning zone

        // Near miss warning
        if (distance < warningDistance && distance >= minDistance) {
            if (Math.random() < 0.1) { // Occasional warning
                playNearMissSound();
                hapticNearMiss();
            }
        }

        if (distance < minDistance) {
            // Create explosion particles (use orange color as default)
            createParticles(monster.x, monster.y, '#FF6B35', 15);
            playCollisionSound();
            hapticCollision();
            return { remove: false, gameOver: true };
        }

        // Remove if monster goes off the bottom of the screen
        const margin = 50;
        if (monster.y > canvas.height + margin) {
            return { remove: true, gameOver: false };
        }

        return { remove: false, gameOver: false };
    }

    // Game loop - optimized for iOS Safari/WKWebView
    function gameLoop(currentTime) {
        if (!gameRunning) return;

        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        const clampedDelta = Math.min(deltaTime, 50);

        // Update score (survival-based - increases automatically)
        scoreTimer += clampedDelta;
        if (scoreTimer >= 1000 / settings.scorePerSecond) { // Score increases every second
            score += 1;
            scoreEl.textContent = score;
            
            // Animate score update
            scoreEl.classList.add('score-update');
            setTimeout(() => scoreEl.classList.remove('score-update'), 300);
            
            // Play score sound and haptic
            if (score % 5 === 0) { // Every 5 points to avoid too many sounds
                playScoreSound();
                hapticScore();
            }
            
            scoreTimer = 0;
            
            // Check for milestones (100, 200, 300, etc.)
            if (score > 0 && score % 100 === 0 && score !== lastMilestoneScore) {
                lastMilestoneScore = score;
                playMilestoneSound();
                createParticles(canvas.width / 2, 50, '#FFD700', 20);
            }
            
            // Update level based on score
            const newLevel = getCurrentLevel();
            if (newLevel > level) {
                level = newLevel;
                playLevelUpSound();
                hapticLevelUp();
                createParticles(canvas.width / 2, canvas.height / 2, '#4ECDC4', 25);
            }
        }

        // Update finger position (smooth movement)
        const diffX = finger.targetX - finger.x;
        const diffY = finger.targetY - finger.y;
        finger.x += diffX * 0.25;
        finger.y += diffY * 0.25;

        // Keep finger within bounds
        finger.x = Math.max(finger.width / 2, Math.min(canvas.width - finger.width / 2, finger.x));
        finger.y = Math.max(finger.height / 2, Math.min(canvas.height - finger.height / 2, finger.y));

        // Update trail
        finger.trail.push({ x: finger.x, y: finger.y });
        if (finger.trail.length > settings.trailLength) {
            finger.trail.shift();
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw animated background particles
        updateBackgroundParticles();

        // Draw trail
        drawTrail();

        // Spawn monsters
        spawnMonster();

        // Update and draw monsters
        for (let i = monsters.length - 1; i >= 0; i--) {
            const monster = monsters[i];
            const result = updateMonster(monster);
            if (result.remove) {
                monsters.splice(i, 1);
            } else if (result.gameOver) {
                endGame();
                return;
            } else {
                drawMonster(monster);
            }
        }

        // Update and draw particles
        updateParticles();

        // Draw finger
        drawFinger();

        animationId = requestAnimationFrame(gameLoop);
    }

    // Start game
    function startGame() {
        score = 0;
        level = 1;
        scoreTimer = 0;
        lastMilestoneScore = 0;
        monsters.length = 0;
        particles.length = 0;
        gameRunning = true;
        lastTime = performance.now();
        backgroundAnimationTime = 0;
        scoreEl.textContent = '0';
        gameOverEl.style.display = 'none';
        newRecordEl.style.display = 'none';
        if (startScreenEl) startScreenEl.style.display = 'none';
        initFinger();
        initBackgroundParticles();
        
        // Start background music
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        playBackgroundMusic();
        
        animationId = requestAnimationFrame(gameLoop);
    }

    // End game
    function endGame() {
        gameRunning = false;
        stopBackgroundMusic();
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        finalScoreEl.textContent = `Final Score: ${score}`;
        
        // Play dramatic game over sound (better than collision sound)
        playGameOverSound();
        
        // Check for new record
        const isNewRecord = saveHighScore(score);
        if (isNewRecord) {
            showNewRecordNotification();
        }
        
        // Delay showing game over modal slightly for dramatic effect
        setTimeout(() => {
            gameOverEl.style.display = 'block';
        }, 300);
    }

    // Touch/Mouse tracking for movement
    let isDragging = false;

    // Move finger to target position
    function moveFinger(targetX, targetY) {
        if (!gameRunning) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const oldX = finger.targetX;
        const oldY = finger.targetY;
        
        finger.targetX = (targetX - rect.left) * scaleX;
        finger.targetY = (targetY - rect.top) * scaleY;
        
        // Play swipe sound occasionally
        const moved = Math.abs(finger.targetX - oldX) + Math.abs(finger.targetY - oldY);
        if (moved > 5 && Math.random() < 0.1) {
            playSwipeSound();
            hapticSwipe();
        }
    }

    // Event listeners - optimized for mobile
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        isDragging = true;
        moveFinger(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (isDragging && e.touches.length > 0) {
            const touch = e.touches[0];
            moveFinger(touch.clientX, touch.clientY);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        isDragging = false;
    }, { passive: false });

    canvas.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isDragging = true;
        moveFinger(e.clientX, e.clientY);
    });

    canvas.addEventListener('mousemove', function(e) {
        if (isDragging) {
            e.preventDefault();
            moveFinger(e.clientX, e.clientY);
        }
    });

    canvas.addEventListener('mouseup', function(e) {
        e.preventDefault();
        isDragging = false;
    });

    canvas.addEventListener('mouseleave', function(e) {
        isDragging = false;
    });

    restartBtn.addEventListener('click', function(e) {
        e.preventDefault();
        startGame();
    });

    // Prevent default touch behaviors (but allow canvas touchmove)
    document.addEventListener('touchmove', function(e) {
        if (e.target !== canvas && !canvas.contains(e.target)) {
            e.preventDefault();
        }
    }, { passive: false });

    // Initialize
    loadHighScore();
    initAudio();
    
    // Update start screen high score
    if (startHighScoreEl) {
        startHighScoreEl.textContent = highScore;
    }
    
    // Load images and then initialize
    loadImages().then(() => {
        initFinger();
        
        // Show start screen initially
        if (startScreenEl) {
            startScreenEl.style.display = 'flex';
        }
        
        // Start game function
        function beginGame() {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            startGame();
        }
        
        // Start game on button click
        if (startBtn) {
            startBtn.addEventListener('click', beginGame);
        }
        
        // Start game on canvas tap
        function startGameOnInteraction(e) {
            if (startScreenEl && startScreenEl.style.display !== 'none') {
                e.preventDefault();
                beginGame();
            }
        }
        
        canvas.addEventListener('touchstart', startGameOnInteraction, { once: false });
        canvas.addEventListener('mousedown', startGameOnInteraction, { once: false });
    });
})();
