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
         
        requestRngServerTime(); 
    }); 
	 
    socket.addEventListener('message', event => { 
        try { 
            const data = JSON.parse(event.data); 
            console.log("Backend message:", data); 
	 
            if (data.type === "connected") { 
                console.log("Card game connection established"); 
                return; 
            } 
	 
            if (data.type === "time_result") { 
                if ( 
                    !data.data || 
                    typeof data.data.serverTime !== 'number' || 
                    !Number.isFinite(data.data.serverTime) || 
                    typeof data.data.nextReset !== 'object' || 
                    typeof data.data.nextReset.timestamp !== 'number' || 
                    !Number.isFinite(data.data.nextReset.timestamp) 
                ) { 
                    errorMessage.textContent = 
                        "⚠️ Invalid server time response."; 
	 
                    errorMessage.classList.remove( 
                        "hidden" 
                    ); 
	 
                    return; 
                } 
	 
                syncRngServerClock( 
                    data.data.serverTime, 
                    data.data.nextReset 
                ); 
	 
                return; 
            } 
	 
            if (data.type === "rng_result") { 
                if (!data.data || typeof data.data !== 'object') { 
                    errorMessage.textContent = "⚠️ Invalid RNG result structure."; 
                    errorMessage.classList.remove("hidden"); 
                    return; 
                } 
	 
                rngRequestPending = false; 
                errorMessage.classList.add("hidden"); 
                markRngRollComplete(data.data); 
                showRngRecordResult(data.data); 
                return; 
            } 
	 
            if (data.type === "daily_roll_state") { 
                return; 
            } 
	 
            if (data.type === "rng_error") { 
                rngRequestPending = false; 
	 
                const message = 
                    data.data && 
                    typeof data.data.message === 'string' 
                        ? data.data.message 
                        : "Failed to generate an RNG record."; 
	 
                errorMessage.textContent = `❌ RNG Error: ${message}`; 
                errorMessage.classList.remove("hidden"); 
                initializeRngGenerateButton(); 
                return; 
            } 
	 
            if (data.type === "request_error") { 
                rngRequestPending = false; 
	 
                const message = 
                    data.data && 
                    typeof data.data.message === 'string' 
                        ? data.data.message 
                        : "Rear request processing failed."; 
	 
                errorMessage.textContent = `❌ Server Error: ${message}`; 
                errorMessage.classList.remove("hidden"); 
                initializeRngGenerateButton(); 
                return; 
            } 
	 
            if (data.type === "rng_test") { 
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
	 
function requestRngServerTime() { 
    if ( 
        !socket || 
        socket.readyState !== 
            WebSocket.OPEN 
    ) { 
        return; 
    } 
	 
    socket.send( 
        JSON.stringify({ 
            protocol: "cardgame", 
            version: 1, 
            request: "get_time" 
        }) 
    ); 
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
	 
const screenHeaders = document.querySelectorAll('.tabHeader'); 
	 
screenHeaders.forEach(header => { 
    header.remove(); 
}); 
	 
setTimeout(() => { 
    loadingScreen.classList.add('hidden'); 
    mainScreen.classList.remove('hidden'); 
    maybePlayRngLaunchFlash(); 
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

    if (screen === generateScreen) {
        handleRngGenerateTabActivation();
    } else {
        clearRngRarityTheme();
    }
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
    const positions = []; 
	 
    const usableHeight = Math.max( 
        0, 
        pageHeight - (edgeInset * 2) 
    ); 
	 
    const indicatorCount = Math.max( 
        1, 
        Math.floor(usableHeight / spacing) + 1 
    ); 
	 
    if (indicatorCount === 1) { 
        positions.push(pageHeight / 2); 
    } else { 
        for (let i = 0; i < indicatorCount; i++) { 
            positions.push(edgeInset + (i * spacing)); 
        } 
    } 
	 
    scrollRail.style.height = `${pageHeight}px`; 
    scrollRail.innerHTML = ''; 
	 
    for (let i = 0; i < positions.length; i++) { 
        const indicator = document.createElement('div'); 
        indicator.className = 'scrollIndicator'; 
        indicator.innerHTML = '<span>→</span><strong>SCROLL</strong><span>←</span>'; 
        indicator.style.top = `${positions[i]}px`; 
	 
        if (positions.length === 1) { 
            indicator.classList.add('singleScrollIndicator'); 
        } else if (i === 0) { 
            indicator.classList.add('firstScrollIndicator'); 
        } else if (i === positions.length - 1) { 
            indicator.classList.add('lastScrollIndicator'); 
        } 
	 
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
        let x = 0; 
        let y = 0; 
        let angle = 0; 
	 
        if (elapsed < 5000) { 
            const progress = Math.min(elapsed / 5000, 1); 
            const tilt = 0.2 + progress * 1.3; 
            angle = Math.sin(elapsed / 140) * tilt; 
        } else { 
            const progress = Math.min((elapsed - 5000) / 5000, 1); 
            const intensity = 0.25 + progress * 0.75; 
            x = (Math.random() - 0.5) * 1.35 * intensity; 
            y = (Math.random() - 0.5) * 1.35 * intensity; 
            angle = (Math.random() - 0.5) * 0.3 * intensity; 
        } 
	 
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
    stopButtonEarthquake(button); 
	 
    button.querySelectorAll('.buttonEffectImage').forEach(image => { 
        image.remove(); 
    }); 
	 
    button.classList.remove('clickJerk'); 
	 
    void button.offsetWidth; 
	 
    button.classList.add('clickJerk'); 
	 
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
	 
    button.addEventListener('animationend', () => { 
        button.classList.remove('clickJerk'); 
    }, { once: true }); 
	 
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
	 
const RNG_RARITY_COLORS = { 
    common: "#dce7f0", 
    uncommon: "#4fd1c5", 
    rare: "#4da6ff", 
    legendary: "#ffd84d" 
}; 

const RNG_RARITY_THEME_CLASSES = [
    'rng-rarity-common',
    'rng-rarity-uncommon',
    'rng-rarity-rare',
    'rng-rarity-legendary'
];

const RNG_SCRAMBLE_DURATION = 5000;
const RNG_APPEAR_DURATION = 700;
const RNG_SCRAMBLE_TICK = 50;
const RNG_POP_INTERVAL = 400;
const RNG_POP_DURATION = 350;
	 
let rngRequestPending = false; 
let rngResultPanel = null; 
let rngScrambleTimer = null; 
let rngScrambleProgressTimer = null; 
let rngCountdownTimer = null; 
let rngDailyStatus = null; 
let rngDailyMessage = null; 
let rngDailyCountdown = null; 
let rngDailyActionArea = null; 
let rngTopControlArea = null;
let rngServerTimeBase = null; 
let rngPerformanceTimeBase = null; 
let rngNextResetTimestamp = null; 
let rngLocalRollState = null; 
let rngFrontendInitialized = false; 
let rngLaunchFlashPending = false; 
	 
function getRandomRngCharacter() { 
    const index = Math.floor( 
        Math.random() * rngRandomCharacters.length 
    ); 
	 
    return rngRandomCharacters[index]; 
} 
	 
function syncRngServerClock( 
    serverTime, 
    nextReset 
) { 
    if ( 
        typeof serverTime !== 'number' || 
        !Number.isFinite(serverTime) || 
        !nextReset || 
        typeof nextReset.timestamp !== 'number' || 
        !Number.isFinite(nextReset.timestamp) 
    ) { 
        return; 
    } 
	 
    rngServerTimeBase = 
        serverTime; 
	 
    rngPerformanceTimeBase = 
        performance.now(); 
	 
    rngNextResetTimestamp = 
        nextReset.timestamp; 
	 
    if (!rngFrontendInitialized) { 
        rngLocalRollState = null; 
        initializeRngFrontend(); 
    } 
	 
    updateRngDailyCountdown(); 
    maybePlayRngLaunchFlash(); 
} 
	 
function getRngServerNow() { 
    if ( 
        typeof rngServerTimeBase !== 'number' || 
        typeof rngPerformanceTimeBase !== 'number' 
    ) { 
        return null; 
    } 
	 
    return ( 
        rngServerTimeBase + 
        ( 
            performance.now() - 
            rngPerformanceTimeBase 
        ) 
    ); 
} 
	 
function formatRngCountdown(milliseconds) { 
    const totalSeconds = Math.max( 
        0, 
        Math.ceil(milliseconds / 1000) 
    ); 
	 
    const hours = Math.floor( 
        totalSeconds / 3600 
    ); 
	 
    const minutes = Math.floor( 
        (totalSeconds % 3600) / 60 
    ); 
	 
    const seconds = 
        totalSeconds % 60; 
	 
    return [ 
        String(hours).padStart(2, '0'), 
        String(minutes).padStart(2, '0'), 
        String(seconds).padStart(2, '0') 
    ].join(':'); 
} 
	 
function sanitizeRngStoredResult(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return null; 
    } 
	 
    return { 
        record: payload.record ?? '', 
        rarity: payload.rarity ?? 'Unknown', 
        points: payload.points ?? '0', 
        modifiers: payload.modifiers ?? [] 
    }; 
} 
	 
function loadLocalRngRollState() { 
    return null; 
} 
	 
function saveLocalRngRollState(payload) { 
    rngLocalRollState = null; 
} 
	 
function clearLocalRngRollState() { 
    rngLocalRollState = null; 
} 
	 
function createRngTopControlArea() {
    if (rngTopControlArea) {
        return;
    }

    rngTopControlArea =
        document.createElement('div');

    rngTopControlArea.className =
        'rngTopControlArea';

    generateScreen.appendChild(
        rngTopControlArea
    );
}

function createRngDailyStatus() { 
    if (rngDailyStatus) { 
        return; 
    } 

    createRngTopControlArea();
	 
    rngDailyStatus = 
        document.createElement('div'); 
	 
    rngDailyStatus.className = 
        'rngDailyStatus'; 
	 
    rngDailyMessage = 
        document.createElement('div'); 
	 
    rngDailyMessage.className = 
        'rngDailyMessage'; 
	 
    rngDailyMessage.textContent = 
        'You already rolled today.'; 
	 
    rngDailyCountdown = 
        document.createElement('div'); 
	 
    rngDailyCountdown.className = 
        'rngDailyCountdown'; 
	 
    rngDailyStatus.appendChild( 
        rngDailyMessage 
    ); 
	 
    rngDailyStatus.appendChild( 
        rngDailyCountdown 
    ); 
	 
    rngTopControlArea.appendChild( 
        rngDailyStatus 
    ); 
} 
	 
function updateRngDailyCountdown() { 
    hideRngDailyStatus(); 
} 
	 
function startRngDailyCountdown() { 
    stopRngDailyCountdown(); 
} 
	 
function stopRngDailyCountdown() { 
    if (!rngCountdownTimer) { 
        return; 
    } 
	 
    clearInterval( 
        rngCountdownTimer 
    ); 
	 
    rngCountdownTimer = null; 
} 
	 
function hideRngDailyStatus() { 
    if (!rngDailyStatus) { 
        return; 
    } 
	 
    rngDailyStatus.classList.add( 
        'hidden' 
    ); 
} 
	 
function showRngDailyStatus() { 
    hideRngDailyStatus(); 
} 
	 
function clearRngRarityTheme() {
    if (!document.body) {
        return;
    }

    RNG_RARITY_THEME_CLASSES.forEach(className => {
        document.body.classList.remove(className);
    });
}

function normalizeRngRarity(rarity) {
    if (typeof rarity !== 'string') {
        return 'unknown';
    }

    const normalized = rarity.trim().toLowerCase();

    if (!RNG_RARITY_COLORS[normalized]) {
        return 'unknown';
    }

    return normalized;
}

function applyRngRarityTheme(rarity) {
    clearRngRarityTheme();

    const normalized = normalizeRngRarity(rarity);

    if (
        normalized !== 'unknown'
    ) {
        document.body.classList.add(
            `rng-rarity-${normalized}`
        );
    }

    return normalized;
}

function playRngLaunchFlash() { 
    const existingFlash = 
        document.querySelector( 
            '.rngLaunchFlash' 
        ); 
	 
    if (existingFlash) { 
        existingFlash.remove(); 
    } 
	 
    const flash = 
        document.createElement('div'); 
	 
    flash.className = 
        'rngLaunchFlash'; 
	 
    document.body.appendChild( 
        flash 
    ); 
	 
    flash.addEventListener( 
        'animationend', 
        () => { 
            flash.remove(); 
        }, 
        { once: true } 
    ); 
} 

function requestRngLaunchFlash() {
    rngLaunchFlashPending = true;
    maybePlayRngLaunchFlash();
}
	 
function maybePlayRngLaunchFlash() { 
    if ( 
        !rngLaunchFlashPending || 
        !mainScreen || 
        mainScreen.classList.contains('hidden') 
    ) { 
        return; 
    } 
	 
    rngLaunchFlashPending = false; 
    playRngLaunchFlash(); 
}

function scrollRngResultIntoView(element) {
    if (!element) {
        return;
    }

    requestAnimationFrame(() => {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    });
}

function handleRngGenerateTabActivation() {
    if (
        !generateScreen ||
        generateScreen.classList.contains('hidden')
    ) {
        return;
    }

    if (
        rngResultPanel
    ) {
        const card =
            rngResultPanel.querySelector(
                '.rngRecordCard'
            );

        if (card) {
            applyRngRarityTheme(
                card.classList.contains('rng-rarity-common')
                    ? 'common'
                    : card.classList.contains('rng-rarity-uncommon')
                        ? 'uncommon'
                        : card.classList.contains('rng-rarity-rare')
                            ? 'rare'
                            : card.classList.contains('rng-rarity-legendary')
                                ? 'legendary'
                                : 'unknown'
            );

            scrollRngResultIntoView(card);
            animateRngRecordCard(card);
            requestRngLaunchFlash();
        }

        return;
    }

    clearRngRarityTheme();

    if (!rngRequestPending) {
        initializeRngGenerateButton();
    }
}
	 
function animateRngRecordCard(card) { 
    if (!card) { 
        return; 
    } 
	 
    const childElements = 
        card.querySelectorAll( 
            '.rngRecordLabel, .rngRecordValue, .rngStat, .rngStatLabel, .rngStatValue, .rngModifiersTitle, .rngModifier, .rngModifierName, .rngModifierValue, .rngNoModifiers' 
        ); 

    const elements = [
        card,
        ...childElements
    ];

    elements.forEach( 
        (element, index) => { 
            element.style.setProperty( 
                '--rng-pop-delay', 
                `${index * (RNG_POP_INTERVAL / 1000)}s` 
            ); 

            element.classList.remove( 
                'rngResultPopIn' 
            ); 

            element.style.opacity = 
                '0'; 

            element.style.transform = 
                'translateY(12px) scale(0.88)'; 

            void element.offsetWidth; 

            element.classList.add( 
                'rngResultPopIn' 
            ); 
        } 
    ); 
} 
	 
function resetDailyRngFrontend() { 
    stopRngDailyCountdown(); 
    clearLocalRngRollState(); 
    clearRngRarityTheme();
	 
    if (rngResultPanel) { 
        rngResultPanel.remove(); 
        rngResultPanel = null; 
    } 
	 
    hideRngDailyStatus(); 
	 
    if (rngDailyActionArea) { 
        rngDailyActionArea.remove(); 
        rngDailyActionArea = null; 
    } 
	 
    requestRngServerTime(); 
    initializeRngGenerateButton();
    updateScrollRail(); 
} 
	 
function markRngRollComplete(payload) { 
    clearLocalRngRollState();
    hideRngDailyStatus();

    if (rngDailyActionArea) { 
        rngDailyActionArea.remove(); 
        rngDailyActionArea = null; 
    } 
} 
	 
function applyDailyRollState(state) { 
    return; 
} 
	 
function renderStoredRngResult(payload) { 
    if (rngResultPanel) { 
        rngResultPanel.remove(); 
        rngResultPanel = null; 
    } 

    applyRngRarityTheme(
        payload && payload.rarity
    );
	 
    rngResultPanel = 
        document.createElement('div'); 
	 
    rngResultPanel.className = 
        'rngResultPanel'; 
	 
    generateScreen.appendChild( 
        rngResultPanel 
    ); 
	 
    rngResultPanel.appendChild( 
        createRngRecordCard( 
            payload, 
            String( 
                payload.record ?? '' 
            ) 
        ) 
    ); 
	 
    const card = 
        rngResultPanel.querySelector( 
            '.rngRecordCard' 
        ); 
	 
    scrollRngResultIntoView(card);
    requestRngLaunchFlash();
    animateRngRecordCard(card); 
    updateScrollRail(); 
} 
	 
function normalizeRngModifiers(modifiers) { 
    if (Array.isArray(modifiers)) { 
        return modifiers.map((modifier, index) => { 
            if ( 
                modifier && 
                typeof modifier === 'object' && 
                !Array.isArray(modifier) 
            ) { 
                const label = 
                    modifier.name ?? 
                    modifier.modifier ?? 
                    modifier.type ?? 
                    modifier.id ?? 
                    `Modifier ${index + 1}`; 
	 
                const detailEntries = Object.entries(modifier) 
                    .filter(([key]) => { 
                        return !['name', 'modifier', 'type', 'id'].includes(key); 
                    }); 
	 
                let detail = ''; 
	 
                if (detailEntries.length === 1) { 
                    detail = formatRngValue(detailEntries[0][1]); 
                } else if (detailEntries.length > 1) { 
                    detail = detailEntries 
                        .map(([key, value]) => { 
                            return `${key}: ${formatRngValue(value)}`; 
                        }) 
                        .join(' • '); 
                } 
	 
                return { 
                    label: String(label), 
                    value: detail 
                }; 
            } 
	 
            return { 
                label: `Modifier ${index + 1}`, 
                value: formatRngValue(modifier) 
            }; 
        }); 
    } 
	 
    if ( 
        modifiers && 
        typeof modifiers === 'object' && 
        !Array.isArray(modifiers) 
    ) { 
        return Object.entries(modifiers).map(([key, value]) => { 
            if ( 
                value && 
                typeof value === 'object' && 
                !Array.isArray(value) 
            ) { 
                const entries = Object.entries(value); 
	 
                const detail = entries 
                    .map(([entryKey, entryValue]) => { 
                        return `${entryKey}: ${formatRngValue(entryValue)}`; 
                    }) 
                    .join(' • '); 
	 
                return { 
                    label: key, 
                    value: detail 
                }; 
            } 
	 
            return { 
                label: key, 
                value: formatRngValue(value) 
            }; 
        }); 
    } 
	 
    if ( 
        modifiers !== undefined && 
        modifiers !== null && 
        modifiers !== '' 
    ) { 
        return [{ 
            label: 'Modifier', 
            value: formatRngValue(modifiers) 
        }]; 
    } 
	 
    return []; 
} 
	 
function formatRngValue(value) { 
    if (value === null || value === undefined) { 
        return ''; 
    } 
	 
    if (typeof value === 'string') { 
        return value; 
    } 
	 
    if ( 
        typeof value === 'number' || 
        typeof value === 'boolean' 
    ) { 
        return String(value); 
    } 
	 
    try { 
        return JSON.stringify(value); 
    } catch (err) { 
        return String(value); 
    } 
} 
	 
function getRngRarityColor(rarity) { 
    if (typeof rarity !== 'string') { 
        return '#edf6fb'; 
    } 
	 
    return RNG_RARITY_COLORS[ 
        rarity.trim().toLowerCase() 
    ] ?? '#edf6fb'; 
} 
	 
function createRngStat(label, value, valueColor = null) { 
    const stat = document.createElement('div'); 
    stat.className = 'rngStat'; 
	 
    const statLabel = document.createElement('div'); 
    statLabel.className = 'rngStatLabel'; 
    statLabel.textContent = label; 
	 
    const statValue = document.createElement('div'); 
    statValue.className = 'rngStatValue'; 
    statValue.textContent = formatRngValue(value); 
	 
    if (valueColor) { 
        statValue.style.color = valueColor; 
        statValue.style.textShadow = 
            `0 0 8px ${valueColor}55`; 
    } 
	 
    stat.appendChild(statLabel); 
    stat.appendChild(statValue); 
	 
    return stat; 
} 
	 
function createRngRecordCard(payload, recordText) { 
    const card = document.createElement('div'); 
    card.className = 'rngRecordCard'; 
	 
    const rarity = 
        typeof payload.rarity === 'string' 
            ? payload.rarity.trim().toLowerCase() 
            : 'unknown'; 

    const normalizedRarity =
        normalizeRngRarity(rarity);

    if (normalizedRarity !== 'unknown') {
        card.classList.add(
            `rng-rarity-${normalizedRarity}`
        );
    }
	 
    const recordHeader = document.createElement('div'); 
    recordHeader.className = 'rngRecordHeader'; 
	 
    const recordLabel = document.createElement('div'); 
    recordLabel.className = 'rngRecordLabel'; 
    recordLabel.textContent = 'Record'; 
	 
    const recordValue = document.createElement('div'); 
    recordValue.className = 'rngRecordValue'; 
    recordValue.textContent = recordText; 
	 
    recordHeader.appendChild(recordLabel); 
    recordHeader.appendChild(recordValue); 
    card.appendChild(recordHeader); 
	 
    const stats = document.createElement('div'); 
    stats.className = 'rngStats'; 
	 
    stats.appendChild( 
        createRngStat( 
            'Rarity', 
            payload.rarity ?? 'Unknown', 
            getRngRarityColor(rarity) 
        ) 
    ); 
	 
    stats.appendChild( 
        createRngStat( 
            'Points', 
            payload.points ?? '0' 
        ) 
    ); 
	 
    card.appendChild(stats); 
	 
    const modifiersSection = document.createElement('div'); 
    modifiersSection.className = 'rngModifiersSection'; 
	 
    const modifiersTitle = document.createElement('div'); 
    modifiersTitle.className = 'rngModifiersTitle'; 
    modifiersTitle.textContent = 'Modifiers'; 
	 
    modifiersSection.appendChild( 
        modifiersTitle 
    ); 
	 
    const modifiersGrid = document.createElement('div'); 
    modifiersGrid.className = 'rngModifiers'; 
	 
    const modifiers = normalizeRngModifiers( 
        payload.modifiers 
    ); 
	 
    if (modifiers.length === 0) { 
        const none = document.createElement('div'); 
        none.className = 'rngNoModifiers'; 
        none.textContent = 'No modifiers'; 
        modifiersGrid.appendChild(none); 
    } else { 
        modifiers.forEach(modifier => { 
            const modifierCard = document.createElement('div'); 
            modifierCard.className = 'rngModifier'; 
	 
            const modifierName = document.createElement('div'); 
            modifierName.className = 'rngModifierName'; 
            modifierName.textContent = modifier.label; 
	 
            const modifierValue = document.createElement('div'); 
            modifierValue.className = 'rngModifierValue'; 
            modifierValue.textContent = modifier.value; 
	 
            modifierCard.appendChild(modifierName); 
            modifierCard.appendChild(modifierValue); 
            modifiersGrid.appendChild(modifierCard); 
        }); 
    } 
	 
    modifiersSection.appendChild(modifiersGrid); 
    card.appendChild(modifiersSection); 
	 
    return card; 
} 
	 
function showRngRecordResult(payload) { 
    if (rngScrambleTimer) { 
        clearInterval(rngScrambleTimer); 
        rngScrambleTimer = null; 
    } 
	 
    if (rngScrambleProgressTimer) { 
        clearInterval(rngScrambleProgressTimer); 
        rngScrambleProgressTimer = null; 
    } 
	 
    if (rngResultPanel) { 
        rngResultPanel.remove(); 
        rngResultPanel = null; 
    } 
	 
    if ( 
        !payload || 
        typeof payload !== 'object' || 
        payload.record === undefined 
    ) { 
        errorMessage.textContent = 
            "⚠️ Invalid RNG result structure."; 
        errorMessage.classList.remove("hidden"); 
        initializeRngGenerateButton();
        return; 
    } 

    applyRngRarityTheme(
        payload.rarity
    );
	 
    rngResultPanel = document.createElement('div'); 
    rngResultPanel.className = 'rngResultPanel'; 
	 
    const scramble = document.createElement('div'); 
    scramble.className = 'rngScramble'; 
    scramble.style.visibility = 'visible';
    scramble.style.opacity = '1';
    scramble.style.display = 'flex';
	 
    rngResultPanel.appendChild(scramble); 
    generateScreen.appendChild(rngResultPanel); 

    scrollRngResultIntoView(scramble);
	 
    const recordText = String(payload.record); 
	 
    if (recordText.length === 0) { 
        scramble.textContent = ''; 
	 
        const card = 
            createRngRecordCard( 
                payload, 
                recordText 
            ); 
	 
        rngResultPanel.appendChild(card); 
        scrollRngResultIntoView(card);
        requestRngLaunchFlash();
        animateRngRecordCard(card); 
	 
        updateScrollRail(); 
        initializeRngGenerateButton();
        return; 
    } 
	 
    const scrambleCharacters = 
        new Array( 
            recordText.length 
        ).fill(''); 
	 
    let appearedCount = 0; 
    let lockedCount = 0; 
	 
    function renderScramble() { 
        let output = ''; 
	 
        for ( 
            let i = 0; 
            i < recordText.length; 
            i++ 
        ) { 
            if (i < lockedCount) { 
                output += recordText[i]; 
            } else if (i < appearedCount) { 
                output += scrambleCharacters[i]; 
            } else { 
                output += '\u00A0'; 
            } 
        } 
	 
        scramble.textContent = output; 
    } 
	 
    function rapidlyScramble() { 
        for ( 
            let i = lockedCount; 
            i < appearedCount; 
            i++ 
        ) { 
            scrambleCharacters[i] = 
                getRandomRngCharacter(); 
        } 
	 
        renderScramble(); 
    } 

    function finishRngScramble() {
        if (rngScrambleProgressTimer) {
            clearInterval(
                rngScrambleProgressTimer
            );

            rngScrambleProgressTimer = null;
        }

        if (rngScrambleTimer) {
            clearInterval(
                rngScrambleTimer
            );

            rngScrambleTimer = null;
        }

        lockedCount =
            recordText.length;

        appearedCount =
            recordText.length;

        scramble.textContent =
            recordText;

        const card =
            createRngRecordCard(
                payload,
                recordText
            );

        rngResultPanel.appendChild(
            card
        );

        scrollRngResultIntoView(card);
        requestRngLaunchFlash();

        animateRngRecordCard(
            card
        );

        initializeRngGenerateButton();
        updateScrollRail();
    }
	 
    scramble.textContent = 
        '\u00A0'.repeat( 
            recordText.length 
        ); 
	 
    const scrambleStartTime =
        performance.now();

    rngScrambleProgressTimer =
        setInterval(() => {
            const elapsed =
                performance.now() -
                scrambleStartTime;

            const totalProgress =
                Math.min(
                    elapsed /
                        RNG_SCRAMBLE_DURATION,
                    1
                );

            if (
                elapsed <
                RNG_APPEAR_DURATION
            ) {
                const appearanceProgress =
                    Math.min(
                        elapsed /
                            RNG_APPEAR_DURATION,
                        1
                    );

                appearedCount =
                    Math.min(
                        recordText.length,
                        Math.max(
                            1,
                            Math.ceil(
                                appearanceProgress *
                                    recordText.length
                            )
                        )
                    );

                lockedCount = 0;
            } else {
                appearedCount =
                    recordText.length;

                const unscrambleDuration =
                    RNG_SCRAMBLE_DURATION -
                    RNG_APPEAR_DURATION;

                const unscrambleElapsed =
                    Math.min(
                        elapsed -
                            RNG_APPEAR_DURATION,
                        unscrambleDuration
                    );

                const unscrambleProgress =
                    Math.min(
                        unscrambleElapsed /
                            unscrambleDuration,
                        1
                    );

                lockedCount =
                    Math.floor(
                        unscrambleProgress *
                            recordText.length
                    );
            }

            rapidlyScramble();

            if (
                totalProgress >= 1
            ) {
                finishRngScramble();
            }
        }, RNG_SCRAMBLE_TICK);
} 
	 
function initializeRngGenerateButton() { 
    if (!generateScreen) { 
        return; 
    } 
	 
    if (rngDailyActionArea) { 
        return; 
    } 
	 
    if (rngRequestPending) { 
        return; 
    } 

    createRngTopControlArea();
	 
    const actionArea = 
        document.createElement('div'); 
	 
    actionArea.className = 
        'rngActionArea'; 
	 
    const button = 
        document.createElement('button'); 
	 
    button.id = 
        'generateRecordButton'; 
	 
    button.className = 
        'rngGenerateButton'; 
	 
    button.type = 
        'button'; 
	 
    button.textContent = 
        'Generate Record'; 
	 
    actionArea.appendChild( 
        button 
    ); 
	 
    rngTopControlArea.appendChild( 
        actionArea 
    ); 
	 
    rngDailyActionArea = 
        actionArea; 
	 
    button.addEventListener( 
        'pointerenter', 
        () => { 
            startNormalButtonWiggle( 
                button 
            ); 
        } 
    ); 
	 
    button.addEventListener( 
        'pointerleave', 
        () => { 
            stopNormalButtonWiggle( 
                button 
            ); 
        } 
    ); 
	 
    button.addEventListener( 
        'focus', 
        () => { 
            startNormalButtonWiggle( 
                button 
            ); 
        } 
    ); 
	 
    button.addEventListener( 
        'blur', 
        () => { 
            stopNormalButtonWiggle( 
                button 
            ); 
        } 
    ); 
	 
    button.addEventListener( 
        'click', 
        () => { 
            actionArea.remove(); 
            rngDailyActionArea = null; 
	 
            rngRequestPending = true; 
	 
            if ( 
                !socket || 
                socket.readyState !== 
                    WebSocket.OPEN 
            ) { 
                rngRequestPending = false; 
	 
                errorMessage.textContent = 
                    "⚠️ Action Cancelled: Socket State is [NOT_OPEN]. Check the error log banner."; 
	 
                errorMessage.classList.remove( 
                    "hidden" 
                ); 
	 
                initializeRngGenerateButton(); 
                return; 
            } 
	 
            socket.send( 
                JSON.stringify({ 
                    protocol: "cardgame", 
                    version: 1, 
                    request: "rng_go" 
                }) 
            ); 
        } 
    ); 
} 
	 
function initializeRngFrontend() { 
    if ( 
        !generateScreen || 
        rngFrontendInitialized 
    ) { 
        return; 
    } 
	 
    rngFrontendInitialized = true; 
	 
    createRngTopControlArea();
    createRngDailyStatus(); 
    hideRngDailyStatus(); 
    clearRngRarityTheme(); 
    initializeRngGenerateButton(); 

    updateRngDailyCountdown(); 
    maybePlayRngLaunchFlash(); 
}