// --- Basic Setup ---
let scene, camera, renderer;
let plane, clock, rings = [], mountains = [], skyscrapers = [], houses = [], clouds = [], roads = [];
let ground;
let score = 0;
let scoreElement = document.getElementById('info');
let planeSpeed = 0.6; // Slightly increased speed for scenery effect
let planeTurnSpeed = 0.03;
let highScore = localStorage.getItem('planeGameHighScore') || 0;

// Game States
const GAME_STATES = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};
let currentGameState = GAME_STATES.START;

// UI Elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const pauseScreen = document.getElementById('pauseScreen');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const resumeButton = document.getElementById('resumeButton');
const restartFromPauseButton = document.getElementById('restartFromPauseButton');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const finalScore = document.getElementById('finalScore');
const finalHighScore = document.getElementById('finalHighScore');
const speedDisplay = document.getElementById('speedDisplay');

// Input state
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;
let touchDeltaX = 0;
let touchDeltaY = 0;
let touchSensitivity = 5; // Default sensitivity (1-10 scale)

// Screen shake effect
let shakeIntensity = 0;
let shakeDecay = 0.9;
let originalCameraPosition = null;

// Particle system
let particles = [];
const MAX_PARTICLES = 50;

// --- Game State Management ---
function setGameState(newState) {
    // Hide all screens
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    pauseScreen.classList.remove('active');

    // Update HUD visibility based on state
    const hudElements = [scoreElement, speedDisplay, document.getElementById('settings'), document.getElementById('instructions')];
    const shouldShowHUD = newState === GAME_STATES.PLAYING || newState === GAME_STATES.PAUSED;

    hudElements.forEach(element => {
        element.style.display = shouldShowHUD ? 'block' : 'none';
    });

    // Show appropriate screen
    currentGameState = newState;
    switch(newState) {
        case GAME_STATES.START:
            startScreen.classList.add('active');
            highScoreDisplay.textContent = `High Score: ${highScore}`;
            break;
        case GAME_STATES.PLAYING:
            // Game is running
            break;
        case GAME_STATES.PAUSED:
            pauseScreen.classList.add('active');
            break;
        case GAME_STATES.GAME_OVER:
            gameOverScreen.classList.add('active');
            finalScore.textContent = `Score: ${score}`;
            finalHighScore.textContent = `High Score: ${highScore}`;
            break;
    }
}

function startGame() {
    resetGame();
    setGameState(GAME_STATES.PLAYING);
}

function resetGame() {
    score = 0;
    scoreElement.innerText = `Score: ${score}`;
    planeSpeed = 0.6;
    planeTurnSpeed = 0.03;

    // Reset speed display
    speedDisplay.textContent = 'Speed: 1.0x';

    // Reset plane position
    if (plane) {
        plane.position.set(0, 0, 0);
        plane.rotation.set(0, 0, 0);
    }

    // Clear all objects and respawn
    rings.forEach(ring => scene.remove(ring));
    skyscrapers.forEach(obj => scene.remove(obj));
    houses.forEach(obj => scene.remove(obj));
    roads.forEach(obj => scene.remove(obj));
    mountains.forEach(obj => scene.remove(obj));
    clouds.forEach(cloud => scene.remove(cloud));
    particles.forEach(particle => scene.remove(particle));

    rings = [];
    skyscrapers = [];
    houses = [];
    roads = [];
    mountains = [];
    clouds = [];
    particles = [];

    spawnInitialRings(10);
    spawnInitialScenery(8, 'skyscraper');
    spawnInitialScenery(15, 'apartment');
    spawnInitialScenery(25, 'house');
    spawnInitialScenery(12, 'road');
    spawnInitialScenery(8, 'mountain');
}

function gameOver() {
    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('planeGameHighScore', highScore);
    }
    setGameState(GAME_STATES.GAME_OVER);
}

function togglePause() {
    if (currentGameState === GAME_STATES.PLAYING) {
        setGameState(GAME_STATES.PAUSED);
    } else if (currentGameState === GAME_STATES.PAUSED) {
        setGameState(GAME_STATES.PLAYING);
    }
}

function triggerScreenShake(intensity = 0.5) {
    shakeIntensity = intensity;
    if (!originalCameraPosition) {
        originalCameraPosition = camera.position.clone();
    }
}

