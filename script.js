// --- ELEMENTOS DOM ---
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const pauseOverlay = document.getElementById('pause-overlay');
const usernameInput = document.getElementById('username-input');
const btnJoin = document.getElementById('btn-join');
const btnResume = document.getElementById('btn-resume');
const btnExit = document.getElementById('btn-exit');

const userDisplay = document.getElementById('user-display');
const chipsDisplay = document.getElementById('chips-display');
const playerScoreDisplay = document.getElementById('player-score-display');
const dealerScoreDisplay = document.getElementById('dealer-score-display');
const statusMessage = document.getElementById('status-message');

const btnHit = document.getElementById('btn-hit');
const btnStand = document.getElementById('btn-stand');
const btnPower = document.getElementById('btn-power');
const btnStart = document.getElementById('btn-start');

const GOAL_CHIPS = 2000;

let gameState = {
    deck: [],
    playerHand: [],
    dealerHand: [],
    chips: 1000,
    bet: 50,
    powerUsed: false,
    playing: false
};

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// --- MOTOR THREE.JS 3D ---
let scene, camera, renderer;
let cardMeshes = [];
let chipMeshes = [];
let handGroup = null;
let isAnimatingHand = false;

function init3D() {
    const canvas = document.getElementById('webgl-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070b);

    // Ángulo de cámara centrado e inclinado tipo casino
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 11, 8.5);
    camera.lookAt(0, -0.3, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Iluminación cálida de Casino Clásico
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.65);
    scene.add(ambientLight);

    const mainSpot = new THREE.SpotLight(0xffedd5, 1.4);
    mainSpot.position.set(0, 14, 2);
    mainSpot.angle = Math.PI / 3;
    mainSpot.penumbra = 0.5;
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.width = 2048;
    mainSpot.shadow.mapSize.height = 2048;
    scene.add(mainSpot);

    // Mesa de Fieltro Verde Oscuro Clásico
    const tableTexture = createTableFeltTexture();
    const tableGeo = new THREE.CylinderGeometry(6.5, 6.5, 0.5, 32);
    const tableMat = new THREE.MeshStandardMaterial({ 
        map: tableTexture, 
        roughness: 0.6 
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.25;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // Borde de Madera Caoba Clásica
    const rimGeo = new THREE.CylinderGeometry(6.8, 6.8, 0.35, 32);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x2b0d04, roughness: 0.2 });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = -0.42;
    scene.add(rimMesh);

    // Objetos 3D de ambientación
    createGlass3D();
    createVoxelHand();
    renderChips3D();

    window.addEventListener('resize', onWindowResize);
    animate();
}

// TAPETE CLÁSICO DE CASINO DE VERDE PROFUNDO
function createTableFeltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Verde oscuro casino tradicional
    ctx.fillStyle = '#0a4720';
    ctx.fillRect(0, 0, 1024, 1024);

    // Línea Dorada elegante
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(512, 512, 450, 0, Math.PI * 2);
    ctx.stroke();

    // Texto de fieltro dorado
    ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.font = 'bold 34px serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLACKJACK 21 PAYS 3 TO 2', 512, 380);
    ctx.fillText('DEALER MUST DRAW TO 16 AND STAND ON 17', 512, 640);

    return new THREE.CanvasTexture(canvas);
}

// COPA ELEGANTE 3D EN LA ESQUINA DE LA MESA
function createGlass3D() {
    const glassGroup = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        transmission: 0.9
    });

    const liquidMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.2 }); // Vino tinto

    // Base y tallo
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16), glassMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 16), glassMat);
    stem.position.y = 0.35;

    // Copa
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.6, 16), glassMat);
    cup.position.y = 0.9;

    // Contenido (Vino)
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.22, 0.35, 16), liquidMat);
    liquid.position.y = 0.8;

    glassGroup.add(base);
    glassGroup.add(stem);
    glassGroup.add(cup);
    glassGroup.add(liquid);

    // Posicionada arriba a la derecha en la mesa
    glassGroup.position.set(4.2, 0, -2.5);
    scene.add(glassGroup);
}

