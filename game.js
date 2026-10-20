const canvas = document.getElementById("gameCanvas");

// ===== Supabase Configuration =====
const SUPABASE_URL = "https://vjylsvmaolreuvxzwgin.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zbau4K290SH_6C3wTxtfTA_b3Y4YdPV";
 
const supabaseClient = supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

// ===== Game Constants =====

const WIN_VALUE = 2048;
let gameWon = false;
let achievedValues = new Set([2]);
let lowestLeaderboardScore = 0; 



const restartBtn = document.getElementById("restartBtn");
let ghostX = canvas.width / 2;
let ghostY = 40;

let currentdropId = 0;
let displayedCombo = 0;

const spawnY = 150;
const ghostRadius = 20;
canvas.width = 450;
canvas.height = 700;

const MERGE_LINE_Y = 150;
const GAME_OVER_LINE_Y = 150;

const GAME_OVER_DELAY = 1500;

let gameOver = false;
let reveal4096AfterFade = false;
let dangerStartTime = null;

let score = 0;
let highScore = Number(localStorage.getItem("highScore")) || 0;

document.getElementById("score").textContent = score;
document.getElementById("highScore").textContent = highScore;

const BALL_TYPES = {
  2:    { radius: 21, color: "#FF3B30" }, // Diameter: 42px
  4:    { radius: 28, color: "#FF9500" }, // Diameter: 56px
  8:    { radius: 35, color: "#007AFF" }, // Diameter: 70px
  16:   { radius: 44, color: "#34C759" }, // Diameter: 88px
  32:   { radius: 54, color: "#4CD964" }, // Diameter: 108px
  64:   { radius: 66, color: "#1C6831" }, // Diameter: 132px
  128:  { radius: 78, color: "#85E314" }, // Diameter: 156px
  256:  { radius: 90, color: "#10341B" }, // Diameter: 180px
  512:  { radius: 99, color: "#AF52DE" }, // Diameter: 198px
  1024: { radius: 104, color: "#FF2D55" }, // Diameter: 208px
  2048: { radius: 108, color: "#5856D6" }, // Diameter: 216px
  4096: { radius: 120, color: "#FFCC00" }  // Diameter: 240px   
};


const LEVELS = [
    2,
    4,
    8,
    16,
    32,
    64,
    128,
    256,
    512,
    1024,
    2048,
    4096
];

let nextBallValue = randomStartingValue();
// document.getElementById("nextBall").textContent = nextBallValue;

// ===== Matter Setup =====

const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;

const engine = Engine.create();

engine.gravity.y = 0.8;

// engine.gravity.y = 0.5;   // floatier
// engine.gravity.y = 0.8;   // slightly lighter
// engine.gravity.y = 1.0;   // default
// engine.gravity.y = 1.3;   // heavier
// engine.gravity.y = 1.8;   // noticeably heavier
// engine.gravity.y = 2.5;   // fast falling

const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: canvas.width,
        height: canvas.height,
        wireframes: false,
        background: "#2d3446"
    }
});

Matter.Events.on(
    engine,
    "collisionStart",
    function (event) {

        event.pairs.forEach(pair => {

            const ballA = pair.bodyA;
            const ballB = pair.bodyB;

            if (
                ballA.isGameBall &&
                ballB.isGameBall &&
                ballA.value === ballB.value
            ) {
                mergeBalls(ballA, ballB);
            }
        });
    }
);


// ===== Walls =====

const wallThickness = 40;

const floor = Bodies.rectangle(
    canvas.width / 2,
    canvas.height + wallThickness / 2,
    canvas.width,
    wallThickness,
    {
        isStatic: true,
        restitution: 0.8,
        render: {
            fillStyle: "#4f5a69"
        }
    }
);

const leftWall = Bodies.rectangle(
    -wallThickness / 2,
    canvas.height / 2,
    wallThickness,
    canvas.height,
    {
        isStatic: true,
        render: {
            fillStyle: "#4f5a69"
        }
    }
);

const rightWall = Bodies.rectangle(
    canvas.width + wallThickness / 2,
    canvas.height / 2,
    wallThickness,
    canvas.height,
    {
        isStatic: true,
        render: {
            fillStyle: "#4f5a69"
        }
    }
);

Composite.add(engine.world, [
    floor,
    leftWall,
    rightWall
]);



// const spawnLine = Bodies.rectangle(
//     canvas.width / 2,
//     90,
//     canvas.width,
//     3,
//     {
//         isStatic: true,
//         isSensor: true,