function updateScreenShake() {
    if (shakeIntensity > 0.01) {
        // Apply random shake to camera position
        camera.position.x = originalCameraPosition.x + (Math.random() - 0.5) * shakeIntensity;
        camera.position.y = originalCameraPosition.y + (Math.random() - 0.5) * shakeIntensity;
        camera.position.z = originalCameraPosition.z + (Math.random() - 0.5) * shakeIntensity * 0.5;

        shakeIntensity *= shakeDecay;
    } else if (originalCameraPosition) {
        // Reset camera to original position when shake is done
        camera.position.copy(originalCameraPosition);
        shakeIntensity = 0;
    }
}

function createParticles(position, count = 10, color = 0xFFD700) {
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({ color: color });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);

        // Position particle at ring location with slight random offset
        particle.position.set(
            position.x + (Math.random() - 0.5) * 0.5,
            position.y + (Math.random() - 0.5) * 0.5,
            position.z + (Math.random() - 0.5) * 0.5
        );

        // Give particle random velocity
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2 + 0.1, // Slight upward bias
                (Math.random() - 0.5) * 0.2
            ),
            life: 60 // Frames to live
        };

        particles.push(particle);
        scene.add(particle);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        // Update position
        particle.position.add(particle.userData.velocity);

        // Apply gravity
        particle.userData.velocity.y -= 0.005;

        // Decrease life
        particle.userData.life--;

        // Remove dead particles
        if (particle.userData.life <= 0) {
            scene.remove(particle);
            particles.splice(i, 1);
        } else {
            // Fade out particle
            const alpha = particle.userData.life / 60;
            particle.material.opacity = alpha;
            particle.material.transparent = true;
        }
    }
}

function updateClouds(deltaTime) {
    for (let i = clouds.length - 1; i >= 0; i--) {
        const cloud = clouds[i];

        // Move clouds slowly
        cloud.position.z += planeSpeed * 20 * deltaTime; // Much slower than plane

        // Recycle clouds when they pass the camera
        if (cloud.position.z > camera.position.z + 20) {
            // Reposition cloud far behind
            cloud.position.z = camera.position.z - 80 - Math.random() * 50;
            cloud.position.x = (Math.random() - 0.5) * 100;
        }
    }
}

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    scene.fog = new THREE.Fog(0x87CEEB, 20, 150); // Increase fog slightly for distance effect

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Slightly brighter ambient
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9); // Slightly stronger sun
    directionalLight.position.set(10, 15, 10); // Adjust sun angle
    scene.add(directionalLight);

    // Clock
    clock = new THREE.Clock();

    // Create Game Objects
    createPlane();
    createGround();
    spawnInitialRings(10);
    spawnInitialScenery(8, 'skyscraper'); // Fewer skyscrapers
    spawnInitialScenery(15, 'apartment'); // More apartments
    spawnInitialScenery(25, 'house');    // Many houses for suburban feel
    spawnInitialScenery(12, 'road');     // Roads connecting areas
    spawnInitialScenery(8, 'mountain');  // Fewer mountains
    spawnInitialClouds(12); // Add some clouds

    // Event Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', onWindowResize);

    // UI Button Event Listeners
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    resumeButton.addEventListener('click', () => setGameState(GAME_STATES.PLAYING));
    restartFromPauseButton.addEventListener('click', startGame);

    // Touch event listeners
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Prevent default scrolling on the whole document for touch moves
    document.addEventListener('touchmove', function(event) {
        event.preventDefault();
    }, { passive: false });

    // Touch sensitivity slider
    const sensitivitySlider = document.getElementById('touchSensitivity');
    const sensitivityValue = document.getElementById('sensitivityValue');

    sensitivitySlider.addEventListener('input', function() {
        touchSensitivity = parseInt(this.value);
        sensitivityValue.textContent = touchSensitivity;
    });

    // Set initial game state
    setGameState(GAME_STATES.START);

    // Start Animation Loop
    animate();
}

// --- Game Objects ---
function createPlane() {
    // (Same as before)
    const planeGroup = new THREE.Group();
    const bodyGeometry = new THREE.ConeGeometry(0.3, 1, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, flatShading: true }); // Flat shading for low-poly look
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    planeGroup.add(body);
    const wingGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.5);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, flatShading: true });
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.75, 0, 0);
    planeGroup.add(leftWing);
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.75, 0, 0);
    planeGroup.add(rightWing);
    const tailGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.3);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0.25, -0.4);
    planeGroup.add(tail);

    plane = planeGroup;
    plane.position.set(0, 0, 0);
    scene.add(plane);
}

