(function() {
    'use strict';

    // Get canvas and context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const levelBadgeEl = document.getElementById('levelBadge');
    const gameOverEl = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');
    const restartBtn = document.getElementById('restartBtn');
    const newRecordEl = document.getElementById('newRecord');
    const startScreenEl = document.getElementById('startScreen');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const musicToggle = document.getElementById('musicToggle');
    const fxToggle = document.getElementById('fxToggle');
    const hapticsToggle = document.getElementById('hapticsToggle');
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const achievementsBtn = document.getElementById('achievementsBtn');
    const moreGamesBtn = document.getElementById('moreGamesBtn');
    const bestScoreDisplay = document.getElementById('bestScoreDisplay');
    
    
    // Audio context for sound generation
    let audioContext = null;
    let backgroundMusicPlaying = false;
    let backgroundMusicNodes = [];
    let backgroundMusicInterval = null;
    let startScreenMusicPlaying = false;
    let startScreenMusicNodes = [];
    let lastMilestoneScore = 0;
    let masterGainNode = null;
    let musicGainNode = null;
    let fxGainNode = null;
    
    // Particle system for visual effects
    const particles = [];
    
    // Background animation particles
    const backgroundParticles = [];
    let backgroundAnimationTime = 0;
    
    // Detect mobile device
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    
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

    // Set canvas size - fill 100% viewport
    function resizeCanvas() {
        // Full screen canvas - fill viewport
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Update UI positioning for safe areas
        const safeAreaTop = isMobile ? 120 : 45;
        
        const ui = document.getElementById('ui');
        if (ui) {
            ui.style.top = `${safeAreaTop}px`;
        }
        
        // Update corner buttons positioning
        const topLeftButtons = document.querySelector('.top-left-buttons');
        const topRightButtons = document.querySelector('.top-right-buttons');
        if (topLeftButtons) {
            topLeftButtons.style.top = `${safeAreaTop}px`;
        }
        if (topRightButtons) {
            topRightButtons.style.top = `${safeAreaTop}px`;
        }
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
    
    // Settings state (persisted to localStorage)
    const settings = {
        music: true,
        fx: true,
        haptics: true
    };
    
    // Best score state (persisted to localStorage)
    let bestScore = 0;
    
    // Load settings from localStorage
    function loadSettings() {
        const saved = localStorage.getItem('mmmFingersSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                settings.music = parsed.music !== false;
                settings.fx = parsed.fx !== false;
                settings.haptics = parsed.haptics !== false;
            } catch (e) {
                console.warn('Failed to parse settings');
            }
        }
        // Update UI
        if (musicToggle) musicToggle.checked = settings.music;
        if (fxToggle) fxToggle.checked = settings.fx;
        if (hapticsToggle) hapticsToggle.checked = settings.haptics;
    }
    
    // Save settings to localStorage
    function saveSettings() {
        localStorage.setItem('mmmFingersSettings', JSON.stringify(settings));
    }
    
    // Load best score from localStorage
    function loadBestScore() {
        const saved = localStorage.getItem('mmmFingersBestScore');
        if (saved) {
            try {
                bestScore = parseInt(saved, 10) || 0;
            } catch (e) {
                console.warn('Failed to parse best score');
                bestScore = 0;
            }
        }
        
        // Also check platform for best score
        if (typeof (window).getBestScore === "function") {
            try {
                const platformBest = (window).getBestScore();
                if (platformBest !== undefined && platformBest !== null) {
                    const platformScore = parseInt(platformBest, 10) || 0;
                    if (platformScore > bestScore) {
                        bestScore = platformScore;
                    }
                }
            } catch (e) {
                // Platform function not available
            }
        }
        
        // Update display
        if (bestScoreDisplay) {
            bestScoreDisplay.textContent = bestScore.toString();
        }
    }
    
    // Save best score to localStorage
    function saveBestScore(newScore) {
        if (newScore > bestScore) {
            bestScore = newScore;
            localStorage.setItem('mmmFingersBestScore', bestScore.toString());
            if (bestScoreDisplay) {
                bestScoreDisplay.textContent = bestScore.toString();
            }
            return true; // New record
        }
        return false; // No new record
    }
    
    // Initialize audio context with gain nodes for volume control
    function initAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            masterGainNode = audioContext.createGain();
            masterGainNode.connect(audioContext.destination);
            masterGainNode.gain.value = 1.0;
            
            // Create separate gain nodes for music and FX
            musicGainNode = audioContext.createGain();
            musicGainNode.connect(masterGainNode);
            musicGainNode.gain.value = 0.4; // Background music volume
            
            fxGainNode = audioContext.createGain();
            fxGainNode.connect(masterGainNode);
            fxGainNode.gain.value = 0.6; // Sound effects volume
        } catch (e) {
            console.log('Audio not supported');
        }
    }
    
    // Create a more sophisticated tone with envelope and optional filter
    function createTone(frequency, duration, options = {}) {
        if (!audioContext || !settings.fx) return null;
        
        const {
            type = 'sine',
            volume = 0.3,
            attack = 0.01,
            decay = 0.1,
            sustain = 0.7,
            release = 0.2,
            detune = 0,
            filterFreq = null,
            filterQ = 1
        } = options;
        
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        let filter = null;
        
        if (filterFreq) {
            filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = filterFreq;
            filter.Q.value = filterQ;
            oscillator.connect(filter);
            filter.connect(gainNode);
        } else {
            oscillator.connect(gainNode);
        }
        
        gainNode.connect(fxGainNode);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        oscillator.detune.value = detune;
        
        // ADSR envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, now + attack);
        gainNode.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
        gainNode.gain.setValueAtTime(volume * sustain, now + duration - release);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);
        
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        return { oscillator, gainNode, filter };
    }
    
    // Enhanced SFX system with better sound design
    function playSwipeSound() {
        // Smooth whoosh with frequency sweep
        const baseFreq = 150;
        const sweepDuration = 0.08;
        const steps = 5;
        
        for (let i = 0; i < steps; i++) {
            const delay = (i / steps) * sweepDuration;
            const freq = baseFreq + (i * 50);
            createTone(freq, 0.06, {
                type: 'sine',
                volume: 0.12 * (1 - i / steps),
                attack: 0.005,
                release: 0.04
            });
        }
    }
    
    function playScoreSound() {
        // Pleasant, crisp tick with harmonic
        createTone(800, 0.1, {
            type: 'sine',
            volume: 0.25,
            attack: 0.01,
            decay: 0.05,
            release: 0.04
        });
        // Add harmonic
        setTimeout(() => {
            createTone(1200, 0.08, {
                type: 'sine',
                volume: 0.15,
                attack: 0.01,
                release: 0.07
            });
        }, 20);
    }
    
    function playCollisionSound() {
        // Powerful, dramatic impact with multiple layers
        const now = audioContext.currentTime;
        
        // Low impact layer
        createTone(80, 0.4, {
            type: 'sawtooth',
            volume: 0.5,
            attack: 0.01,
            decay: 0.15,
            sustain: 0.3,
            release: 0.24,
            filterFreq: 200
        });
        
        // Mid impact layer
        createTone(120, 0.35, {
            type: 'square',
            volume: 0.4,
            attack: 0.01,
            decay: 0.1,
            sustain: 0.2,
            release: 0.24,
            filterFreq: 300
        });
        
        // High impact layer
        setTimeout(() => {
            createTone(200, 0.25, {
                type: 'sawtooth',
                volume: 0.3,
                attack: 0.01,
                decay: 0.08,
                release: 0.16,
                filterFreq: 500
            });
        }, 50);
        
        // Rumble layer
        setTimeout(() => {
            createTone(60, 0.3, {
                type: 'sawtooth',
                volume: 0.35,
                attack: 0.02,
                decay: 0.1,
                release: 0.18,
                filterFreq: 150
            });
        }, 100);
    }
    
    function playGameOverSound() {
        // Emotional, dramatic descending sequence
        if (!audioContext || !settings.fx) return;
        
        // Initial impact
        createTone(150, 0.3, {
            type: 'sawtooth',
            volume: 0.6,
            attack: 0.01,
            decay: 0.15,
            release: 0.14,
            filterFreq: 250
        });
        
        // Descending sequence
        const notes = [120, 100, 85, 70, 60];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                createTone(freq, 0.25, {
                    type: 'sawtooth',
                    volume: 0.5 * (1 - i * 0.15),
                    attack: 0.01,
                    decay: 0.1,
                    release: 0.14,
                    filterFreq: freq * 2
                });
            }, 150 + i * 120);
        });
        
        // Final low impact
        setTimeout(() => {
            createTone(50, 0.6, {
                type: 'sawtooth',
                volume: 0.4,
                attack: 0.02,
                decay: 0.2,
                release: 0.38,
                filterFreq: 100
            });
        }, 800);
    }
    
    function playNearMissSound() {
        // Subtle warning with slight pitch bend
        createTone(450, 0.12, {
            type: 'sine',
            volume: 0.2,
            attack: 0.01,
            decay: 0.05,
            release: 0.06
        });
        // Slight pitch variation
        setTimeout(() => {
            createTone(500, 0.1, {
                type: 'sine',
                volume: 0.15,
                attack: 0.01,
                release: 0.09
            });
        }, 60);
    }
    
    function playLevelUpSound() {
        // Joyful ascending major chord
        const chord = [523.25, 659.25, 783.99]; // C5, E5, G5
        chord.forEach((freq, i) => {
            setTimeout(() => {
                createTone(freq, 0.2, {
                    type: 'sine',
                    volume: 0.3,
                    attack: 0.01,
                    decay: 0.05,
                    sustain: 0.8,
                    release: 0.14
                });
            }, i * 50);
        });
        // Add octave
        setTimeout(() => {
            createTone(1046.5, 0.25, {
                type: 'sine',
                volume: 0.25,
                attack: 0.01,
                decay: 0.05,
                sustain: 0.7,
                release: 0.19
            });
        }, 200);
    }
    
    // Haptic feedback system - uses Oasiz platform API with better patterns
    function triggerHaptic(type) {
        if (!settings.haptics) return;
        if (typeof (window).triggerHaptic === "function") {
            (window).triggerHaptic(type);
        }
    }
    
    function hapticSwipe() {
        triggerHaptic("light");
    }
    
    function hapticCollision() {
        // Strong haptic for collision
        triggerHaptic("error");
        // Add a second pulse for more impact
        setTimeout(() => {
            if (settings.haptics) {
                triggerHaptic("heavy");
            }
        }, 100);
    }
    
    function hapticNearMiss() {
        // Subtle warning haptic
        triggerHaptic("light");
    }
    
    function hapticScore() {
        // Quick, satisfying haptic for score
        triggerHaptic("light");
    }
    
    function hapticLevelUp() {
        // Celebratory haptic pattern
        triggerHaptic("success");
        setTimeout(() => {
            if (settings.haptics) {
                triggerHaptic("medium");
            }
        }, 150);
    }
    
    // Play milestone sound (100, 200, 300, etc.)
    function playMilestoneSound() {
        // Pleasant ascending arpeggio
        const notes = [440, 523.25, 659.25]; // A4, C5, E5
        notes.forEach((freq, i) => {
            setTimeout(() => {
                createTone(freq, 0.15, {
                    type: 'sine',
                    volume: 0.25,
                    attack: 0.01,
                    decay: 0.05,
                    release: 0.09
                });
            }, i * 80);
        });
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
        if (!audioContext || !settings.fx) return;
        createTone(523, 0.2, { type: 'sine', volume: 0.3 });
        setTimeout(() => createTone(659, 0.2, { type: 'sine', volume: 0.3 }), 150);
        setTimeout(() => createTone(784, 0.3, { type: 'sine', volume: 0.3 }), 300);
        setTimeout(() => createTone(1047, 0.4, { type: 'sine', volume: 0.3 }), 450);
    }
    
    // Play background music - improved with proper looping and musical structure
    function playBackgroundMusic() {
        if (!audioContext || backgroundMusicPlaying || !settings.music) return;
        
        backgroundMusicPlaying = true;
        backgroundMusicNodes = [];
        
        const now = audioContext.currentTime;
        const loopDuration = 8; // 8 second loop
        
        // Create bass layer (A2 = 110Hz) - continuous
        function createBassLayer() {
            if (!gameRunning || !backgroundMusicPlaying || !settings.music) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            
            filter.type = 'lowpass';
            filter.frequency.value = 200;
            filter.Q.value = 1;
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(musicGainNode);
            
            oscillator.frequency.value = 110; // A2
            oscillator.type = 'sine';
            
            const currentTime = audioContext.currentTime;
            gainNode.gain.setValueAtTime(0.08, currentTime);
            
            oscillator.start(currentTime);
            
            // Schedule stop and restart for looping
            oscillator.stop(currentTime + loopDuration);
            
            setTimeout(() => {
                if (gameRunning && backgroundMusicPlaying && settings.music) {
                    createBassLayer();
                }
            }, loopDuration * 1000);
            
            backgroundMusicNodes.push({ oscillator, gainNode, filter });
        }
        
        // Create harmony layer (A3 = 220Hz) - with subtle variation
        function createHarmonyLayer() {
            if (!gameRunning || !backgroundMusicPlaying || !settings.music) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(musicGainNode);
            
            oscillator.frequency.value = 220; // A3
            oscillator.type = 'triangle';
            
            const currentTime = audioContext.currentTime;
            // Subtle volume variation
            gainNode.gain.setValueAtTime(0.05, currentTime);
            gainNode.gain.linearRampToValueAtTime(0.06, currentTime + loopDuration / 2);
            gainNode.gain.linearRampToValueAtTime(0.05, currentTime + loopDuration);
            
            oscillator.start(currentTime);
            oscillator.stop(currentTime + loopDuration);
            
            setTimeout(() => {
                if (gameRunning && backgroundMusicPlaying && settings.music) {
                    createHarmonyLayer();
                }
            }, loopDuration * 1000);
            
            backgroundMusicNodes.push({ oscillator, gainNode });
        }
        
        // Create melody layer - simple pattern
        function createMelodyLayer() {
            if (!gameRunning || !backgroundMusicPlaying || !settings.music) return;
            
            const melody = [
                { freq: 330, time: 0, duration: 1.5 },    // E4
                { freq: 392, time: 2, duration: 1.5 },   // G4
                { freq: 440, time: 4, duration: 1.5 },   // A4
                { freq: 392, time: 6, duration: 2 }        // G4
            ];
            
            melody.forEach(note => {
                setTimeout(() => {
                    if (!gameRunning || !backgroundMusicPlaying || !settings.music) return;
                    
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(musicGainNode);
                    
                    oscillator.frequency.value = note.freq;
                    oscillator.type = 'sine';
                    
                    const currentTime = audioContext.currentTime;
                    gainNode.gain.setValueAtTime(0, currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.04, currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.04, currentTime + note.duration - 0.2);
                    gainNode.gain.linearRampToValueAtTime(0, currentTime + note.duration);
                    
                    oscillator.start(currentTime);
                    oscillator.stop(currentTime + note.duration);
                    
                    backgroundMusicNodes.push({ oscillator, gainNode });
                }, note.time * 1000);
            });
            
            setTimeout(() => {
                if (gameRunning && backgroundMusicPlaying && settings.music) {
                    createMelodyLayer();
                }
            }, loopDuration * 1000);
        }
        
        // Create rhythm accent (every 2 seconds)
        function createRhythmAccent() {
            if (!gameRunning || !backgroundMusicPlaying || !settings.music) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            
            filter.type = 'lowpass';
            filter.frequency.value = 600;
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(musicGainNode);
            
            oscillator.frequency.value = 440; // A4
            oscillator.type = 'sine';
            
            const currentTime = audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, currentTime);
            gainNode.gain.linearRampToValueAtTime(0.03, currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.15);
            
            oscillator.start(currentTime);
            oscillator.stop(currentTime + 0.15);
            
            backgroundMusicNodes.push({ oscillator, gainNode, filter });
            
            setTimeout(() => {
                if (gameRunning && backgroundMusicPlaying && settings.music) {
                    createRhythmAccent();
                }
            }, 2000);
        }
        
        // Start all layers with slight delays for smooth fade-in
        createBassLayer();
        setTimeout(() => createHarmonyLayer(), 500);
        setTimeout(() => createMelodyLayer(), 1000);
        setTimeout(() => createRhythmAccent(), 1500);
    }
    
    // Stop background music
    function stopBackgroundMusic() {
        backgroundMusicPlaying = false;
        if (backgroundMusicInterval) {
            clearInterval(backgroundMusicInterval);
            backgroundMusicInterval = null;
        }
        backgroundMusicNodes.forEach(({ oscillator, gainNode }) => {
            try {
                if (gainNode) {
                    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                }
                if (oscillator) {
                    oscillator.stop();
                }
            } catch (e) {
                // Already stopped
            }
        });
        backgroundMusicNodes = [];
    }
    
    // Play start screen background music (lighter, ambient music)
    function playStartScreenMusic() {
        if (!audioContext || startScreenMusicPlaying || !settings.music) return;
        
        startScreenMusicPlaying = true;
        startScreenMusicNodes = [];
        
        const now = audioContext.currentTime;
        const loopDuration = 12; // 12 second loop for start screen
        
        // Create gentle ambient bass layer (A2 = 110Hz)
        function createStartBassLayer() {
            if (!startScreenMusicPlaying || !settings.music) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            
            filter.type = 'lowpass';
            filter.frequency.value = 150;
            filter.Q.value = 1;
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(musicGainNode);
            
            oscillator.frequency.value = 110; // A2
            oscillator.type = 'sine';
            
            const currentTime = audioContext.currentTime;
            gainNode.gain.setValueAtTime(0.05, currentTime); // Quieter for start screen
            
            oscillator.start(currentTime);
            oscillator.stop(currentTime + loopDuration);
            
            setTimeout(() => {
                if (startScreenMusicPlaying && settings.music) {
                    createStartBassLayer();
                }
            }, loopDuration * 1000);
            
            startScreenMusicNodes.push({ oscillator, gainNode, filter });
        }
        
        // Create gentle harmony layer (A3 = 220Hz)
        function createStartHarmonyLayer() {
            if (!startScreenMusicPlaying || !settings.music) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(musicGainNode);
            
            oscillator.frequency.value = 220; // A3
            oscillator.type = 'triangle';
            
            const currentTime = audioContext.currentTime;
            gainNode.gain.setValueAtTime(0.03, currentTime); // Very quiet
            
            oscillator.start(currentTime);
            oscillator.stop(currentTime + loopDuration);
            
            setTimeout(() => {
                if (startScreenMusicPlaying && settings.music) {
                    createStartHarmonyLayer();
                }
            }, loopDuration * 1000);
            
            startScreenMusicNodes.push({ oscillator, gainNode });
        }
        
        // Create subtle melody pattern
        function createStartMelodyLayer() {
            if (!startScreenMusicPlaying || !settings.music) return;
            
            const melody = [
                { freq: 330, time: 0, duration: 2 },    // E4
                { freq: 392, time: 3, duration: 2 },   // G4
                { freq: 440, time: 6, duration: 2 },   // A4
                { freq: 392, time: 9, duration: 3 }    // G4
            ];
            
            melody.forEach(note => {
                setTimeout(() => {
                    if (!startScreenMusicPlaying || !settings.music) return;
                    
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(musicGainNode);
                    
                    oscillator.frequency.value = note.freq;
                    oscillator.type = 'sine';
                    
                    const currentTime = audioContext.currentTime;
                    gainNode.gain.setValueAtTime(0, currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.02, currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0.02, currentTime + note.duration - 0.3);
                    gainNode.gain.linearRampToValueAtTime(0, currentTime + note.duration);
                    
                    oscillator.start(currentTime);
                    oscillator.stop(currentTime + note.duration);
                    
                    startScreenMusicNodes.push({ oscillator, gainNode });
                }, note.time * 1000);
            });
            
            setTimeout(() => {
                if (startScreenMusicPlaying && settings.music) {
                    createStartMelodyLayer();
                }
            }, loopDuration * 1000);
        }
        
        // Start all layers
        createStartBassLayer();
        setTimeout(() => createStartHarmonyLayer(), 1000);
        setTimeout(() => createStartMelodyLayer(), 2000);
    }
    
    // Stop start screen music
    function stopStartScreenMusic() {
        startScreenMusicPlaying = false;
        startScreenMusicNodes.forEach(({ oscillator, gainNode }) => {
            try {
                if (gainNode) {
                    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                }
                if (oscillator) {
                    oscillator.stop();
                }
            } catch (e) {
                // Already stopped
            }
        });
        startScreenMusicNodes = [];
    }
    
    // Show new record notification (removed - platform handles leaderboards)

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

    // Game configuration (defaults; pattern overrides per run)
    const gameSettings = {
        monsterSpawnRate: 0.015, // Reduced for more space
        monsterSpeed: 4.5,
        trailLength: 15,
        scoreRate: 0.1,
        scorePerSecond: 1,
        levelUpScore: 50,
        minSpawnDistance: 200 // Minimum distance between enemies when spawning
    };

    // Per-run pattern (like MMM Fingers: different each play)
    let gamePattern = null;
    let patternTime = 0;
    const MONSTER_KEYS = ['monster1', 'monster2', 'monster3', 'monster4'];

    const patternPresets = [
        {
            name: 'classic',
            levelUpScore: 50,
            monsterSpawnRate: 0.015,
            monsterSpeed: 4.5,
            monsterCycleOrder: [0, 1, 2, 3],
            spawnStyle: 'steady',
            horizontalDrift: 0.3,
            levelSpeedScale: 0.6,
            levelSpawnScale: 0.5
        },
        {
            name: 'reverse',
            levelUpScore: 45,
            monsterSpawnRate: 0.018,
            monsterSpeed: 4.8,
            monsterCycleOrder: [3, 2, 1, 0],
            spawnStyle: 'steady',
            horizontalDrift: 0.5,
            levelSpeedScale: 0.55,
            levelSpawnScale: 0.55
        },
        {
            name: 'burst',
            levelUpScore: 55,
            monsterSpawnRate: 0.012,
            monsterSpeed: 4.2,
            monsterCycleOrder: [1, 0, 3, 2],
            spawnStyle: 'burst',
            horizontalDrift: 0.25,
            levelSpeedScale: 0.5,
            levelSpawnScale: 0.45,
            burstChance: 0.05,
            burstCount: [2, 3]
        },
        {
            name: 'wave',
            levelUpScore: 40,
            monsterSpawnRate: 0.02,
            monsterSpeed: 4.6,
            monsterCycleOrder: [2, 3, 0, 1],
            spawnStyle: 'wave',
            horizontalDrift: 0.4,
            levelSpeedScale: 0.65,
            levelSpawnScale: 0.5,
            wavePeriod: 4
        },
        {
            name: 'chaos',
            levelUpScore: 35,
            monsterSpawnRate: 0.022,
            monsterSpeed: 5.0,
            monsterCycleOrder: [2, 0, 3, 1],
            spawnStyle: 'burst',
            horizontalDrift: 0.7,
            levelSpeedScale: 0.7,
            levelSpawnScale: 0.6,
            burstChance: 0.06,
            burstCount: [2, 4]
        },
        {
            name: 'slowburn',
            levelUpScore: 60,
            monsterSpawnRate: 0.01,
            monsterSpeed: 3.8,
            monsterCycleOrder: [0, 2, 1, 3],
            spawnStyle: 'steady',
            horizontalDrift: 0.2,
            levelSpeedScale: 0.45,
            levelSpawnScale: 0.4
        }
    ];

    function pickRandomPattern(excludeName) {
        const pool = excludeName
            ? patternPresets.filter(function (p) { return p.name !== excludeName; })
            : patternPresets;
        if (pool.length === 0) return patternPresets[Math.floor(Math.random() * patternPresets.length)];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Get current level based on score (uses pattern)
    function getCurrentLevel() {
        const step = gamePattern ? gamePattern.levelUpScore : gameSettings.levelUpScore;
        return Math.floor(score / step) + 1;
    }

    // Get available monster types - now returns ALL types for variety
    function getMonsterTypesForLevel() {
        // Return all monster types mixed together for variety
        const allTypes = [];
        MONSTER_KEYS.forEach(key => {
            allTypes.push(...monsterTypeDefinitions[key]);
        });
        return allTypes;
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

    // Check if a position is too close to existing monsters
    // Focus on horizontal spacing for enemies near the top of screen
    function isPositionValid(x, y, minDistance) {
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            // Only check spacing for enemies in the top portion of screen (where new ones spawn)
            if (m.y < canvas.height * 0.3) {
                const dx = x - m.x;
                const dy = y - m.y;
                // Weight horizontal distance more heavily
                const horizontalDistance = Math.abs(dx);
                const verticalDistance = Math.abs(dy);
                // If horizontally close and vertically close, reject
                if (horizontalDistance < minDistance * 0.7 && verticalDistance < minDistance) {
                    return false;
                }
            }
        }
        return true;
    }

    function addOneMonster(atX) {
        const availableTypes = getMonsterTypesForLevel();
        const typeDef = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        const size = typeDef.size;
        const p = gamePattern || {};
        const baseSpeed = p.monsterSpeed != null ? p.monsterSpeed : gameSettings.monsterSpeed;
        const speedScale = (p.levelSpeedScale != null ? p.levelSpeedScale : 0.6);
        const drift = (p.horizontalDrift != null ? p.horizontalDrift : 0.3);
        
        // Try to find a valid spawn position with spacing
        let x, y;
        let attempts = 0;
        const maxAttempts = 10;
        const minDistance = gameSettings.minSpawnDistance;
        
        if (atX != null) {
            // If position is provided (burst spawn), use it but check spacing
            x = atX;
            y = -size;
            if (!isPositionValid(x, y, minDistance)) {
                // Try nearby positions
                let found = false;
                for (let offset = -150; offset <= 150 && !found; offset += 50) {
                    const testX = Math.max(size, Math.min(canvas.width - size, x + offset));
                    if (isPositionValid(testX, y, minDistance)) {
                        x = testX;
                        found = true;
                    }
                }
                if (!found) return; // Skip spawn if can't find space
            }
        } else {
            // Random spawn - ensure spacing
            do {
                x = Math.random() * canvas.width;
                y = -size;
                attempts++;
            } while (!isPositionValid(x, y, minDistance) && attempts < maxAttempts);
            
            if (attempts >= maxAttempts) {
                return; // Skip spawn if can't find valid position
            }
        }
        
        const vx = (Math.random() - 0.5) * 2 * drift;
        const vy = baseSpeed * (1 + (level - 1) * speedScale) + Math.random() * 0.8;
        monsters.push({
            x: x, y: y, vx: vx, vy: vy, typeDef: typeDef,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.14 + Math.random() * 0.12)
        });
    }

    // Spawn monster - pattern determines rate, style (steady / burst / wave)
    function spawnMonster() {
        const p = gamePattern || {};
        const baseRate = p.monsterSpawnRate != null ? p.monsterSpawnRate : gameSettings.monsterSpawnRate;
        const spawnScale = p.levelSpawnScale != null ? p.levelSpawnScale : 0.5;
        let spawnRate = baseRate * (1 + (level - 1) * spawnScale);

        if (p.spawnStyle === 'wave' && p.wavePeriod) {
            const t = patternTime * 0.001;
            const wave = 0.5 + 0.5 * Math.sin((2 * Math.PI / p.wavePeriod) * t);
            spawnRate *= 0.4 + 0.6 * wave;
        }

        if (Math.random() < spawnRate) {
            addOneMonster();
        }

        if (p.spawnStyle === 'burst' && p.burstChance && Math.random() < p.burstChance) {
            const [minB, maxB] = p.burstCount || [2, 3];
            const n = minB + Math.floor(Math.random() * (maxB - minB + 1));
            const baseX = Math.random() * canvas.width;
            for (let i = 0; i < n; i++) {
                const offset = (Math.random() - 0.5) * 120;
                addOneMonster(Math.max(40, Math.min(canvas.width - 40, baseX + offset)));
            }
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
        const fingerRadius = Math.min(finger.imageWidth || finger.width, finger.imageHeight || finger.height) * 0.12; // 12% of smaller dimension - enemies must actually touch
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
        patternTime += clampedDelta;

        // Update score (survival-based - increases automatically)
        scoreTimer += clampedDelta;
        if (scoreTimer >= 1000 / gameSettings.scorePerSecond) { // Score increases every second
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
            if (levelBadgeEl) {
                levelBadgeEl.textContent = 'Lv.' + level;
            }
        }

        // Update finger position (smooth movement)
        const diffX = finger.targetX - finger.x;
        const diffY = finger.targetY - finger.y;
        finger.x += diffX * 0.18;
        finger.y += diffY * 0.18;

        // Keep finger within bounds
        finger.x = Math.max(finger.width / 2, Math.min(canvas.width - finger.width / 2, finger.x));
        finger.y = Math.max(finger.height / 2, Math.min(canvas.height - finger.height / 2, finger.y));

        // Update trail
        finger.trail.push({ x: finger.x, y: finger.y });
        if (finger.trail.length > gameSettings.trailLength) {
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

        // Update and draw monsters (they spin via rotation)
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
        patternTime = 0;
        gamePattern = pickRandomPattern(gamePattern ? gamePattern.name : null);
        monsters.length = 0;
        particles.length = 0;
        gameRunning = true;
        lastTime = performance.now();
        backgroundAnimationTime = 0;
        scoreEl.textContent = '0';
        if (levelBadgeEl) levelBadgeEl.textContent = 'Lv.1';
        gameOverEl.style.display = 'none';
        newRecordEl.style.display = 'none';
        // Hide start screen and corner buttons
        if (startScreenEl) {
            startScreenEl.style.display = 'none';
        }
        
        // Hide corner buttons when game is running
        const topLeftButtons = document.querySelector('.top-left-buttons');
        const topRightButtons = document.querySelector('.top-right-buttons');
        if (topLeftButtons) {
            topLeftButtons.style.display = 'none';
        }
        if (topRightButtons) {
            topRightButtons.style.display = 'none';
        }
        
        // Show achievements and more games buttons when game starts (they're hidden on start screen)
        if (achievementsBtn) {
            achievementsBtn.style.display = 'flex';
        }
        if (moreGamesBtn) {
            moreGamesBtn.style.display = 'flex';
        }
        
        // Hide final score container on start screen
        const finalScoreContainer = document.getElementById('finalScoreContainer');
        if (finalScoreContainer) {
            finalScoreContainer.style.display = 'none';
        }
        
        // Show game elements
        if (canvas) {
            canvas.style.visibility = 'visible';
            canvas.style.pointerEvents = 'auto';
        }
        if (scoreEl && scoreEl.parentElement) {
            scoreEl.parentElement.style.visibility = 'visible';
            scoreEl.parentElement.style.pointerEvents = 'auto';
        }
        const instructionsEl = document.getElementById('instructions');
        if (instructionsEl) {
            instructionsEl.style.visibility = 'visible';
        }
        
        initFinger();
        initBackgroundParticles();
        
        // Stop start screen music and start game music
        stopStartScreenMusic();
        
        // Resume audio context and start background music
        if (audioContext) {
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    if (settings.music) {
                        playBackgroundMusic();
                    }
                });
            } else if (settings.music) {
                playBackgroundMusic();
            }
        }
        
        animationId = requestAnimationFrame(gameLoop);
    }

    // End game
    function endGame() {
        gameRunning = false;
        stopBackgroundMusic();
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        // Play dramatic game over sound (better than collision sound)
        playGameOverSound();
        
        // Submit score to Oasiz platform
        if (typeof (window).submitScore === "function") {
            (window).submitScore(score);
        }
        
        // Update best score
        saveBestScore(score);
        
        // Hide game elements
        if (canvas) {
            canvas.style.visibility = 'hidden';
            canvas.style.pointerEvents = 'none';
        }
        if (scoreEl && scoreEl.parentElement) {
            scoreEl.parentElement.style.visibility = 'hidden';
            scoreEl.parentElement.style.pointerEvents = 'none';
        }
        const instructionsEl = document.getElementById('instructions');
        if (instructionsEl) {
            instructionsEl.style.visibility = 'hidden';
        }
        
        // Hide game over modal
        if (gameOverEl) {
            gameOverEl.style.display = 'none';
        }
        
        // Show start screen with scores
        if (startScreenEl) {
            // Update final score display
            const finalScoreDisplay = document.getElementById('finalScoreDisplay');
            const finalScoreContainer = document.getElementById('finalScoreContainer');
            if (finalScoreDisplay) {
                finalScoreDisplay.textContent = score.toString();
            }
            if (finalScoreContainer) {
                finalScoreContainer.style.display = 'flex';
            }
            
            // Update best score display (already updated by saveBestScore)
            if (bestScoreDisplay) {
                bestScoreDisplay.textContent = bestScore.toString();
            }
            
            // Start start screen music
            playStartScreenMusic();
            
            // Show corner buttons (but hide unused ones on start screen)
            const topLeftButtons = document.querySelector('.top-left-buttons');
            const topRightButtons = document.querySelector('.top-right-buttons');
            if (topLeftButtons) {
                topLeftButtons.style.display = 'flex';
                // Hide achievements button on start screen
                if (achievementsBtn) {
                    achievementsBtn.style.display = 'none';
                }
            }
            if (topRightButtons) {
                topRightButtons.style.display = 'flex';
                // Hide more games button on start screen
                if (moreGamesBtn) {
                    moreGamesBtn.style.display = 'none';
                }
            }
            
            startScreenEl.style.display = 'flex';
            
            // Start start screen music
            playStartScreenMusic();
        }
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

    if (restartBtn) {
        restartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Hide game over modal
            if (gameOverEl) {
                gameOverEl.style.display = 'none';
            }
            
            // Show start screen with current scores
            if (startScreenEl) {
            // Show corner buttons (but hide unused ones on start screen)
            const topLeftButtons = document.querySelector('.top-left-buttons');
            const topRightButtons = document.querySelector('.top-right-buttons');
            if (topLeftButtons) {
                topLeftButtons.style.display = 'flex';
                // Hide achievements button on start screen
                if (achievementsBtn) {
                    achievementsBtn.style.display = 'none';
                }
            }
            if (topRightButtons) {
                topRightButtons.style.display = 'flex';
                // Hide more games button on start screen
                if (moreGamesBtn) {
                    moreGamesBtn.style.display = 'none';
                }
            }
                
            startScreenEl.style.display = 'flex';
            }
            
            // Hide game elements
            if (canvas) {
                canvas.style.visibility = 'hidden';
                canvas.style.pointerEvents = 'none';
            }
            if (scoreEl && scoreEl.parentElement) {
                scoreEl.parentElement.style.visibility = 'hidden';
                scoreEl.parentElement.style.pointerEvents = 'none';
            }
            const instructionsEl = document.getElementById('instructions');
            if (instructionsEl) {
                instructionsEl.style.visibility = 'hidden';
            }
            
            // Reset game state
            gameRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            stopBackgroundMusic();
            
            // Start start screen music
            if (settings.music) {
                playStartScreenMusic();
            }
            
            triggerHaptic("light");
        });
    }

    // Prevent default touch behaviors (but allow canvas touchmove)
    document.addEventListener('touchmove', function(e) {
        if (e.target !== canvas && !canvas.contains(e.target)) {
            e.preventDefault();
        }
    }, { passive: false });

    // Settings modal functionality
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (settingsModal) {
                settingsModal.style.display = 'flex';
                triggerHaptic("light");
            }
        });
    }
    
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (settingsModal) {
                settingsModal.style.display = 'none';
                triggerHaptic("light");
            }
        });
    }
    
    // Close settings modal when clicking outside
    if (settingsModal) {
        settingsModal.addEventListener('click', function(e) {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });
    }
    
    // Helper function to update sound toggle icon
    function updateSoundToggleIcon() {
        const soundOnIcon = document.getElementById('soundOnIcon');
        const soundOffIcon = document.getElementById('soundOffIcon');
        if (soundOnIcon && soundOffIcon) {
            const isMuted = !settings.music && !settings.fx;
            if (isMuted) {
                soundOnIcon.style.display = 'none';
                soundOffIcon.style.display = 'block';
            } else {
                soundOnIcon.style.display = 'block';
                soundOffIcon.style.display = 'none';
            }
        }
    }
    
    // Sound toggle button (top right) - toggles both music and FX
    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if currently muted (both are off)
            const currentlyMuted = !settings.music && !settings.fx;
            
            // Toggle: if muted, unmute; if not muted, mute
            settings.music = currentlyMuted;
            settings.fx = currentlyMuted;
            
            // Update checkboxes
            if (musicToggle) musicToggle.checked = settings.music;
            if (fxToggle) fxToggle.checked = settings.fx;
            
            saveSettings();
            
            // Update icon
            updateSoundToggleIcon();
            
            // Update audio - stop all music if muting
            if (!settings.music) {
                stopBackgroundMusic();
                stopStartScreenMusic();
            } else if (audioContext) {
                // Unmuting - resume audio context and play appropriate music
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                if (gameRunning) {
                    playBackgroundMusic();
                } else if (startScreenEl && startScreenEl.style.display !== 'none') {
                    // On start screen, play start screen music
                    playStartScreenMusic();
                }
            }
            
            triggerHaptic("light");
        });
        
        // Initialize icon state
        updateSoundToggleIcon();
    }
    
    // Achievements button (placeholder)
    if (achievementsBtn) {
        achievementsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            triggerHaptic("light");
            // Placeholder - could open leaderboard or achievements
            alert('Achievements coming soon!');
        });
    }
    
    // More games button (placeholder)
    if (moreGamesBtn) {
        moreGamesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            triggerHaptic("light");
            // Placeholder - could navigate to more games
            alert('More games coming soon!');
        });
    }
    
    // Settings toggle handlers
    if (musicToggle) {
        musicToggle.addEventListener('change', function() {
            settings.music = this.checked;
            saveSettings();
            
            // Update sound toggle icon
            updateSoundToggleIcon();
            
            if (!settings.music) {
                stopBackgroundMusic();
                stopStartScreenMusic();
            } else if (audioContext) {
                // Resume audio context if suspended
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                if (gameRunning) {
                    playBackgroundMusic();
                } else if (startScreenEl && startScreenEl.style.display !== 'none') {
                    // If on start screen, play start screen music
                    playStartScreenMusic();
                }
            }
            triggerHaptic("light");
        });
    }
    
    if (fxToggle) {
        fxToggle.addEventListener('change', function() {
            settings.fx = this.checked;
            saveSettings();
            
            // Update sound toggle icon
            updateSoundToggleIcon();
            
            // Play a test sound when enabling
            if (settings.fx && audioContext) {
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                createTone(440, 0.1, {
                    type: 'sine',
                    volume: 0.2,
                    attack: 0.01,
                    release: 0.09
                });
            }
            triggerHaptic("light");
        });
    }
    
    if (hapticsToggle) {
        hapticsToggle.addEventListener('change', function() {
            settings.haptics = this.checked;
            saveSettings();
            if (settings.haptics) {
                triggerHaptic("light");
            }
        });
    }
    
    // Initialize
    loadSettings();
    initAudio();
    loadBestScore(); // Load and display best score from localStorage
    
    // Initialize sound toggle icon state after settings are loaded
    updateSoundToggleIcon();
    
    // Load images and then initialize
    loadImages().then(() => {
        initFinger();
        
        // Show start screen initially and hide game elements
        if (startScreenEl) {
            startScreenEl.style.display = 'flex';
        }
        
        // Show corner buttons on start screen (but hide unused ones)
        const topLeftButtons = document.querySelector('.top-left-buttons');
        const topRightButtons = document.querySelector('.top-right-buttons');
        if (topLeftButtons) {
            topLeftButtons.style.display = 'flex';
            // Hide achievements button on start screen (not functional)
            if (achievementsBtn) {
                achievementsBtn.style.display = 'none';
            }
        }
        if (topRightButtons) {
            topRightButtons.style.display = 'flex';
            // Hide more games button on start screen (not functional)
            if (moreGamesBtn) {
                moreGamesBtn.style.display = 'none';
            }
        }
        
        // Hide final score container initially
        const finalScoreContainer = document.getElementById('finalScoreContainer');
        if (finalScoreContainer) {
            finalScoreContainer.style.display = 'none';
        }
        
        // Start start screen music
        if (audioContext && settings.music) {
            if (audioContext.state === 'suspended') {
                // Will resume on user interaction
            } else {
                playStartScreenMusic();
            }
        }
        
        // Hide game elements when start screen is visible
        if (canvas) {
            canvas.style.visibility = 'hidden';
            canvas.style.pointerEvents = 'none';
        }
        if (scoreEl && scoreEl.parentElement) {
            scoreEl.parentElement.style.visibility = 'hidden';
            scoreEl.parentElement.style.pointerEvents = 'none';
        }
        const instructionsEl = document.getElementById('instructions');
        if (instructionsEl) {
            instructionsEl.style.visibility = 'hidden';
        }
        
        // Start game function
        function beginGame() {
            // Resume audio context if suspended (required for user interaction)
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    stopStartScreenMusic(); // Stop start screen music
                    startGame();
                }).catch(() => {
                    stopStartScreenMusic();
                    startGame();
                });
            } else {
                stopStartScreenMusic(); // Stop start screen music
                startGame();
            }
        }
        
        // Tap/Click anywhere to start game
        function startGameOnInteraction(e) {
            if (startScreenEl && startScreenEl.style.display !== 'none') {
                e.preventDefault();
                e.stopPropagation();
                beginGame();
            }
        }
        
        // Start game on tap/click anywhere on start screen or canvas
        if (startScreenEl) {
            startScreenEl.addEventListener('touchstart', startGameOnInteraction, { passive: false });
            startScreenEl.addEventListener('click', startGameOnInteraction);
        }
        
        canvas.addEventListener('touchstart', startGameOnInteraction, { passive: false });
        canvas.addEventListener('click', startGameOnInteraction);
    });
})();