//         render: {
//             fillStyle: "#444444"
//         }
//     }
// );

// Composite.add(engine.world, spawnLine);

function drawThresholdLines() {

    const ctx = render.context;

    ctx.save();

    // Merge line
    ctx.beginPath();
    ctx.moveTo(0, MERGE_LINE_Y);
    ctx.lineTo(canvas.width, MERGE_LINE_Y);

    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 4;
    //ctx.setLineDash([8, 8]);
    ctx.stroke();

    ctx.fillStyle = "#444444";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    // ctx.fillText(
    //     "MERGE ZONE",
    //     10,
    //     MERGE_LINE_Y - 6
    // );

    // Game-over line
    ctx.beginPath();
    ctx.moveTo(0, GAME_OVER_LINE_Y);
    ctx.lineTo(canvas.width, GAME_OVER_LINE_Y);

    ctx.strokeStyle = "rgba(255, 80, 80, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 6]);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
        "DANGER LINE",
        10,
        GAME_OVER_LINE_Y - 6
    );

    ctx.restore();
}


// ===== Game Logic =====

let canDrop = true;
let gameBalls = [];

function dropBall(x, y = 60, value = 2, options = {}) {

    const ballType = BALL_TYPES[value];

    const ball = Bodies.circle(
        x, 
        y, 
        ballType.radius,
        {
            restitution: 0.5, // bounciness
            friction: 0.08,
            frictionStatic: 0.1,
            frictionAir: 0.002,
            density: 0.001,

            render: {
                fillStyle: ballType.color
            }
        }
    );

    ball.value = value;
    ball.isGameBall = true;
    ball.isMerging = false;

    ball.dropId = options.dropId ?? null;
    ball.comboLevel = options.comboLevel ?? 0;
    
    gameBalls.push(ball);

    Composite.add(engine.world, ball);

    return ball;

}

function restartGame() {

    gameBalls.forEach(ball => {
        Composite.remove(engine.world, ball);
    });

    gameBalls = [];

    score = 0;
    gameWon = false;
    gameOver = false;
    canDrop = true;
    dangerStartTime = null;

    nextBallValue = randomStartingValue();

    document.getElementById("score").textContent = score;
    // document.getElementById("nextBall").textContent = nextBallValue;
    document.getElementById("restartBtn").textContent ="Restart";
    document.getElementById("scorePanel").classList.remove("game-over");

    console.log("Game restarted");

}

function drawGhostBall() {

    const ctx = render.context;

    const ballType = BALL_TYPES[nextBallValue];

    ctx.save();

    // Draw Ball
    ctx.beginPath();

    ctx.arc(
        ghostX,
        ghostY,
        ballType.radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = ballType.color;
    ctx.globalAlpha = 0.8;

    ctx.fill();

    // Draw Value Text
    ctx.globalAlpha = 1;

    const fontSize =
        Math.max(
            12,
            ballType.radius * 0.9
        );

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        nextBallValue,
        ghostX,
        ghostY
    );

    ctx.restore();
}