function createGround() {
    // Create a large ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x228B22, // Forest green
        flatShading: true,
        transparent: false
    });

    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
    ground.position.y = -5; // Position at ground level
    ground.position.z = -50; // Extend far behind the player
    scene.add(ground);
}

function createCloud(zPosition) {
    // Create a cloud made of multiple spheres
    const cloudGroup = new THREE.Group();
    const numSpheres = Math.floor(Math.random() * 5) + 3; // 3-7 spheres per cloud

    for (let i = 0; i < numSpheres; i++) {
        const radius = Math.random() * 2 + 1; // Random size spheres
        const geometry = new THREE.SphereGeometry(radius, 8, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        const sphere = new THREE.Mesh(geometry, material);

        // Position spheres relative to cloud center
        sphere.position.set(
            (Math.random() - 0.5) * 4, // Spread horizontally
            (Math.random() - 0.5) * 1 + 8 + Math.random() * 5, // High in sky
            (Math.random() - 0.5) * 2  // Slight depth variation
        );

        cloudGroup.add(sphere);
    }

    cloudGroup.position.x = (Math.random() - 0.5) * 100; // Wide spread
    cloudGroup.position.y = 0; // Y position handled by individual spheres
    cloudGroup.position.z = zPosition;

    clouds.push(cloudGroup);
    scene.add(cloudGroup);

    return cloudGroup;
}

function createRing(zPosition) {
    // (Same as before)
    const ringGeometry = new THREE.TorusGeometry(1.5, 0.2, 16, 50);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xccad00 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.x = (Math.random() - 0.5) * 15;
    ring.position.y = (Math.random() - 0.5) * 10 + 2;
    ring.position.z = zPosition;
    ring.userData = { passed: false };
    rings.push(ring);
    scene.add(ring);
}

function createSceneryObject(type, zPosition) {
    let object;
    const groundLevel = -5; // How low the base of the scenery sits

    if (type === 'skyscraper') {
        const height = Math.random() * 15 + 10; // Random height between 10 and 25
        const width = Math.random() * 2 + 1;   // Random width between 1 and 3
        const depth = Math.random() * 2 + 1;   // Random depth between 1 and 3
        const geometry = new THREE.BoxGeometry(width, height, depth);
        // Simple grey material, slightly varying shade
        const color = new THREE.Color(0x606060 + Math.random() * 0x202020);
        const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
        object = new THREE.Mesh(geometry, material);
        object.position.y = groundLevel + height / 2; // Position base at ground level
         // Place further out horizontally
        object.position.x = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 15 + 15); // 15 to 30 units left or right
    } else if (type === 'house') {
        const height = Math.random() * 3 + 2; // Random height between 2 and 5
        const width = Math.random() * 3 + 2;   // Random width between 2 and 5
        const depth = Math.random() * 2 + 3;   // Random depth between 3 and 5
        const geometry = new THREE.BoxGeometry(width, height, depth);
        // House colors - various colors like beige, brown, etc.
        const houseColors = [0x8B4513, 0xDEB887, 0xD2B48C, 0xBC8F8F, 0xCD853F];
        const color = houseColors[Math.floor(Math.random() * houseColors.length)];
        const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
        object = new THREE.Mesh(geometry, material);
        object.position.y = groundLevel + height / 2; // Position base at ground level
        object.position.x = (Math.random() - 0.5) * 20; // Closer to center for houses
    } else if (type === 'apartment') {
        const height = Math.random() * 8 + 5; // Random height between 5 and 13
        const width = Math.random() * 4 + 3;   // Random width between 3 and 7
        const depth = Math.random() * 3 + 2;   // Random depth between 2 and 5
        const geometry = new THREE.BoxGeometry(width, height, depth);
        // Apartment colors - greys and whites
        const aptColors = [0x708090, 0x778899, 0x696969, 0x808080, 0xA9A9A9];
        const color = aptColors[Math.floor(Math.random() * aptColors.length)];
        const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
        object = new THREE.Mesh(geometry, material);
        object.position.y = groundLevel + height / 2; // Position base at ground level
        object.position.x = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 10 + 8); // Medium distance
    } else if (type === 'mountain') {
        const radius = Math.random() * 5 + 5; // Base radius 5 to 10
        const height = Math.random() * 10 + 8; // Height 8 to 18
        const geometry = new THREE.ConeGeometry(radius, height, 8); // Low segment count for blocky look
         // Simple brown/grey material, varying shade
        const color = new THREE.Color(Math.random() < 0.6 ? 0x8B4513 : 0x696969).multiplyScalar(0.5 + Math.random() * 0.5); // Brown or Greyish
        const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
        object = new THREE.Mesh(geometry, material);
        object.position.y = groundLevel; // Base of cone sits at ground level
         // Place even further out
        object.position.x = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 20 + 30); // 30 to 50 units left or right
    } else if (type === 'road') {
        const length = Math.random() * 20 + 10; // Random length between 10 and 30
        const width = 2; // Fixed width for roads
        const geometry = new THREE.BoxGeometry(length, 0.1, width);
        // Dark gray asphalt color
        const material = new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true });
        object = new THREE.Mesh(geometry, material);
        object.position.y = -4.95; // Just above ground level
        object.position.x = (Math.random() - 0.5) * 40; // Spread across the landscape
    }

    if (object) {
        object.position.z = zPosition;
        object.userData = { type: type }; // Store type for potential differentiation later
        if (type === 'skyscraper' || type === 'house' || type === 'apartment') {
            if (type === 'house') houses.push(object);
            else skyscrapers.push(object); // Reuse skyscrapers array for apartments too
        }
        if (type === 'mountain') mountains.push(object);
        if (type === 'road') roads.push(object);
        scene.add(object);
    }
    return object; // Return the created object for recycling logic
}

 function getFurthestZ(objectArrays) {
    let furthestZ = 0;
    objectArrays.forEach(arr => {
        arr.forEach(obj => {
            if (obj.position.z < furthestZ) {
                furthestZ = obj.position.z;
            }
        });
    });
    return furthestZ;
}

