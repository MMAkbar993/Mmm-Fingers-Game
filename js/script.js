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
    
    // Audio context for sound generation
    let audioContext = null;
    let backgroundMusicPlaying = false;
    let lastMilestoneScore = 0;
    
    // Particle system for visual effects
    const particles = [];
    
    // Haptic feedback support
    let hapticEnabled = false;
    if ('vibrate' in navigator) {
        hapticEnabled = true;
    }

    // Set canvas size
    function resizeCanvas() {
        const maxWidth = Math.min(window.innerWidth - 40, 500);
        const maxHeight = Math.min(window.innerHeight - 100, 700);
        canvas.width = maxWidth;
        canvas.height = maxHeight;
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
        // Harsh sound for collision
        playTone(150, 0.2, 'sawtooth', 0.4);
        playTone(100, 0.2, 'sawtooth', 0.3);
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
        triggerHaptic(10); // Short vibration for swipe
    }
    
    function hapticCollision() {
        triggerHaptic([50, 30, 50]); // Strong vibration pattern for collision
    }
    
    function hapticNearMiss() {
        triggerHaptic(20); // Medium vibration for near miss
    }
    
    function hapticScore() {
        triggerHaptic(5); // Very light vibration for score
    }
    
    function hapticLevelUp() {
        triggerHaptic([30, 50, 30, 50]); // Celebration pattern
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
    
    // Play background music (simple loop)
    function playBackgroundMusic() {
        if (!audioContext || backgroundMusicPlaying) return;
        
        backgroundMusicPlaying = true;
        const playMusic = () => {
            if (!gameRunning) {
                backgroundMusicPlaying = false;
                return;
            }
            
            // Simple ambient tone
            playTone(220, 2, 'sine', 0.05); // Low A3, very quiet
            setTimeout(playMusic, 2000);
        };
        playMusic();
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
        width: 40,
        height: 60,
        targetX: 0,
        targetY: 0,
        trail: [] // Path trail
    };

    // Monsters (obstacles)
    const monsters = [];
    
    // Different monster types for different levels
    const monsterTypeDefinitions = {
        // Level 1: Green circular spiky monsters
        level1: [
            { 
                type: 'circular', 
                color: '#4ECDC4', 
                eyeColor: '#FFD93D', 
                size: 35,
                spikes: 8
            }
        ],
        // Level 2: Orange caterpillar/saw monsters
        level2: [
            { 
                type: 'caterpillar', 
                color: '#FF6B35', 
                eyeColor: '#FFD93D', 
                size: 40,
                bodyLength: 60,
                spikes: 12
            }
        ],
        // Level 3: Red square spiky monsters
        level3: [
            { 
                type: 'square', 
                color: '#FF6B6B', 
                eyeColor: '#FFD93D', 
                size: 35,
                spikes: 8
            }
        ],
        // Level 4+: Mix of all types
        level4: [
            { 
                type: 'circular', 
                color: '#4ECDC4', 
                eyeColor: '#FFD93D', 
                size: 35,
                spikes: 8
            },
            { 
                type: 'caterpillar', 
                color: '#FF6B35', 
                eyeColor: '#FFD93D', 
                size: 40,
                bodyLength: 60,
                spikes: 12
            },
            { 
                type: 'square', 
                color: '#FF6B6B', 
                eyeColor: '#FFD93D', 
                size: 35,
                spikes: 8
            }
        ]
    };

    // Game settings
    const settings = {
        monsterSpawnRate: 0.05, // Increased from 0.015 - more monsters spawn
        monsterSpeed: 3.5, // Increased from 1.5 - monsters move faster
        trailLength: 15,
        scoreRate: 0.1, // Score per frame
        scorePerSecond: 2, // Score increases 2 times per second
        levelUpScore: 50 // Score needed to level up
    };

    // Get current level based on score
    function getCurrentLevel() {
        return Math.floor(score / settings.levelUpScore) + 1;
    }

    // Get available monster types for current level
    function getMonsterTypesForLevel() {
        if (level === 1) return monsterTypeDefinitions.level1;
        if (level === 2) return monsterTypeDefinitions.level2;
        if (level === 3) return monsterTypeDefinitions.level3;
        return monsterTypeDefinitions.level4; // Level 4+
    }

    // Initialize finger position
    function initFinger() {
        finger.x = canvas.width / 2;
        finger.y = canvas.height / 2;
        finger.targetX = finger.x;
        finger.targetY = finger.y;
        finger.trail = [];
    }

    // Draw finger with enhanced visuals
    function drawFinger() {
        const x = finger.x;
        const y = finger.y;

        // Outer glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        
        // Shadow with blur
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y + finger.height / 2 + 5, finger.width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Finger body (skin tone) with gradient
        const gradient = ctx.createRadialGradient(x - 5, y - 10, 0, x, y, finger.height / 2);
        gradient.addColorStop(0, '#FFE5CC');
        gradient.addColorStop(1, '#FFDBAC');
        
        ctx.fillStyle = gradient;
        ctx.strokeStyle = '#E8C5A0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(x, y, finger.width / 2, finger.height / 2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Fingernail with shine
        ctx.fillStyle = '#FFE5CC';
        ctx.beginPath();
        ctx.ellipse(x - 5, y - finger.height / 2 + 8, 12, 8, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Nail highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(x - 7, y - finger.height / 2 + 6, 4, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Finger tip highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x - 8, y - finger.height / 2 + 5, 6, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
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
            const vy = settings.monsterSpeed * (1 + (level - 1) * 0.4) + Math.random() * 0.8; // Faster downward movement with more aggressive level scaling

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

    // Draw monster
    function drawMonster(monster) {
        ctx.save();
        ctx.translate(monster.x, monster.y);
        ctx.rotate(monster.rotation);

        const typeDef = monster.typeDef;
        const size = typeDef.size;

        if (typeDef.type === 'circular') {
            // Green circular spiky monster with glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = typeDef.color;
            
            // Outer glow
            ctx.fillStyle = typeDef.color;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, size / 2 + 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            // Main body with gradient
            const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, size / 2);
            gradient.addColorStop(0, typeDef.color);
            // Add slight darkening for gradient effect
            const darkerColor = typeDef.color.replace('#', '');
            const r = parseInt(darkerColor.substr(0, 2), 16);
            const g = parseInt(darkerColor.substr(2, 2), 16);
            const b = parseInt(darkerColor.substr(4, 2), 16);
            gradient.addColorStop(1, `rgba(${Math.max(0, r-20)}, ${Math.max(0, g-20)}, ${Math.max(0, b-20)}, 0.9)`);
            
            ctx.fillStyle = gradient;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Spikes
            const spikeLength = 8;
            const spikeCount = typeDef.spikes;
            for (let i = 0; i < spikeCount; i++) {
                const angle = (i / spikeCount) * Math.PI * 2;
                const spikeX = Math.cos(angle) * (size / 2);
                const spikeY = Math.sin(angle) * (size / 2);
                const spikeEndX = Math.cos(angle) * (size / 2 + spikeLength);
                const spikeEndY = Math.sin(angle) * (size / 2 + spikeLength);
                
                ctx.beginPath();
                ctx.moveTo(spikeX, spikeY);
                ctx.lineTo(spikeEndX, spikeEndY);
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Two eyes
            ctx.fillStyle = typeDef.eyeColor;
            ctx.beginPath();
            ctx.arc(-8, -8, 6, 0, Math.PI * 2);
            ctx.arc(8, -8, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-8, -8, 3, 0, Math.PI * 2);
            ctx.arc(8, -8, 3, 0, Math.PI * 2);
            ctx.fill();

        } else if (typeDef.type === 'caterpillar') {
            // Orange caterpillar/saw monster with glow
            const bodyLength = typeDef.bodyLength || 60;
            
            ctx.shadowBlur = 10;
            ctx.shadowColor = typeDef.color;
            
            // Head (circular) with gradient
            const headGradient = ctx.createRadialGradient(-3, -3, 0, 0, 0, size / 2);
            headGradient.addColorStop(0, typeDef.color);
            // Add slight darkening for gradient effect
            const darkerColor2 = typeDef.color.replace('#', '');
            const r2 = parseInt(darkerColor2.substr(0, 2), 16);
            const g2 = parseInt(darkerColor2.substr(2, 2), 16);
            const b2 = parseInt(darkerColor2.substr(4, 2), 16);
            headGradient.addColorStop(1, `rgba(${Math.max(0, r2-20)}, ${Math.max(0, g2-20)}, ${Math.max(0, b2-20)}, 0.9)`);
            
            ctx.fillStyle = headGradient;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Single large eye
            ctx.fillStyle = typeDef.eyeColor;
            ctx.beginPath();
            ctx.arc(0, -5, 12, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(0, -5, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, -5, 4, 0, Math.PI * 2);
            ctx.fill();

            // Eyebrow
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-10, -12);
            ctx.lineTo(10, -12);
            ctx.stroke();

            // Fangs
            ctx.fillStyle = '#FFF';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-4, 8);
            ctx.lineTo(-2, 15);
            ctx.lineTo(-6, 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(4, 8);
            ctx.lineTo(2, 15);
            ctx.lineTo(6, 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Elongated body with spikes (saw-like)
            ctx.fillStyle = typeDef.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            const bodyY = size / 2;
            const spikeLength = 6;
            const spikeCount = typeDef.spikes;
            
            // Draw body rectangle
            ctx.fillRect(-bodyLength / 2, bodyY, bodyLength, size / 3);
            ctx.strokeRect(-bodyLength / 2, bodyY, bodyLength, size / 3);

            // Spikes on top and bottom of body
            for (let i = 0; i < spikeCount; i++) {
                const t = i / (spikeCount - 1);
                const x = -bodyLength / 2 + t * bodyLength;
                
                // Top spikes
                ctx.beginPath();
                ctx.moveTo(x, bodyY);
                ctx.lineTo(x - 3, bodyY - spikeLength);
                ctx.lineTo(x + 3, bodyY - spikeLength);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Bottom spikes
                ctx.beginPath();
                ctx.moveTo(x, bodyY + size / 3);
                ctx.lineTo(x - 3, bodyY + size / 3 + spikeLength);
                ctx.lineTo(x + 3, bodyY + size / 3 + spikeLength);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

        } else if (typeDef.type === 'square') {
            // Red square spiky monster with glow
            const halfSize = size / 2;
            
            ctx.shadowBlur = 10;
            ctx.shadowColor = typeDef.color;
            
            // Main square body with gradient
            const squareGradient = ctx.createLinearGradient(-halfSize, -halfSize, halfSize, halfSize);
            squareGradient.addColorStop(0, typeDef.color);
            // Add slight darkening for gradient effect
            const darkerColor3 = typeDef.color.replace('#', '');
            const r3 = parseInt(darkerColor3.substr(0, 2), 16);
            const g3 = parseInt(darkerColor3.substr(2, 2), 16);
            const b3 = parseInt(darkerColor3.substr(4, 2), 16);
            squareGradient.addColorStop(1, `rgba(${Math.max(0, r3-20)}, ${Math.max(0, g3-20)}, ${Math.max(0, b3-20)}, 0.9)`);
            
            ctx.fillStyle = squareGradient;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.fillRect(-halfSize, -halfSize, size, size);
            ctx.strokeRect(-halfSize, -halfSize, size, size);
            ctx.shadowBlur = 0;

            // Spikes on corners and edges
            const spikeLength = 8;
            const positions = [
                { x: -halfSize, y: -halfSize, angle: -Math.PI * 0.75 }, // Top-left
                { x: halfSize, y: -halfSize, angle: -Math.PI * 0.25 }, // Top-right
                { x: -halfSize, y: halfSize, angle: Math.PI * 0.75 }, // Bottom-left
                { x: halfSize, y: halfSize, angle: Math.PI * 0.25 }, // Bottom-right
                { x: 0, y: -halfSize, angle: -Math.PI / 2 }, // Top
                { x: 0, y: halfSize, angle: Math.PI / 2 }, // Bottom
                { x: -halfSize, y: 0, angle: Math.PI }, // Left
                { x: halfSize, y: 0, angle: 0 } // Right
            ];

            for (let pos of positions) {
                const spikeX = pos.x + Math.cos(pos.angle) * spikeLength;
                const spikeY = pos.y + Math.sin(pos.angle) * spikeLength;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(spikeX, spikeY);
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Two eyes
            ctx.fillStyle = typeDef.eyeColor;
            ctx.beginPath();
            ctx.arc(-8, -8, 6, 0, Math.PI * 2);
            ctx.arc(8, -8, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-8, -8, 3, 0, Math.PI * 2);
            ctx.arc(8, -8, 3, 0, Math.PI * 2);
            ctx.fill();

            // Eyebrows
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-12, -12);
            ctx.lineTo(-4, -12);
            ctx.moveTo(4, -12);
            ctx.lineTo(12, -12);
            ctx.stroke();

            // Small horns
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.moveTo(-halfSize + 5, -halfSize);
            ctx.lineTo(-halfSize + 2, -halfSize - 5);
            ctx.lineTo(-halfSize + 8, -halfSize - 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(halfSize - 5, -halfSize);
            ctx.lineTo(halfSize - 2, -halfSize - 5);
            ctx.lineTo(halfSize - 8, -halfSize - 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    // Update monster
    function updateMonster(monster) {
        monster.x += monster.vx;
        monster.y += monster.vy;
        monster.rotation += monster.rotationSpeed;

        // Check collision with finger
        const dx = finger.x - monster.x;
        const dy = finger.y - monster.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (finger.width / 2) + (monster.typeDef.size / 2) + 5; // +5 for spikes
        const warningDistance = minDistance + 20; // Warning zone

        // Near miss warning
        if (distance < warningDistance && distance >= minDistance) {
            if (Math.random() < 0.1) { // Occasional warning
                playNearMissSound();
                hapticNearMiss();
            }
        }

        if (distance < minDistance) {
            // Create explosion particles
            createParticles(monster.x, monster.y, monster.typeDef.color, 15);
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
        scoreEl.textContent = '0';
        gameOverEl.style.display = 'none';
        newRecordEl.style.display = 'none';
        initFinger();
        
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
        backgroundMusicPlaying = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        finalScoreEl.textContent = `Final Score: ${score}`;
        
        // Check for new record
        const isNewRecord = saveHighScore(score);
        if (isNewRecord) {
            showNewRecordNotification();
        }
        
        gameOverEl.style.display = 'block';
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
    initFinger();
    
    // Start game on first load (or wait for user interaction for audio)
    // Audio requires user interaction, so we'll start game after first user interaction
    let gameStarted = false;
    function startGameOnInteraction() {
        if (!gameStarted) {
            gameStarted = true;
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            startGame();
        }
    }
    
    // Start game on any user interaction (for audio)
    canvas.addEventListener('touchstart', startGameOnInteraction, { once: true });
    canvas.addEventListener('mousedown', startGameOnInteraction, { once: true });
    
    // Also start immediately if audio is not needed
    setTimeout(() => {
        if (!gameStarted) {
            startGame();
            gameStarted = true;
        }
    }, 100);
})();