function drawBallValues() {

    const ctx = render.context;
    const time = performance.now();

    gameBalls.forEach(ball => {

        const fontSize = Math.max(
            12,
            ball.circleRadius * 0.9
        );

        const pulse =
            (Math.sin(time * 0.005) + 1) / 2;

        const hue =
            (time * 0.08) % 360;

        ctx.save();

        ctx.translate(
            ball.position.x,
            ball.position.y
        );

        ctx.rotate(ball.angle);


        // ========================================
        // 1024 - LIGHT GLAM
        // ========================================

        if (ball.value === 1024) {

            const innerGlow =
                ctx.createRadialGradient(
                    0,
                    0,
                    ball.circleRadius * 0.45,
                    0,
                    0,
                    ball.circleRadius
                );

            innerGlow.addColorStop(
                0,
                "rgba(255, 255, 255, 0)"
            );

            innerGlow.addColorStop(
                0.75,
                `rgba(255, 150, 180, ${0.05 + pulse * 0.08})`
            );

            innerGlow.addColorStop(
                1,
                `rgba(255, 220, 230, ${0.25 + pulse * 0.15})`
            );

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                ball.circleRadius - 2,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = innerGlow;
            ctx.fill();
        }


        // ========================================
        // 2048 - CHAMPION EFFECT
        // ========================================

        if (ball.value === 2048) {

            // ========================================
            // ANIMATED RAINBOW INTERIOR
            // ========================================

            const innerGlow =
                ctx.createRadialGradient(
                    0,
                    0,
                    ball.circleRadius * 0.15,
                    0,
                    0,
                    ball.circleRadius
                );

            innerGlow.addColorStop(
                0,
                `hsla(${hue}, 100%, 90%, ${0.18 + pulse * 0.12})`
            );

            innerGlow.addColorStop(
                0.45,
                `hsla(${(hue + 80) % 360}, 100%, 75%, 0.15)`
            );

            innerGlow.addColorStop(
                0.75,
                `hsla(${(hue + 160) % 360}, 100%, 70%, 0.18)`
            );

            innerGlow.addColorStop(
                1,
                `hsla(${(hue + 240) % 360}, 100%, 80%, ${0.40 + pulse * 0.20})`
            );

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                ball.circleRadius - 2,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = innerGlow;
            ctx.fill();


            // ========================================
            // BRIGHT INNER EDGE
            // ========================================

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                ball.circleRadius - 5,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                `hsla(${hue}, 100%, 85%, ${0.75 + pulse * 0.20})`;

            ctx.lineWidth =
                4 + pulse * 2;

            ctx.shadowColor =
                `hsl(${hue}, 100%, 80%)`;

            ctx.shadowBlur =
                10 + pulse * 10;

            ctx.stroke();


            // ========================================
            // ROTATING RAINBOW SPARKS
            // ========================================

            ctx.save();

            ctx.rotate(time * 0.0015);

            const orbitRadius =
                ball.circleRadius * 0.78;

            for (let i = 0; i < 8; i++) {

                const angle =
                    (Math.PI * 2 / 8) * i;

                const x =
                    Math.cos(angle) * orbitRadius;

                const y =
                    Math.sin(angle) * orbitRadius;

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    2.5 + pulse * 1.5,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    `hsl(${(hue + i * 45) % 360}, 100%, 85%)`;

                ctx.shadowColor =
                    ctx.fillStyle;

                ctx.shadowBlur = 10;

                ctx.fill();
            }

            ctx.restore();


            // ========================================
            // COUNTER ROTATING WHITE SPARKS
            // ========================================

            ctx.save();

            ctx.rotate(-time * 0.001);

            const innerOrbit =
                ball.circleRadius * 0.62;

            for (let i = 0; i < 4; i++) {

                const angle =
                    (Math.PI * 2 / 4) * i;

                const x =
                    Math.cos(angle) * innerOrbit;

                const y =
                    Math.sin(angle) * innerOrbit;

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    2 + pulse,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle = "#FFFFFF";

                ctx.shadowColor = "#FFFFFF";
                ctx.shadowBlur = 12;

                ctx.fill();
            }

            ctx.restore();


            // ========================================
            // CENTRAL ENERGY CORE
            // ========================================

            const coreGradient =
                ctx.createRadialGradient(
                    0,
                    0,
                    0,
                    0,
                    0,
                    18 + pulse * 5
                );

            coreGradient.addColorStop(
                0,
                `rgba(255, 255, 255, ${0.40 + pulse * 0.25})`
            );

            coreGradient.addColorStop(
                0.4,
                `hsla(${hue}, 100%, 85%, ${0.20 + pulse * 0.15})`
            );

            coreGradient.addColorStop(
                1,
                "rgba(255, 255, 255, 0)"
            );

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                18 + pulse * 5,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = coreGradient;
            ctx.fill();
        }


        // ========================================
        // 4096 - ABSOLUTELY INSANE
        // ========================================

        if (ball.value === 4096) {

            // Deep animated rainbow interior
            const megaGlow =
                ctx.createRadialGradient(
                    0,
                    0,
                    0,
                    0,
                    0,
                    ball.circleRadius
                );

            megaGlow.addColorStop(
                0,
                `hsla(${hue}, 100%, 90%, ${0.45 + pulse * 0.25})`
            );

            megaGlow.addColorStop(
                0.30,
                `hsla(${(hue + 70) % 360}, 100%, 70%, 0.30)`
            );

            megaGlow.addColorStop(
                0.60,
                `hsla(${(hue + 150) % 360}, 100%, 65%, 0.25)`
            );

            megaGlow.addColorStop(
                0.85,
                `hsla(${(hue + 240) % 360}, 100%, 70%, 0.35)`
            );

            megaGlow.addColorStop(
                1,
                `hsla(${hue}, 100%, 85%, 0.65)`
            );

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                ball.circleRadius - 2,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = megaGlow;
            ctx.fill();


            // Bright inner edge
            ctx.beginPath();

            ctx.arc(
                0,
                0,
                ball.circleRadius - 5,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                `hsl(${hue}, 100%, 80%)`;

            ctx.lineWidth =
                5 + pulse * 2;

            ctx.shadowColor =
                `hsl(${hue}, 100%, 75%)`;

            ctx.shadowBlur =
                12 + pulse * 12;

            ctx.stroke();


            // ========================================
            // ROTATING INTERNAL ENERGY PARTICLES
            // ========================================

            ctx.save();

            ctx.rotate(time * 0.0018);

            const orbitRadius =
                ball.circleRadius * 0.78;

            for (let i = 0; i < 8; i++) {

                const angle =
                    (Math.PI * 2 / 8) * i;

                const x =
                    Math.cos(angle) * orbitRadius;

                const y =
                    Math.sin(angle) * orbitRadius;

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    3 + pulse * 2,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    `hsl(${(hue + i * 45) % 360}, 100%, 80%)`;

                ctx.shadowColor =
                    ctx.fillStyle;

                ctx.shadowBlur = 12;

                ctx.fill();
            }

            ctx.restore();


            // ========================================
            // COUNTER-ROTATING INNER PARTICLES
            // ========================================

            ctx.save();

            ctx.rotate(-time * 0.0013);

            const innerOrbit =
                ball.circleRadius * 0.55;

            for (let i = 0; i < 4; i++) {

                const angle =
                    (Math.PI * 2 / 4) * i;

                const x =
                    Math.cos(angle) * innerOrbit;

                const y =
                    Math.sin(angle) * innerOrbit;

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    3,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle = "#FFFFFF";

                ctx.shadowColor = "#FFFFFF";
                ctx.shadowBlur = 15;

                ctx.fill();
            }

            ctx.restore();


            // ========================================
            // PULSING CENTER CORE
            // ========================================

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                8 + pulse * 5,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `hsla(${hue}, 100%, 90%, ${0.45 + pulse * 0.35})`;

            ctx.shadowColor = "#FFFFFF";
            ctx.shadowBlur =
                15 + pulse * 15;

            ctx.fill();
        }


        // ========================================
        // BALL VALUE TEXT
        // ========================================

        ctx.fillStyle = "#FFFFFF";

        ctx.font =
            `bold ${fontSize}px Arial`;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";


        // 4096 text
        if (ball.value === 4096) {

            ctx.shadowColor =
                `hsl(${hue}, 100%, 85%)`;

            ctx.shadowBlur =
                25 + pulse * 15;
        }

        // 2048 text
        else if (ball.value === 2048) {

            ctx.shadowColor = "#FFFFFF";

            ctx.shadowBlur =
                15 + pulse * 8;
        }

        // 1024 text
        else if (ball.value === 1024) {

            ctx.shadowColor = "#FFB0C0";

            ctx.shadowBlur =
                7 + pulse * 3;
        }

        // Normal balls
        else {

            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
        }


        ctx.fillText(
            ball.value,
            0,
            0
        );


        // ========================================
        // RESET FOR NEXT BALL
        // ========================================

        ctx.restore();
    });
}

// ===== Merge Logic =====

function mergeBalls(ballA, ballB) {

    if (!ballA || !ballB) return;
    if (gameOver) return;
    if (ballA.isMerging || ballB.isMerging) return;
    if (ballA.value !== ballB.value) return;
    if (ballA.value >= 4096) return;

    const ballABottom = ballA.position.y + ballA.circleRadius;
    const ballBBottom = ballB.position.y + ballB.circleRadius;

// Both balls must be completely below the merge line
    if (
        ballABottom < MERGE_LINE_Y ||
        ballBBottom < MERGE_LINE_Y
    ) {
        return;
    }

    ballA.isMerging = true;
    ballB.isMerging = true;


    const oldValue = ballA.value;
    const newValue = getNextValue(oldValue);

    const mergeX = (ballA.position.x + ballB.position.x) / 2;
    const mergeY = (ballA.position.y + ballB.position.y) / 2;
    const velocityX = (ballA.velocity.x + ballB.velocity.x) / 2;
    const velocityY = (ballA.velocity.y + ballB.velocity.y) / 2;


    const belongsToCurrentDrop = 
        ballA.dropId === currentdropId || 
        ballB.dropId === currentdropId;

    let newComboLevel = 0;
    let mergeDropId = null;

    if (belongsToCurrentDrop) {
        
        const comboA = 
            ballA.dropId === currentdropId ? ballA.comboLevel : 0;
        
        const comboB = 
            ballB.dropId === currentdropId ? ballB.comboLevel : 0;

        newComboLevel = Math.max(comboA, comboB) + 1;
        mergeDropId = currentdropId;
    }

    // Remove old balls from Matter.js
    Composite.remove(engine.world, ballA);
    Composite.remove(engine.world, ballB);

    // Remove old balls from our tracking array
    gameBalls = gameBalls.filter(ball =>
        ball !== ballA && ball !== ballB
    );

    // Create the new ball at the collision position
    const mergedBall = dropBall(
        mergeX,
        mergeY,
        newValue,
        {
            dropId: mergeDropId,
            comboLevel: newComboLevel
        }
    );

    if (!mergedBall) return;
    recordAchievement(newValue);

    // Preserve some of the movement from the old balls
    Matter.Body.setVelocity(mergedBall, {
        x: velocityX,
        y: velocityY
    });

    const multiplier = belongsToCurrentDrop ? Math.max(1, newComboLevel) : 1;
    const pointsEarned = newValue * multiplier;
    
    updateScore(pointsEarned);

    if (belongsToCurrentDrop) {
        displayedCombo = newComboLevel;
        updateComboDisplay(newComboLevel);
    
    }

}

function updateComboDisplay(comboLevel) {

    const comboElement =
        document.getElementById("combo");
    
    if (!comboElement) return; 

    if (comboLevel <= 0) {
        comboElement.textContent = "-";
        return;
    }

    comboElement.textContent =
        `${comboLevel}x`;

    comboElement.classList.remove("combo-pop");

    // Force the browser to restart the animation
    void comboElement.offsetWidth;

    comboElement.classList.add("combo-pop");
}

function getNextValue(value) {

    const index = LEVELS.indexOf(value);

    if (index === -1) return value;

    return LEVELS[Math.min(index + 1, LEVELS.length - 1)];
}

// ===== Game Over Logic =====

function checkGameOver() {

    if (gameOver) return;

    const settledBallAboveLine =
        gameBalls.some(ball => {

            if (!ball || ball.isMerging) {
                return false;
            }

            const ballTop =
                ball.position.y - ball.circleRadius;

            const speed = ball.speed;

            const isAboveLine =
                ballTop < GAME_OVER_LINE_Y;

            const isSettled =
                speed < 0.4;

            return isAboveLine && isSettled;
        });

    if (settledBallAboveLine) {

        if (dangerStartTime === null) {
            dangerStartTime = performance.now();
        }

        const dangerDuration =
            performance.now() - dangerStartTime;

        if (dangerDuration >= GAME_OVER_DELAY) {
            endGame();
        }

    } else {
        dangerStartTime = null;
    }
}

async function endGame() {
    if (gameOver) return;

    gameOver = true;
    canDrop = false;
    dangerStartTime = null;

    console.log("Game Over Triggered. Final Score:", score);

    const scorePanel = document.getElementById("scorePanel");
    if (scorePanel) scorePanel.classList.add("game-over");

    document.getElementById("restartBtn").textContent = "Play Again";
    
    saveHighScore(score);}


function drawGameOverOverlay() {

    if (!gameOver) return;

    const ctx = render.context;

    ctx.save();

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 42px Arial";
    ctx.fillText(
        "GAME OVER",
        canvas.width / 2,
        canvas.height / 2 - 25
    );

    ctx.font = "bold 22px Arial";
    ctx.fillText(
        `Score: ${score}`,
        canvas.width / 2,
        canvas.height / 2 + 30
    );

    ctx.restore();
}

function createProgressList() {

    const progressList =
        document.getElementById("progressList");

    progressList.innerHTML = "";

    LEVELS.forEach(value => {

        // Hide 4096 until 2048 has been achieved
        if (value === 4096 && !achievedValues.has(2048)) {
            return;
        }

        const ballType = BALL_TYPES[value];

        const item =
            document.createElement("div");

        item.className = "progressItem";
        item.dataset.value = value;

        // Slam 4096 only during the reveal
        if (value === 4096 && reveal4096AfterFade) {
            item.classList.add("secret-reveal");
        }

        const ballPreview =
            document.createElement("div");

        ballPreview.className = "progressBall";
        ballPreview.style.backgroundColor =
            ballType.color;

        const valueText =
            document.createElement("span");

        valueText.className = "progressValue";
        valueText.textContent = value;

        item.appendChild(ballPreview);
        item.appendChild(valueText);

        if (achievedValues.has(value)) {
            item.classList.add("achieved");
        }

        progressList.appendChild(item);
    });
}

function winGame() {

    if (gameWon) return;

    gameWon = true;
    //canDrop = false;
    
    //saveHighScore(score);
    showWinOverlay();

    console.log("You created 2048. You win!");

    document.getElementById("restartBtn").textContent =
        "Play Again";
}

let winOverlayVisible = false;
let winOverlayFading = false;
let winOverlayAlpha = 1;

function showWinOverlay() {
    winOverlayVisible = true;
    winOverlayFading = false;
    winOverlayAlpha = 1;
}

function drawWinOverlay() {
    if (!winOverlayVisible) return;

    const ctx = render.context;
    const time = performance.now();

    // Vibrate / shake
    const shakeX = Math.sin(time * 0.08) * 6;
    const shakeY = Math.cos(time * 0.10) * 4;

    // Rainbow color animation
    const hue = (time * 0.25) % 360;

    // Fade after player clicks
    if (winOverlayFading) {
        winOverlayAlpha -= 0.04;

        if (winOverlayAlpha <= 0) {

            winOverlayAlpha = 0;
            winOverlayVisible = false;
            winOverlayFading = false;

            // Reveal 4096 only after the win overlay
            // has completely disappeared
            if (reveal4096AfterFade) {
                createProgressList();
                reveal4096AfterFade = false;
            }

            return;
        }
    }

    ctx.save();

    ctx.globalAlpha = winOverlayAlpha;

    // Darken board slightly
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.translate(
        canvas.width / 2 + shakeX,
        canvas.height / 2 + shakeY
    );

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Rainbow text
    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;

    // Glow matches rainbow color
    ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
    ctx.shadowBlur = 30;

    ctx.font = "900 48px Arial";

    ctx.fillText(
        "2048 ACHIEVED!",
        0,
        0
    );

    ctx.restore();
}

let milestone1024Visible = false;
let milestone1024Alpha = 1;
let milestone1024StartTime = 0;

function show1024Overlay() {
    milestone1024Visible = true;
    milestone1024Alpha = 1;
    milestone1024StartTime = performance.now();
}

function draw1024Overlay() {

    if (!milestone1024Visible) return;

    const ctx = render.context;
    const elapsed = performance.now() - milestone1024StartTime;

        // Vibrate / shake
    const shakeX = Math.sin(elapsed * 0.08) * 3;
    const shakeY = Math.cos(elapsed * 0.10) * 2;

    // Stay visible, then fade away
    if (elapsed > 5000) {
        milestone1024Alpha -= 0.04;

        if (milestone1024Alpha <= 0) {
            milestone1024Visible = false;
            milestone1024Alpha = 0;
            return;
        }
    }

    ctx.save();
    ctx.translate(
        canvas.width / 2 + shakeX,
        canvas.height / 2 + shakeY
    );


    ctx.globalAlpha = milestone1024Alpha;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Main text
    ctx.fillStyle = "#FFB0C0";
    ctx.shadowColor = "#FF2D55";
    ctx.shadowBlur = 18;

    ctx.font = "900 38px Arial";

    ctx.fillText(
        "1024 ACHIEVED!",
        0,
        -15
    );

    // Smaller message
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px Arial";

    ctx.fillText(
        "Almost there...",
        0,
        30
    );

    ctx.restore();
}


// ===== Helpers =====

function randomStartingValue() {

    const options = [2, 2, 2, 2, 4, 4, 8];
    //const options = [512]; //Test Mode

    return options[
        Math.floor(Math.random() * options.length)
    ];
}

function updateScore(points) {

    // console.log("updateScore called");
    // console.log("points:", points);
    // console.log("score before:", score);

    score += points;

    document.getElementById("score").textContent =
        score;

    if (score > highScore) {

        highScore = score;

        localStorage.setItem(
            "highScore",
            highScore
        );

        document.getElementById("highScore").textContent =
            highScore;
    }
    
}

function resetLocalHighScore() {
    // 1. Remove the key from the browser's localStorage
    localStorage.removeItem("highScore");
    //localStorage.removeItem("highScore"); location.reload();

    // 2. Reset the runtime variable in your code
    highScore = 0;

    // 3. Update the display panel so it reflects 0 immediately
    document.getElementById("highScore").textContent = "0";
    
    console.log("Local high score successfully cleared!");
}

async function updateLeaderboardUI() {
    const { data: topScores, error } = await supabaseClient
        .from("scores")
        .select("player_name, score, biggest_ball")
        .order("score", { ascending: false })
        .limit(10);

    const listContainer = document.getElementById("leaderboardList");
    if (!listContainer) return;

    if (error) {
        console.error("Error fetching leaderboard data:", error.message);
        return;
    }

    listContainer.innerHTML = "";

    if (!topScores || topScores.length === 0) {
        listContainer.innerHTML = "<li>No scores yet!</li>";
        lowestLeaderboardScore = 0; // Board is empty, any score qualifies
        return;
    }

    // ===== ADD THIS TRACKING BLOCK =====
    if (topScores.length < 10) {
        // If there are fewer than 10 total entries in the database, any score qualifies
        lowestLeaderboardScore = 0; 
    } else {
        // Grab the score of the person sitting in the last slot (index 9)
        lowestLeaderboardScore = topScores[topScores.length - 1].score;
    }
    // ====================================

    topScores.forEach((entry) => {

        let ballDisplay;

        if (entry.biggest_ball >= 2048) {
            ballDisplay = `🏆`;
        }


        const listItem = document.createElement("li");

        listItem.innerHTML = `
            <span class="player">${entry.player_name}</span>
            <span class="val">${entry.score}</span>
            ${entry.biggest_ball >= 2048 ? "🏆" : ""}
        `;

        listContainer.appendChild(listItem);
    });
}


function drawComboText() {

    if (displayedCombo <= 1) return;

    const ctx = render.context;

    ctx.save();

    ctx.fillStyle = "#FFD54F";

    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        `${displayedCombo}x COMBO`,
        canvas.width / 2,
        100
    );

    ctx.restore();
}

