
(function() {
    'use strict';

    // Get canvas and context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const gameOverEl = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');
    const restartBtn = document.getElementById('restartBtn');

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
    let gameRunning = false;
    let animationId = null;
    let lastTime = 0;

    // Character properties
    const character = {
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        mouthOpen: false,
        mouthOpenTime: 0,
        mouthOpenDuration: 200 // ms
    };

    // Food items
    const foods = [];
    const foodTypes = [
        { color: '#FF6B6B', points: 10, size: 20 },
        { color: '#4ECDC4', points: 15, size: 25 },
        { color: '#FFE66D', points: 20, size: 30 },
        { color: '#95E1D3', points: 25, size: 35 }
    ];

    // Game settings
    const settings = {
        foodSpawnRate: 0.02, // probability per frame
        foodSpeed: 2,
        gravity: 0.1
    };

    // Initialize character position
    function initCharacter() {
        character.x = canvas.width / 2 - character.width / 2;
        character.y = canvas.height - character.height - 20;
    }

    // Draw character
    function drawCharacter() {
        const centerX = character.x + character.width / 2;
        const centerY = character.y + character.height / 2;

        // Body (circle)
        ctx.fillStyle = '#FF6B9D';
        ctx.beginPath();
        ctx.arc(centerX, centerY, character.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(centerX - 15, centerY - 15, 8, 0, Math.PI * 2);
        ctx.arc(centerX + 15, centerY - 15, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(centerX - 15, centerY - 15, 4, 0, Math.PI * 2);
        ctx.arc(centerX + 15, centerY - 15, 4, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        if (character.mouthOpen) {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(centerX, centerY + 10, 25, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Closed mouth (line)
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(centerX - 20, centerY + 10);
            ctx.lineTo(centerX + 20, centerY + 10);
            ctx.stroke();
        }
    }

    // Spawn food
    function spawnFood() {
        if (Math.random() < settings.foodSpawnRate) {
            const type = foodTypes[Math.floor(Math.random() * foodTypes.length)];
            foods.push({
                x: Math.random() * (canvas.width - type.size),
                y: -type.size,
                vx: (Math.random() - 0.5) * 1,
                vy: settings.foodSpeed + Math.random() * 1,
                type: type,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1
            });
        }
    }

    // Draw food
    function drawFood(food) {
        ctx.save();
        ctx.translate(food.x + food.type.size / 2, food.y + food.type.size / 2);
        ctx.rotate(food.rotation);
        ctx.fillStyle = food.type.color;
        ctx.beginPath();
        ctx.arc(0, 0, food.type.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Update food
    function updateFood(food, deltaTime) {
        // Use frame-based movement for consistent performance
        food.x += food.vx;
        food.y += food.vy;
        food.vy += settings.gravity;
        food.rotation += food.rotationSpeed;

        // Check collision with character
        if (character.mouthOpen) {
            const charCenterX = character.x + character.width / 2;
            const charCenterY = character.y + character.height / 2;
            const foodCenterX = food.x + food.type.size / 2;
            const foodCenterY = food.y + food.type.size / 2;
            const distance = Math.sqrt(
                Math.pow(charCenterX - foodCenterX, 2) + 
                Math.pow(charCenterY - foodCenterY, 2)
            );

            if (distance < character.width / 2 + food.type.size / 2) {
                score += food.type.points;
                scoreEl.textContent = `Score: ${score}`;
                return { remove: true, gameOver: false }; // Remove food, no game over
            }
        }

        // Check if food hit ground
        if (food.y > canvas.height) {
            return { remove: true, gameOver: true }; // Remove food, game over
        }

        return { remove: false, gameOver: false }; // Keep food
    }

    // Game loop - optimized for iOS Safari/WKWebView
    function gameLoop(currentTime) {
        if (!gameRunning) return;

        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // Limit delta time to prevent large jumps
        const clampedDelta = Math.min(deltaTime, 50);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update character mouth
        if (character.mouthOpen) {
            character.mouthOpenTime += clampedDelta;
            if (character.mouthOpenTime >= character.mouthOpenDuration) {
                character.mouthOpen = false;
                character.mouthOpenTime = 0;
            }
        }

        // Spawn food
        spawnFood();

        // Update and draw foods
        for (let i = foods.length - 1; i >= 0; i--) {
            const food = foods[i];
            const result = updateFood(food, deltaTime);
            if (result.remove) {
                foods.splice(i, 1);
                // Check if food hit ground (game over condition)
                if (result.gameOver) {
                    endGame();
                    return;
                }
            } else {
                drawFood(food);
            }
        }

        // Draw character
        drawCharacter();

        animationId = requestAnimationFrame(gameLoop);
    }

    // Start game
    function startGame() {
        score = 0;
        foods.length = 0;
        gameRunning = true;
        lastTime = performance.now();
        scoreEl.textContent = `Score: 0`;
        gameOverEl.style.display = 'none';
        initCharacter();
        animationId = requestAnimationFrame(gameLoop);
    }

    // End game
    function endGame() {
        gameRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        finalScoreEl.textContent = `Final Score: ${score}`;
        gameOverEl.style.display = 'block';
    }

    // Open mouth on tap/click
    function openMouth() {
        if (!gameRunning) return;
        character.mouthOpen = true;
        character.mouthOpenTime = 0;
    }

    // Event listeners - optimized for mobile
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        openMouth();
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('mousedown', function(e) {
        e.preventDefault();
        openMouth();
    });

    restartBtn.addEventListener('click', function(e) {
        e.preventDefault();
        startGame();
    });

    // Prevent default touch behaviors
    document.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });

    // Initialize
    initCharacter();
    startGame();
})();
