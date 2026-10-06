const screen1 = document.getElementById('screen1');
const screen2 = document.getElementById('screen2');
const testButton = document.getElementById('testButton');
const rngButton = document.getElementById('rngButton');
const errorMessage = document.getElementById('errorMessage');

let socket = null;

function initializeWebSocket() {
    const socketUrl = `wss://${window.location.host}/ws`;
    
    console.log("Connecting directly to Discord Proxy route:", socketUrl);
    socket = new WebSocket(socketUrl);

    socket.addEventListener('open', () => {
        console.log("Connected to card game backend");
        errorMessage.classList.add("hidden");
    });

    socket.addEventListener('message', event => {
        try {
            const data = JSON.parse(event.data);
            console.log("Backend message:", data);

            if (data.type === "connected") {
                console.log("Card game connection established");
                return;
            }

            if (data.type === "rng_result") {
                document.body.style.background = data.data.color.code;
                return;
            }

            if (data.type === "error") {
                errorMessage.textContent = `❌ Server Error: ${data.data.message}`;
                errorMessage.classList.remove("hidden");
                return;
            }

        } catch (err) {
            errorMessage.textContent = "⚠️ Invalid game response structural frame.";
            errorMessage.classList.remove("hidden");
        }
    });

    socket.addEventListener('close', (event) => {
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        
        if (event.code === 1006) {
            errorMessage.textContent = "❌ ERROR: Proxy Handoff Failure (1006). Discord's network engine cannot ping port, or inactivity timeout occured.";
        } else if (event.code === 1015) {
            errorMessage.textContent = "❌ ERROR: SSL Handshake failure (1015). Discord required a secure connection that backend container port didn't accept.";
        } else {
            errorMessage.textContent = `⚠️ Disconnected (Code: ${event.code}). Reason: ${event.reason || 'None'}`;
        }
        errorMessage.classList.remove("hidden");
    });

    socket.addEventListener('error', (err) => {
        console.error("WebSocket Error Stack:", err);
        
        if (socket.readyState === WebSocket.CONNECTING) {
            errorMessage.textContent = "❌ ERROR: Browser CSP Security Block. Outbound traffic was blocked by the browser sandbox before leaving your app.";
        } else {
            errorMessage.textContent = "❌ ERROR: Generic Socket Core Failure. See network trace tool flags.";
        }
        errorMessage.classList.remove("hidden");
    });
}

testButton.addEventListener('click', () => {
    screen1.classList.add('hidden');
    screen2.classList.remove('hidden');
});

rngButton.addEventListener('click', () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        let stateText = "UNKNOWN";
        if (!socket) stateText = "NOT_INITIALIZED";
        else if (socket.readyState === WebSocket.CONNECTING) stateText = "CONNECTING";
        else if (socket.readyState === WebSocket.CLOSING) statusText = "CLOSING";
        else if (socket.readyState === WebSocket.CLOSED) stateText = "CLOSED";

        errorMessage.textContent = `⚠️ Action Cancelled: Socket State is [${stateText}]. Check the error log banner.`;
        errorMessage.classList.remove("hidden");
        return;
    }

    socket.send(JSON.stringify({
        protocol: "cardgame",
        version: 1,
        request: "rng_test"
    }));
});

initializeWebSocket();

const loadingScreen = document.getElementById('loadingScreen');

const mainScreen = document.getElementById('mainScreen');

const generateButton = document.getElementById('generateButton');

const leaderboardsButton = document.getElementById('leaderboardsButton');

const cardsButton = document.getElementById('cardsButton');

const generateScreen = document.getElementById('generateScreen');

const leaderboardsScreen = document.getElementById('leaderboardsScreen');

const cardsScreen = document.getElementById('cardsScreen');


setTimeout(() => {

    loadingScreen.classList.add('hidden');

    mainScreen.classList.remove('hidden');

}, 3000);


function switchTab(button, screen) {

    generateButton.classList.remove('active');

    leaderboardsButton.classList.remove('active');

    cardsButton.classList.remove('active');

    generateScreen.classList.add('hidden');

    leaderboardsScreen.classList.add('hidden');

    cardsScreen.classList.add('hidden');

    button.classList.add('active');

    screen.classList.remove('hidden');

}