let biggestBall = 2;

function recordAchievement(value) {

    // Ignore values already achieved
    if (achievedValues.has(value)) {
        return;
    }

    // Record achievement
    achievedValues.add(value);

    // Track highest ball achieved
    if (value > biggestBall) {
        biggestBall = value;
        console.log(`New biggest ball: ${biggestBall}`);
    }

    // Find the progress item
    const item = document.querySelector(
        `.progressItem[data-value="${value}"]`
    );

    // Mark progress item as achieved
    if (item) {
        item.classList.add(
            "achieved",
            "just-achieved"
        );

        setTimeout(() => {
            item.classList.remove("just-achieved");
        }, 400);
    }

    console.log(`Achievement unlocked: ${value}`);

    if (value === 1024) {
        show1024Overlay();
    }

    // Trigger the 2048 win overlay.
    // Do not rebuild the progress list here.
    if (value === WIN_VALUE) {
        winGame();
    }
}


// ===== Event Listeners =====

canvas.addEventListener("mousemove", (event) => {

    const rect = canvas.getBoundingClientRect();
    const ballType = BALL_TYPES[nextBallValue];

    ghostX = event.clientX - rect.left;
    ghostY = event.clientY - rect.top;

    // Constrain ghost ball within canvas bounds
    ghostX = Math.max(
        ballType.radius,
        Math.min(canvas.width - ballType.radius, ghostX)
    );
    ghostY = Math.max(
        ballType.radius,
        Math.min(spawnY - ballType.radius, ghostY)
    );

});