function spawnInitialRings(count) {
     let currentZ = -10; // Starting Z position
    for (let i = 0; i < count; i++) {
        createRing(currentZ);
        currentZ -= (Math.random() * 10 + 10); // Space rings out randomly (10-20 units apart)
    }
}

function spawnInitialScenery(count, type) {
    let currentZ = -20; // Start scenery further back
    const spacing = type === 'mountain' ? 30 : type === 'skyscraper' ? 20 : type === 'road' ? 25 : 10; // Space mountains further apart, skyscrapers medium, roads medium, houses close
    for (let i = 0; i < count; i++) {
        createSceneryObject(type, currentZ);
        currentZ -= (Math.random() * spacing + spacing / 2);
    }
}

function spawnInitialClouds(count) {
    for (let i = 0; i < count; i++) {
        const zPos = -30 - (Math.random() * 100); // Spread clouds far back
        createCloud(zPos);
    }
}


// --- Game Logic ---
function updatePlaneMovement(deltaTime) {
    const moveSpeed = 5 * deltaTime;
    const turnAmount = planeTurnSpeed;

    // Handle keyboard input
    if (keys.ArrowUp) plane.position.y += moveSpeed;
    if (keys.ArrowDown) plane.position.y -= moveSpeed;
    if (keys.ArrowLeft) plane.position.x -= moveSpeed;
    if (keys.ArrowRight) plane.position.x += moveSpeed;

    // Handle touch input
    if (isTouching) {
        const sensitivityFactor = touchSensitivity / 5; // Convert 1-10 scale to a multiplier (1 = 0.2x, 5 = 1x, 10 = 2x)
        plane.position.x += touchDeltaX * moveSpeed * 0.1 * sensitivityFactor;
        plane.position.y += touchDeltaY * moveSpeed * 0.1 * sensitivityFactor;
    }

    plane.rotation.z = 0;
    plane.rotation.y = 0;
    plane.rotation.x = 0; // Reset pitch initially

    // Apply rotations based on keyboard
    if (keys.ArrowLeft) plane.rotation.z = turnAmount;
    if (keys.ArrowRight) plane.rotation.z = -turnAmount;
    if (keys.ArrowUp) plane.rotation.x = -turnAmount * 0.5;
    else if (keys.ArrowDown) plane.rotation.x = turnAmount * 0.5;

    // Apply rotations based on touch
    if (isTouching) {
        const sensitivityFactor = touchSensitivity / 5; // Convert 1-10 scale to a multiplier
        plane.rotation.z = -touchDeltaX * turnAmount * 0.02 * sensitivityFactor;
        plane.rotation.x = touchDeltaY * turnAmount * 0.02 * sensitivityFactor;
    }

    plane.position.x = Math.max(-12, Math.min(12, plane.position.x)); // Slightly wider bounds
    plane.position.y = Math.max(-6, Math.min(10, plane.position.y));

    // Check for collisions with scenery
    checkCollisions();
}