generateButton.addEventListener('click', () => {

    switchTab(generateButton, generateScreen);

});


leaderboardsButton.addEventListener('click', () => {

    switchTab(leaderboardsButton, leaderboardsScreen);

});


cardsButton.addEventListener('click', () => {

    switchTab(cardsButton, cardsScreen);

});


const scrollRail = document.querySelector('.scrollRail');

function updateScrollRail() {

    if (!scrollRail) {
        return;
    }

    const pageHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        mainScreen.scrollHeight,
        window.innerHeight
    );

    const spacing = 250;

    const edgeInset = 36;

    const indicatorCount = Math.max(
        1,
        Math.ceil(pageHeight / spacing)
    );

    scrollRail.style.height = `${pageHeight}px`;

    scrollRail.innerHTML = '';

    for (let i = 0; i < indicatorCount; i++) {

        const indicator = document.createElement('div');

        indicator.className = 'scrollIndicator';

        indicator.innerHTML = '<span>→</span><strong>SCROLL</strong><span>←</span>';

        let topPosition;

        if (indicatorCount === 1) {

            topPosition = pageHeight / 2;

        } else if (i === 0) {

            topPosition = edgeInset;

        } else if (i === indicatorCount - 1) {

            topPosition = Math.max(
                edgeInset,
                pageHeight - edgeInset
            );

        } else {

            topPosition = i * spacing;

        }

        indicator.style.top = `${topPosition}px`;

        scrollRail.appendChild(indicator);

    }

}


updateScrollRail();

window.addEventListener('resize', updateScrollRail);

if (typeof ResizeObserver !== 'undefined') {

    const scrollResizeObserver = new ResizeObserver(() => {

        updateScrollRail();

    });

    scrollResizeObserver.observe(mainScreen);

    scrollResizeObserver.observe(document.body);

}


const tabButtons = document.querySelectorAll('.tabButton');

const buttonShakeStates = new Map();

function startButtonEarthquake(button) {

    if (buttonShakeStates.has(button)) {
        return;
    }

    const state = {
        active: true,
        animationFrame: null,
        startedAt: performance.now()
    };

    buttonShakeStates.set(button, state);

    function shakeFrame(now) {

        if (!state.active) {
            return;
        }

        const elapsed = now - state.startedAt;

        const intensity = Math.min(elapsed / 10000, 1);

        const movement = 0.08 + intensity * 1.22;

        const rotation = 0.05 + intensity * 0.65;

        const x = (Math.random() - 0.5) * movement;

        const y = (Math.random() - 0.5) * movement;

        const angle = (Math.random() - 0.5) * rotation;

        button.style.transform =
            `translate(${x}px, ${y}px) rotate(${angle}deg)`;

        state.animationFrame = requestAnimationFrame(shakeFrame);

    }

    state.animationFrame = requestAnimationFrame(shakeFrame);

}

function stopButtonEarthquake(button) {

    const state = buttonShakeStates.get(button);

    if (!state) {
        return;
    }

    state.active = false;

    if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
    }

    button.style.transform = '';

    buttonShakeStates.delete(button);

}

function playButtonAnimation(button) {

    button.querySelectorAll('.buttonEffectImage').forEach(image => {

        image.remove();

    });

    const car = document.createElement('img');

    car.className = 'buttonEffectImage carEffect';

    car.src = './carvector.png';

    car.alt = '';

    const tornado = document.createElement('img');

    tornado.className = 'buttonEffectImage tornadoEffect';

    tornado.src = './tornadovector.png';

    tornado.alt = '';

    button.appendChild(car);

    button.appendChild(tornado);

    tornado.addEventListener('animationend', () => {

        car.remove();

        tornado.remove();

    }, { once: true });

}

tabButtons.forEach(button => {

    button.addEventListener('pointerenter', () => {

        startButtonEarthquake(button);

    });

    button.addEventListener('pointerleave', () => {

        stopButtonEarthquake(button);

    });

    button.addEventListener('click', () => {

        playButtonAnimation(button);

    });

});


function startNormalButtonWiggle(button) {

    if (!button || button.classList.contains('tabButton')) {
        return;
    }

    button.classList.add('normalButtonWiggle');

}

function stopNormalButtonWiggle(button) {

    if (!button) {
        return;
    }

    button.classList.remove('normalButtonWiggle');

}