restartBtn.addEventListener("click", restartGame);

canvas.addEventListener("click", (event) => {
    if (winOverlayVisible && !winOverlayFading) {
        winOverlayFading = true;
        reveal4096AfterFade = true;
    }

    if (gameOver || !canDrop) return;

    canDrop = false;

    setTimeout(() => {
        if (!gameOver) {
            canDrop = true;
        }   
    }, 100);
    
    dropBall(ghostX, ghostY, nextBallValue, 
        {
        dropId: currentdropId,
        comboLevel: 0
        }
    );

    nextBallValue = randomStartingValue();
    
    // document.getElementById("nextBall").textContent = nextBallValue;

});

// ===== Spacebar Drop Control =====
let spacebarInterval = null;

window.addEventListener("keydown", (event) => {
    // Check if the pressed key is the spacebar
    if (event.code !== "Space") return;
    
    // Prevent the spacebar from scrolling the webpage down
    event.preventDefault();

    // If the game is over, data is locked, or an interval is already running, do nothing
    if (gameOver || !canDrop || spacebarInterval !== null) return;

    // Helper function to execute a single drop routine
    const triggerSpacebarDrop = () => {
        if (gameOver || !canDrop) return;

        canDrop = false;

        // Enforce the drop timeout delay
        setTimeout(() => {
            if (!gameOver) {
                canDrop = true;
            }
        }, 100);

        // Execute the drop using the active ghost placement coordinates
        dropBall(ghostX, ghostY, nextBallValue, {
            dropId: currentdropId,
            comboLevel: 0
        });

        // Generate the value for the next upcoming ball
        nextBallValue = randomStartingValue();
    };

    // Trigger the initial drop instantly on the first press
    triggerSpacebarDrop();

    // Set an interval to keep dropping automatically every 150ms while held down
    spacebarInterval = setInterval(() => {
        triggerSpacebarDrop();
    }, 150); 
});