function checkCollisions() {
    // Create a bounding box for the plane (approximate)
    const planeBox = new THREE.Box3().setFromObject(plane);

    // Check collision with skyscrapers and apartments
    for (let skyscraper of skyscrapers) {
        const skyscraperBox = new THREE.Box3().setFromObject(skyscraper);
        if (planeBox.intersectsBox(skyscraperBox)) {
            triggerScreenShake(0.8); // Strong shake for collision
            gameOver();
            return;
        }
    }

    // Check collision with houses
    for (let house of houses) {
        const houseBox = new THREE.Box3().setFromObject(house);
        if (planeBox.intersectsBox(houseBox)) {
            triggerScreenShake(0.8); // Strong shake for collision
            gameOver();
            return;
        }
    }

    // Check collision with mountains
    for (let mountain of mountains) {
        const mountainBox = new THREE.Box3().setFromObject(mountain);
        if (planeBox.intersectsBox(mountainBox)) {
            triggerScreenShake(0.8); // Strong shake for collision
            gameOver();
            return;
        }
    }
}

function updateDifficulty() {
    // Increase speed and difficulty based on score
    const baseSpeed = 0.6;
    const speedIncrement = 0.02;
    const maxSpeed = 1.5;

    planeSpeed = Math.min(maxSpeed, baseSpeed + (score * speedIncrement));

    // Increase turn speed slightly as well
    const baseTurnSpeed = 0.03;
    const turnIncrement = 0.001;
    const maxTurnSpeed = 0.06;
    planeTurnSpeed = Math.min(maxTurnSpeed, baseTurnSpeed + (score * turnIncrement));

    // Update speed display
    const speedMultiplier = (planeSpeed / baseSpeed).toFixed(1);
    speedDisplay.textContent = `Speed: ${speedMultiplier}x`;
}

function updateRings(deltaTime, moveDistance) {
     const furthestZ = getFurthestZ([rings, skyscrapers, houses, mountains]); // Consider all objects for Z placement

     // Dynamic ring spacing based on score (rings get closer together at higher scores)
     const baseSpacing = 15;
     const minSpacing = 8;
     const spacingDecrement = 0.2;
     const ringSpacing = Math.max(minSpacing, baseSpacing - (score * spacingDecrement));

    for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.position.z += moveDistance;

        // Scoring Check (same as before)
        if (!ring.userData.passed && ring.position.z > plane.position.z) {
            const distanceX = Math.abs(plane.position.x - ring.position.x);
            const distanceY = Math.abs(plane.position.y - ring.position.y);
            const ringRadius = 1.5;
            if (distanceX < ringRadius && distanceY < ringRadius) {
                score++;
                scoreElement.innerText = `Score: ${score}`;

                // Update difficulty when score changes
                updateDifficulty();

                ring.userData.passed = true;
                ring.material.color.set(0x00ff00);
                ring.material.emissive.set(0x00cc00);

                // Create particles at ring position
                createParticles(ring.position, 8, 0xFFD700);
            } else {
                 ring.userData.passed = true;
                 ring.material.color.set(0x888888);
                 ring.material.emissive.set(0x333333);
            }
        }

        // Recycle Ring
        if (ring.position.z > camera.position.z + 10) {
            ring.position.x = (Math.random() - 0.5) * 15;
            ring.position.y = (Math.random() - 0.5) * 10 + 2;
            ring.position.z = furthestZ - (Math.random() * 10 + ringSpacing/1.5); // Place behind furthest object, add random spacing
            ring.userData.passed = false;
            ring.material.color.set(0xFFD700);
            ring.material.emissive.set(0xccad00);
        }
    }
}