// TORRES DE FICHAS 3D EN LA ESQUINA IZQUIERDA (SIN OBSTRUIR CARTAS)
function renderChips3D() {
    chipMeshes.forEach(mesh => scene.remove(mesh));
    chipMeshes = [];

    // Colores de Casino Tradicional: Rojo, Azul, Negro, Dorado
    const chipColors = [0xd97706, 0xdc2626, 0x2563eb, 0x111827];
    const totalStacks = Math.min(Math.max(Math.floor(gameState.chips / 150), 2), 5);

    for (let s = 0; s < totalStacks; s++) {
        const stackHeight = Math.floor(Math.random() * 5) + 4;
        // Ubicadas bien a la izquierda (x: -4.5 a -3.0, z: -0.5 a 0.5)
        const startX = -4.5 + (s * 0.65);
        const startZ = -0.2 + (s * 0.2);

        for (let h = 0; h < stackHeight; h++) {
            const chipGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 20);
            const color = chipColors[(s + h) % chipColors.length];
            const chipMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3 });
            const chipMesh = new THREE.Mesh(chipGeo, chipMat);

            chipMesh.position.set(startX, (h * 0.085) + 0.04, startZ);
            chipMesh.castShadow = true;
            chipMesh.receiveShadow = true;

            scene.add(chipMesh);
            chipMeshes.push(chipMesh);
        }
    }
}

// MANO VOXEL 3D
function createVoxelHand() {
    handGroup = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 }); // Traje rojo oscuro clásico

    const palm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.0), skinMat);
    palm.castShadow = true;
    handGroup.add(palm);

    for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.8), skinMat);
        finger.position.set(-0.42 + (i * 0.28), -0.02, -0.8);
        finger.castShadow = true;
        handGroup.add(finger);
    }

    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.6), skinMat);
    thumb.position.set(0.7, 0, -0.2);
    thumb.rotation.y = -Math.PI / 4;
    thumb.castShadow = true;
    handGroup.add(thumb);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 2.5), sleeveMat);
    arm.position.set(0, 0.1, 1.6);
    arm.castShadow = true;
    handGroup.add(arm);

    handGroup.position.set(0, -5, 5);
    scene.add(handGroup);
}

function triggerHandAnimation(targetX = 0, targetZ = 1.8) {
    if (isAnimatingHand) return;
    isAnimatingHand = true;

    handGroup.position.set(targetX + 3, 2, targetZ + 4);
    handGroup.rotation.set(-0.4, -0.5, 0);

    let progress = 0;
    const interval = setInterval(() => {
        progress += 0.05;
        if (progress <= 0.5) {
            handGroup.position.x -= 0.3;
            handGroup.position.y -= 0.15;
            handGroup.position.z -= 0.3;
        } else {
            handGroup.position.x += 0.3;
            handGroup.position.y += 0.2;
            handGroup.position.z += 0.3;
        }

        if (progress >= 1.0) {
            clearInterval(interval);
            handGroup.position.set(0, -5, 5);
            isAnimatingHand = false;
        }
    }, 16);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// TEXTURA DE CARTAS ULTRA CLARA Y LEGIBLE
function createCardTexture(value, suit) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 768);

    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(10, 10, 492, 748);

    const isRed = ['♥', '♦'].includes(suit);
    ctx.fillStyle = isRed ? '#dc2626' : '#0f172a';

    // Esquina superior
    ctx.font = '900 90px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(value, 30, 95);

    ctx.font = '900 80px sans-serif';
    ctx.fillText(suit, 32, 180);

    // Esquina inferior (invertida)
    ctx.save();
    ctx.translate(482, 673);
    ctx.rotate(Math.PI);
    ctx.font = '900 90px sans-serif';
    ctx.fillText(value, 0, 0);
    ctx.font = '900 80px sans-serif';
    ctx.fillText(suit, 0, 85);
    ctx.restore();

    // Centro
    ctx.font = '900 230px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suit, 256, 384);

    return new THREE.CanvasTexture(canvas);
}

function createBackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    // Reverso de carta en Rojo Casino Clásico
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, 512, 768);
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(12, 12, 488, 744);

    // Patrón decorativo
    ctx.fillStyle = '#7f1d1d';
    for (let x = 40; x < 480; x += 40) {
        for (let y = 40; y < 730; y += 40) {
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    return new THREE.CanvasTexture(canvas);
}

function clear3DCards() {
    cardMeshes.forEach(mesh => scene.remove(mesh));
    cardMeshes = [];
}

function spawnCard3D(card, x, z, hidden = false) {
    const cardGeo = new THREE.BoxGeometry(1.65, 0.1, 2.35);
    
    const frontTex = createCardTexture(card.value, card.suit);
    const backTex = createBackTexture();
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });

    const materials = [
        sideMat, sideMat,
        new THREE.MeshStandardMaterial({ map: hidden ? backTex : frontTex }),
        new THREE.MeshStandardMaterial({ map: backTex }),
        sideMat, sideMat
    ];

    const mesh = new THREE.Mesh(cardGeo, materials);
    mesh.position.set(x, 0.1, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (hidden) {
        mesh.rotation.z = Math.PI;
    }

    scene.add(mesh);
    cardMeshes.push(mesh);
}