window.addEventListener("keyup", (event) => {
    // Clear the interval loop immediately when the spacebar is released
    if (event.code === "Space") {
        clearInterval(spacebarInterval);
        spacebarInterval = null;
    }
});



// ===== Start Physics =====

createProgressList();
Render.run(render);
updateLeaderboardUI();

const runner = Runner.create();
Runner.run(runner, engine);

Matter.Events.on(engine, "afterUpdate", () => {
    checkGameOver();
});

Matter.Events.on(render, "afterRender", () => {
    drawThresholdLines();
    drawGhostBall();
    drawBallValues();
    drawGameOverOverlay();
    drawComboText();
    draw1024Overlay();
    drawWinOverlay();
});

console.log("2048 Drop Loaded");

// async function saveHighScore(gameScore) {
//     // 1. Prompt the user for their name
//     const playerName = prompt("New High Score! Enter your name:");
    
//     // If the user hits cancel or leaves it completely blank, stop execution
//     if (!playerName || playerName.trim() === "") {
//         console.log("Score submission cancelled by user.");
//         return;
//     }

//     // 2. Insert the row into your Supabase "scores" table
//     const { data, error } = await supabaseClient
//         .from("scores")
//         .insert([
//             { 
//                 player_name: playerName.trim(), // Make sure this matches your DB column name
//                 score: gameScore 
//             }
//         ])
//         .select(); // Returns the inserted data for validation