function updateScenery(sceneryArray, deltaTime, moveDistance) {
     const furthestZ = getFurthestZ([rings, skyscrapers, houses, mountains]);
     const recycleDistance = camera.position.z + 30; // Recycle when further behind camera

    for (let i = sceneryArray.length - 1; i >= 0; i--) {
        const sceneryObject = sceneryArray[i];
        sceneryObject.position.z += moveDistance;

        // Recycle Scenery Object
        if (sceneryObject.position.z > recycleDistance) {
            const type = sceneryObject.userData.type;
            const groundLevel = -5;

            // Reposition based on type
            if (type === 'skyscraper') {
                 const height = Math.random() * 15 + 10;
                 sceneryObject.geometry = new THREE.BoxGeometry(Math.random() * 2 + 1, height, Math.random() * 2 + 1);
                 sceneryObject.position.y = groundLevel + height / 2;
                 sceneryObject.position.x = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 15 + 15);
            } else if (type === 'apartment') {
                 const height = Math.random() * 8 + 5;
                 sceneryObject.geometry = new THREE.BoxGeometry(Math.random() * 4 + 3, height, Math.random() * 3 + 2);
                 sceneryObject.position.y = groundLevel + height / 2;
                 sceneryObject.position.x = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 10 + 8);
            } else if (type === 'house') {
                 const height = Math.random() * 3 + 2;
                 sceneryObject.geometry = new THREE.BoxGeometry(Math.random() * 3 + 2, height, Math.random() * 2 + 3);
                 sceneryObject.position.y = groundLevel + height / 2;
                 sceneryObject.position.x = (Math.random() - 0.5) * 20;
            } else if (type === 'mountain') {
                 const radius = Math.random() * 5 + 5;
                 const height = Math.random() * 10 + 8;
                 sceneryObject.geometry = new THREE.ConeGeometry(radius, height, 8);
                 sceneryObject.position.y = groundLevel;
                 sceneryObject.position.x = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 20 + 30);
            }
            // Common repositioning
             sceneryObject.position.z = furthestZ - (Math.random() * 20 + 10); // Place far behind, add random spacing
        }
    }
}


function updateCamera() {
     // (Same as before)
     camera.position.x = plane.position.x * 0.2;
     camera.position.y = plane.position.y * 0.5 + 1.5;
     camera.position.z = plane.position.z + 5;
     const lookAtPosition = plane.position.clone();
     lookAtPosition.z -= 10;
     camera.lookAt(lookAtPosition);
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Only update game logic when playing
    if (currentGameState === GAME_STATES.PLAYING) {
        const deltaTime = clock.getDelta();
        const moveDistance = planeSpeed * 60 * deltaTime; // Consistent movement speed

        updatePlaneMovement(deltaTime);
        updateRings(deltaTime, moveDistance);
        updateScenery(skyscrapers, deltaTime, moveDistance); // Update skyscrapers and apartments
        updateScenery(houses, deltaTime, moveDistance);     // Update houses
        updateScenery(roads, deltaTime, moveDistance);      // Update roads
        updateScenery(mountains, deltaTime, moveDistance);   // Update mountains
        updateCamera();
    }

    // Update screen shake effect (always, even when paused)
    updateScreenShake();

    // Update particles (always, even when paused)
    updateParticles();

    // Update clouds (always, even when paused)
    updateClouds(deltaTime);

    // Always render the scene
    renderer.render(scene, camera);
}

// --- Event Handlers ---
function handleKeyDown(event) {
     // (Same as before)
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = true;
         if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
             event.preventDefault();
         }
    }

    // Pause functionality
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        if (currentGameState === GAME_STATES.PLAYING || currentGameState === GAME_STATES.PAUSED) {
            togglePause();
            event.preventDefault();
        }
    }
}

function handleKeyUp(event) {
     // (Same as before)
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = false;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Touch event handlers
function handleTouchStart(event) {
    event.preventDefault();
    isTouching = true;

    if (event.touches.length > 0) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchDeltaX = 0;
        touchDeltaY = 0;
    }
}

function handleTouchMove(event) {
    event.preventDefault();

    if (event.touches.length > 0 && isTouching) {
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;

        // Calculate delta from start position
        touchDeltaX = touchX - touchStartX;
        touchDeltaY = touchStartY - touchY; // Invert Y for natural control

        // Update start position for smoother control
        touchStartX = touchX;
        touchStartY = touchY;
    }
}

function handleTouchEnd(event) {
    event.preventDefault();
    isTouching = false;
    touchDeltaX = 0;
    touchDeltaY = 0;
}

// --- Start the game ---
init();