// --- LÓGICA DE JUEGO ---
function createDeck() {
    let deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ suit: s, value: v });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        if (['J', 'Q', 'K'].includes(card.value)) score += 10;
        else if (card.value === 'A') { score += 11; aces++; }
        else score += parseInt(card.value);
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

function startRound() {
    if (gameState.chips <= 0) gameState.chips = 1000;

    gameState.deck = createDeck();
    gameState.playerHand = [gameState.deck.pop(), gameState.deck.pop()];
    gameState.dealerHand = [gameState.deck.pop(), gameState.deck.pop()];
    gameState.powerUsed = false;
    gameState.playing = true;

    statusMessage.textContent = "Tu turno: ¿Pides o te plantas?";
    renderUI();
}

function renderUI() {
    clear3DCards();

    // Render cartas Crupier (Arriba)
    gameState.dealerHand.forEach((card, index) => {
        const hidden = (index === 1 && gameState.playing);
        spawnCard3D(card, (index - 0.5) * 2.1, -2.1, hidden);
    });

    // Render cartas Jugador (Abajo)
    gameState.playerHand.forEach((card, index) => {
        spawnCard3D(card, (index - (gameState.playerHand.length - 1) / 2) * 2.1, 2.1, false);
    });

    renderChips3D();

    // Actualizar HUD
    chipsDisplay.textContent = `$${gameState.chips}`;
    playerScoreDisplay.textContent = calculateScore(gameState.playerHand);
    dealerScoreDisplay.textContent = gameState.playing ? '?' : calculateScore(gameState.dealerHand);

    btnHit.disabled = !gameState.playing;
    btnStand.disabled = !gameState.playing;
    btnPower.disabled = !gameState.playing || gameState.powerUsed;
    btnStart.disabled = gameState.playing;
}

function checkGoal() {
    if (gameState.chips >= GOAL_CHIPS) {
        statusMessage.textContent = "¡VICTORIA TOTAL! Has alcanzado $2,000 fichas.";
        gameState.playing = false;
    } else if (gameState.chips <= 0) {
        statusMessage.textContent = "¡BANCARROTA! Te has quedado sin fichas.";
        gameState.playing = false;
    }
}

function hit() {
    triggerHandAnimation(0, 2.1);
    setTimeout(() => {
        gameState.playerHand.push(gameState.deck.pop());
        if (calculateScore(gameState.playerHand) > 21) {
            gameState.chips -= gameState.bet;
            gameState.playing = false;
            statusMessage.textContent = "¡Te pasaste de 21! Pierdes la mano.";
            checkGoal();
        }
        renderUI();
    }, 250);
}

function stand() {
    triggerHandAnimation(0, -2.1);
    setTimeout(() => {
        gameState.playing = false;
        while (calculateScore(gameState.dealerHand) < 17) {
            gameState.dealerHand.push(gameState.deck.pop());
        }

        const pScore = calculateScore(gameState.playerHand);
        const dScore = calculateScore(gameState.dealerHand);

        if (dScore > 21 || pScore > dScore) {
            gameState.chips += gameState.bet;
            statusMessage.textContent = "¡Ganaste la mano!";
        } else if (dScore > pScore) {
            gameState.chips -= gameState.bet;
            statusMessage.textContent = "El Crupier gana la mano.";
        } else {
            statusMessage.textContent = "Empate.";
        }

        checkGoal();
        renderUI();
    }, 250);
}

function usePower() {
    if (!gameState.powerUsed && gameState.playerHand.length > 0) {
        triggerHandAnimation(0, 2.1);
        setTimeout(() => {
            gameState.playerHand.pop();
            gameState.playerHand.push(gameState.deck.pop());
            gameState.powerUsed = true;
            if (calculateScore(gameState.playerHand) > 21) {
                gameState.chips -= gameState.bet;
                gameState.playing = false;
                statusMessage.textContent = "¡Te pasaste tras usar el recambio!";
                checkGoal();
            }
            renderUI();
        }, 250);
    }
}

// EVENTOS
btnJoin.onclick = () => {
    loginScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    userDisplay.textContent = usernameInput.value || 'Jugador1';

    init3D();
    startRound();
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gameScreen.style.display !== 'none') {
        pauseOverlay.style.display = (pauseOverlay.style.display === 'none') ? 'flex' : 'none';
    }
});

btnResume.onclick = () => pauseOverlay.style.display = 'none';
btnExit.onclick = () => {
    pauseOverlay.style.display = 'none';
    gameScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
};

btnStart.onclick = () => startRound();
btnHit.onclick = () => hit();
btnStand.onclick = () => stand();
btnPower.onclick = () => usePower();