//     // 3. Log results to the console
//     if (error) {
//         console.error("Error saving score:", error.message);
//     } else {
//         console.log("Score saved successfully!", data);
//     }

//     await updateLeaderboardUI();
// }
// Variable to store the temporary game score while the modal is open
let pendingScoreToSave = 0;

function saveHighScore(gameScore) {
    console.log("Showing high score input modal for score:", gameScore);
    
    // Store score in our tracking variable
    pendingScoreToSave = gameScore;
    
    // Reveal the hidden modal overlay by removing the hidden utility class
    const overlay = document.getElementById("scoreModalOverlay");
    if (overlay) {
        overlay.classList.remove("hidden-modal");
        
        // Auto-focus the input text field for instant typing convenience
        setTimeout(() => document.getElementById("playerNameInput").focus(), 50);
    }
}

// Helper utility to safely tuck away the overlay panel 
function hideHighScoreModal() {
    const overlay = document.getElementById("scoreModalOverlay");
    if (overlay) overlay.classList.add("hidden-modal");
    
    // Reset inputs
    document.getElementById("playerNameInput").value = "";
}


// ===== Wire Up Form Interactions =====
document.getElementById("scoreForm").addEventListener("submit", async (event) => {
    // Prevent standard webpage reload actions on form submission
    event.preventDefault(); 
    
    const inputElement = document.getElementById("playerNameInput");
    const playerName = inputElement.value.trim();
    console.log([...achievedValues]);
    console.log(Math.max(...achievedValues));
    if (!playerName) return;

    const maxBall = Math.max(...achievedValues);
    console.log("Saving biggest ball:", maxBall);
    // Send data off to your Supabase table
    const { data, error } = await supabaseClient
        .from("scores")
        .insert([{ player_name: playerName, score: pendingScoreToSave, biggest_ball: maxBall}])
        .select();

    if (error) {
        console.error("Error saving score:", error.message);
    } else {
        console.log("Score saved successfully via custom form UI!", data);
        // Force the leaderboard array interface component to refresh columns
        await updateLeaderboardUI(); 
    }

    // Dismiss the window framework layout securely
    hideHighScoreModal();
});

// Dismiss input if cancel button is triggered
document.getElementById("cancelScoreBtn").addEventListener("click", () => {
    console.log("Score submission cancelled by user choice.");
    hideHighScoreModal();
});


