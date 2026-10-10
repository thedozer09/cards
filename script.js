const screen1 = document.getElementById('screen1');  
const screen2 = document.getElementById('screen2');  
const testButton = document.getElementById('testButton');  
const rngButton = document.getElementById('rngButton');  
const errorMessage = document.getElementById('errorMessage');  
const activityMusic = document.getElementById('activityMusic'); 
const musicToggleButton = document.getElementById('musicToggleButton');  
const tosGate = document.getElementById('tosGate');
const tosAgreeButton = document.getElementById('tosAgreeButton');

let socket = null;  
let activityMusicStarted = false; 
let tosAcceptanceKnown = false;
let appLaunchStarted = false;
let appLaunchTimer = null;

function updateActivityMusicButton() { 
    if (!musicToggleButton) { 
        return; 
    } 

    musicToggleButton.removeAttribute( 
        'title' 
    ); 

    if ( 
        activityMusic && 
        activityMusic.muted 
    ) { 
        musicToggleButton.textContent = '🔇'; 
        musicToggleButton.setAttribute( 
            'aria-label', 
            'Unmute music' 
        ); 
    } else { 
        musicToggleButton.textContent = '🔊'; 
        musicToggleButton.setAttribute( 
            'aria-label', 
            'Mute music' 
        ); 
    } 
} 

function startActivityMusic() { 
    if (!activityMusic) { 
        return; 
    } 

    activityMusic.volume = 0.5; 
    activityMusic.loop = true; 

    if ( 
        activityMusic.muted 
    ) { 
        return; 
    } 

    const playPromise = 
        activityMusic.play(); 

    if ( 
        playPromise && 
        typeof playPromise.catch === 'function' 
    ) { 
        playPromise 
            .then(() => { 
                activityMusicStarted = true; 
            }) 
            .catch(() => { 
            }); 
    } 
} 

function initializeActivityMusic() { 
    if ( 
        !activityMusic 
    ) { 
        return; 
    } 

    activityMusic.volume = 0.5; 
    activityMusic.loop = true; 

    updateActivityMusicButton(); 
    startActivityMusic(); 

    const startFromInteraction = () => { 
        if ( 
            !activityMusicStarted && 
            !activityMusic.muted 
        ) { 
            startActivityMusic(); 
        } 
    }; 

    document.addEventListener( 
        'pointerdown', 
        startFromInteraction, 
        { once: true } 
    ); 

    document.addEventListener( 
        'keydown', 
        startFromInteraction, 
        { once: true } 
    ); 

    if ( 
        musicToggleButton 
    ) { 
        musicToggleButton.addEventListener( 
            'click', 
            () => { 
                if ( 
                    activityMusic.muted 
                ) { 
                    activityMusic.muted = false; 
                    startActivityMusic(); 
                } else { 
                    activityMusic.muted = true; 
                } 

                updateActivityMusicButton(); 
            } 
        ); 
    } 
} 

function showTosGate() {
    tosAcceptanceKnown = true;

    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }

    if (mainScreen) {
        mainScreen.classList.add('hidden');
    }

    if (tosGate) {
        tosGate.classList.remove('hidden');
    }
}

function handleTosStatusMessage(message) {
    if (
        !message ||
        typeof message !== 'object' ||
        message.type !== 'tos_accepted'
    ) {
        return false;
    }

    if (
        !message.data ||
        typeof message.data.accepted !== 'boolean'
    ) {
        showTosGate();
        return true;
    }

    if (message.data.accepted === true) {
        tosAcceptanceKnown = true;
        showLoadingScreenAndLaunch();
    } else {
        showTosGate();
    }

    return true;
}

function sendTosRequestAndContinue() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        if (errorMessage) {
            errorMessage.textContent = '⚠️ The connection is not ready yet. Please try again.';
            errorMessage.classList.remove('hidden');
        }
        return;
    }

    try {
        socket.send(JSON.stringify({
            protocol: 'cardgame',
            version: 1,
            request: 'tos_request'
        }));

        tosAcceptanceKnown = true;

        if (tosGate) {
            tosGate.classList.add('hidden');
        }

        showLoadingScreenAndLaunch();
    } catch (err) {
        if (errorMessage) {
            errorMessage.textContent = '⚠️ Could not send the Terms of Service request. Please try again.';
            errorMessage.classList.remove('hidden');
        }
    }
}

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

            if (handleTosStatusMessage(data)) {
                return;
            }

            if (data.type === "connected") {  
                console.log("Card game connection established");  
                return;  
            }  

            if (handleCardGameStatsMessage(data)) {
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

            if (data.type === "rng_lifetime_updated") {  
                if (  
                    !data.data ||  
                    typeof data.data.lifetimeRecordScore !== 'number' ||  
                    !Number.isFinite(data.data.lifetimeRecordScore)  
                ) {  
                    errorMessage.textContent =  
                        "⚠️ Invalid lifetime score update response.";  

                    errorMessage.classList.remove(  
                        "hidden"  
                    );  

                    return;  
                }  

                applyRngLifetimeUpdateResult(  
                    data.data.lifetimeRecordScore  
                );  

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
            errorMessage.textContent = `⚠️ Disconnected (Code: ${event.code}). Reason: ${event.reason || 'Game had a issue keeping a stable connection, please reconnect.'}`;  
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
        request: "rng_go"  
    }));  
});  

initializeActivityMusic(); 
initializeWebSocket();  

const loadingScreen = document.getElementById('loadingScreen');  
const mainScreen = document.getElementById('mainScreen');  
const generateButton = document.getElementById('generateButton');  
const leaderboardsButton = document.getElementById('leaderboardsButton');  
const cardsButton = document.getElementById('cardsButton');  
const statsButton = document.getElementById('statsButton');
const generateScreen = document.getElementById('generateScreen');  
const leaderboardsScreen = document.getElementById('leaderboardsScreen');  
const cardsScreen = document.getElementById('cardsScreen');  
const statsScreen = document.getElementById('statsScreen');
const leaderboardsSubnav = document.getElementById('leaderboardsSubnav');
const cardsSubnav = document.getElementById('cardsSubnav');
const leaderboardsContent = document.getElementById('leaderboardsContent');
const cardsContent = document.getElementById('cardsContent');
const rngTodayButton = document.getElementById('rngTodayButton');
const rngAllTimeButton = document.getElementById('rngAllTimeButton');
const cardsNetWorthButton = document.getElementById('cardsNetWorthButton');
const dailyPackScoreButton = document.getElementById('dailyPackScoreButton');
const openPackButton = document.getElementById('openPackButton');
const myCollectionButton = document.getElementById('myCollectionButton');
const tradesButton = document.getElementById('tradesButton');

function createCardGameTermsPanel() {
    const currentTosGate = document.getElementById('tosGate');

    if (!currentTosGate) {
        return null;
    }

    let panel = currentTosGate.querySelector('#cardGameTosDetails');

    if (panel) {
        return panel;
    }

    panel = document.createElement('section');
    panel.id = 'cardGameTosDetails';
    panel.className = 'cardGameTosDetails hidden';
    panel.setAttribute('aria-label', 'Card Game Terms of Service');

    const heading = document.createElement('h3');
    heading.className = 'cardGameTosDetailsHeading';
    heading.textContent = 'Card Game Terms of Service';

    const content = document.createElement('div');
    content.className = 'cardGameTosDetailsContent';
    content.textContent = '[PLACEHOLDER: Paste the Card Game Terms of Service here.]';

    panel.append(heading, content);
    currentTosGate.appendChild(panel);

    return panel;
}

function initializeCardGameTermsToggle() {
    const currentTosGate = document.getElementById('tosGate');

    if (!currentTosGate) {
        return;
    }

    let links = Array.from(currentTosGate.querySelectorAll('a')).filter(link => {
        return (
            link.id === 'tosLink' ||
            link.hasAttribute('data-card-game-tos') ||
            /terms of service|card game terms/i.test(link.textContent || '')
        );
    });

    if (links.length === 0) {
        const firstLink = currentTosGate.querySelector('a');

        if (firstLink) {
            links = [firstLink];
        }
    }

    if (links.length === 0) {
        return;
    }

    const panel = createCardGameTermsPanel();

    if (!panel) {
        return;
    }

    links.forEach(link => {
        link.classList.add('tosTermsToggle');
        link.removeAttribute('href');
        link.removeAttribute('target');
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.setAttribute('aria-controls', panel.id);
        link.setAttribute('aria-expanded', 'false');

        const togglePanel = () => {
            const isOpening = panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !isOpening);
            link.setAttribute('aria-expanded', String(isOpening));

            if (isOpening) {
                panel.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        };

        link.addEventListener('click', event => {
            event.preventDefault();
            togglePanel();
        });

        link.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                togglePanel();
            }
        });
    });
}

function initializeSimpleButtonEffects() {
    const simpleButtons = new Set([
        tosAgreeButton,
        statsButton,
        ...document.querySelectorAll('#leaderboardsSubnav button, #cardsSubnav button')
    ]);

    simpleButtons.forEach(button => {
        if (
            !button ||
            button.dataset.simpleButtonEffectsInitialized === 'true'
        ) {
            return;
        }

        button.dataset.simpleButtonEffectsInitialized = 'true';
        button.classList.add('simpleStyledButton');

        button.addEventListener('pointerenter', () => {
            startNormalButtonWiggle(button);
        });

        button.addEventListener('pointerleave', () => {
            stopNormalButtonWiggle(button);
        });

        button.addEventListener('focus', () => {
            startNormalButtonWiggle(button);
        });

        button.addEventListener('blur', () => {
            stopNormalButtonWiggle(button);
        });

        button.addEventListener('click', () => {
            const shouldResumeWiggle = button.matches(':hover');

            stopNormalButtonWiggle(button);
            button.classList.remove('simpleButtonJerk');
            void button.offsetWidth;
            button.classList.add('simpleButtonJerk');

            const finishJerk = event => {
                if (
                    event.target !== button ||
                    event.animationName !== 'simpleButtonJerk'
                ) {
                    return;
                }

                button.classList.remove('simpleButtonJerk');
                button.removeEventListener('animationend', finishJerk);

                if (shouldResumeWiggle && button.matches(':hover')) {
                    startNormalButtonWiggle(button);
                }
            };

            button.addEventListener('animationend', finishJerk);
        });
    });
}

initializeCardGameTermsToggle();
initializeSimpleButtonEffects();

const screenHeaders = document.querySelectorAll('.tabHeader');  

screenHeaders.forEach(header => {  
    header.remove();  
});  

const TAB_LOADING_DURATION = 3000; 
const RNG_ROLL_LOADING_DURATION = 3000; 
const RNG_LOCAL_ROLL_STORAGE_KEY = 'cardgame_rng_next_roll_timestamp'; 
const RNG_LOCAL_RESULT_STORAGE_KEY = 'cardgame_rng_last_result'; 
const tabLoadingStates = new Map(); 

errorMessage.style.zIndex = '100000'; 
errorMessage.style.position = 'fixed'; 

function createTabLoadingScreen(screen, label) { 
    if (!screen) { 
        return null; 
    } 

    const existing = 
        screen.querySelector( 
            '.tabLoadingScreen' 
        ); 

    if (existing) { 
        return existing; 
    } 

    screen.style.position = 'relative'; 

    const loader = 
        document.createElement('div'); 

    loader.className = 
        'tabLoadingScreen'; 

    loader.style.position = 'absolute'; 
    loader.style.top = '0'; 
    loader.style.right = '0'; 
    loader.style.bottom = '0'; 
    loader.style.left = '0'; 
    loader.style.zIndex = '9990'; 
    loader.style.display = 'flex'; 
    loader.style.alignItems = 'center'; 
    loader.style.justifyContent = 'center'; 
    loader.style.padding = '24px'; 
    loader.style.background = 'rgba(10, 22, 36, 0.86)'; 
    loader.style.pointerEvents = 'auto'; 

    const content = 
        document.createElement('div'); 

    content.style.display = 'flex'; 
    content.style.alignItems = 'center'; 
    content.style.justifyContent = 'center'; 
    content.style.textAlign = 'center'; 

    const title = 
        document.createElement('div'); 

    title.textContent = 
        'Loading...'; 

    title.style.margin = '0'; 
    title.style.color = '#dce7f0'; 
    title.style.fontSize = '20px'; 
    title.style.fontWeight = '700'; 
    title.style.letterSpacing = '0.2px'; 

    content.appendChild(title); 
    loader.appendChild(content); 
    screen.appendChild(loader); 

    loader.classList.add( 
        'hidden' 
    ); 

    return loader; 
} 

function initializeTabLoadingScreens() { 
    createTabLoadingScreen( 
        generateScreen, 
        'Generate' 
    ); 

    createTabLoadingScreen( 
        leaderboardsScreen, 
        'Leaderboards' 
    ); 

    createTabLoadingScreen( 
        cardsScreen, 
        'Cards' 
    ); 

    tabLoadingStates.set( 
        generateScreen, 
        { 
            loading: false, 
            loaded: true, 
            timer: null 
        } 
    ); 

    tabLoadingStates.set( 
        leaderboardsScreen, 
        { 
            loading: false, 
            loaded: false, 
            timer: null 
        } 
    ); 

    tabLoadingStates.set( 
        cardsScreen, 
        { 
            loading: false, 
            loaded: false, 
            timer: null 
        } 
    ); 
} 

function finishTabLoading(screen) { 
    const state = 
        tabLoadingStates.get(screen); 

    if (!state) { 
        return; 
    } 

    state.loading = false; 
    state.loaded = true; 

    if (state.timer) { 
        clearTimeout( 
            state.timer 
        ); 

        state.timer = null; 
    } 

    const loader = 
        screen.querySelector( 
            '.tabLoadingScreen' 
        ); 

    if (loader) { 
        loader.classList.add( 
            'hidden' 
        ); 
    } 
} 

function startTabLoading( 
    screen, 
    label, 
    callback 
) { 
    if (!screen) { 
        return; 
    } 

    let state = 
        tabLoadingStates.get(screen); 

    if (!state) { 
        state = { 
            loading: false, 
            loaded: false, 
            timer: null 
        }; 

        tabLoadingStates.set( 
            screen, 
            state 
        ); 
    } 

    const loader = 
        createTabLoadingScreen( 
            screen, 
            label 
        ); 

    if ( 
        state.loaded 
    ) { 
        if (loader) { 
            loader.classList.add( 
                'hidden' 
            ); 
        } 

        if (callback) { 
            callback(); 
        } 

        return; 
    } 

    if ( 
        state.loading 
    ) { 
        return; 
    } 

    state.loading = true; 

    if (loader) { 
        loader.classList.remove( 
            'hidden' 
        ); 
    } 

    state.timer = 
        setTimeout(() => { 
            finishTabLoading(screen); 

            if (callback) { 
                callback(); 
            } 
        }, TAB_LOADING_DURATION); 
} 

function startRngRollLoading(callback) { 
    const loader = 
        createTabLoadingScreen( 
            generateScreen, 
            'Generate' 
        ); 

    if (loader) { 
        loader.classList.remove( 
            'hidden' 
        ); 
    } 

    setTimeout(() => { 
        if (loader) { 
            loader.classList.add( 
                'hidden' 
            ); 
        } 

        if (callback) { 
            callback(); 
        } 
    }, RNG_ROLL_LOADING_DURATION); 
} 

initializeTabLoadingScreens(); 

function showLoadingScreenAndLaunch() {
    if (appLaunchStarted) {
        return;
    }

    appLaunchStarted = true;

    if (tosGate) {
        tosGate.classList.add('hidden');
    }

    loadingScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');

    appLaunchTimer = setTimeout(() => {
        loadingScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        statsScreen.classList.remove('hidden');
        statsButton.classList.add('active');
        updateScrollRail();
        requestCardGameStats();

        if ( 
            rngStoredResultScrollPending && 
            rngResultPanel 
        ) { 
            rngStoredResultScrollPending = 
                false; 

            scrollRngResultIntoView( 
                rngResultPanel.querySelector( 
                    '.rngRecordCard' 
                ) 
            ); 
        } 

        maybePlayRngLaunchFlash();  
    }, 3000);
}

if (tosAgreeButton) {
    tosAgreeButton.addEventListener('click', sendTosRequestAndContinue);
}



function hideAllMainScreens() {
    generateScreen.classList.add('hidden');
    leaderboardsScreen.classList.add('hidden');
    cardsScreen.classList.add('hidden');
    statsScreen.classList.add('hidden');
}

function setActiveTopButton(button) {
    generateButton.classList.remove('active');
    leaderboardsButton.classList.remove('active');
    cardsButton.classList.remove('active');
    statsButton.classList.remove('active');

    if (button) {
        button.classList.add('active');
    }
}

function updateSecondaryNavigation(screen) {
    leaderboardsSubnav.classList.add('hidden');
    cardsSubnav.classList.add('hidden');

    if (screen === leaderboardsScreen) {
        leaderboardsSubnav.classList.remove('hidden');
    } else if (screen === cardsScreen) {
        cardsSubnav.classList.remove('hidden');
    }
}

function switchTab(button, screen) {
    setActiveTopButton(button);
    hideAllMainScreens();
    screen.classList.remove('hidden');
    updateSecondaryNavigation(screen);

    if (screen === generateScreen) {
        handleRngGenerateTabActivation();
    } else if (screen === leaderboardsScreen) {
        startTabLoading(
            leaderboardsScreen,
            'Leaderboards'
        );

        clearRngRarityTheme();
    } else if (screen === cardsScreen) {
        startTabLoading(
            cardsScreen,
            'Cards'
        );

        clearRngRarityTheme();
    }

    updateScrollRail();
}

function switchToStats() {
    setActiveTopButton(statsButton);
    hideAllMainScreens();
    statsScreen.classList.remove('hidden');
    updateSecondaryNavigation(statsScreen);
    requestCardGameStats();
    clearRngRarityTheme();
    updateScrollRail();
}

function setSubnavSelection(button, parent, content, viewName, headingText) {
    if (!button || !parent || !content) {
        return;
    }

    parent.querySelectorAll('button').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
    });

    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    content.dataset.view = viewName;

    let heading = content.querySelector('.subviewHeading');

    if (!heading) {
        heading = document.createElement('h2');
        heading.className = 'subviewHeading';
        content.prepend(heading);
    }

    heading.textContent = headingText;

    if (content === cardsContent) {
        if (viewName === 'my-collection') {
            createCollectionStats();
            collectionStats.classList.remove('hidden');
            requestCardGameStats();

            if (latestCardGameStatsData) {
                updateCardGameCountDisplays(latestCardGameStatsData);
            }
        } else if (collectionStats) {
            collectionStats.classList.add('hidden');
        }
    }

    updateScrollRail();
}

generateButton.addEventListener('click', () => {
    switchTab(generateButton, generateScreen);
});

leaderboardsButton.addEventListener('click', () => {
    switchTab(leaderboardsButton, leaderboardsScreen);
    setSubnavSelection(
        rngTodayButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'rng-today',
        'RNG Today'
    );
});

cardsButton.addEventListener('click', () => {
    switchTab(cardsButton, cardsScreen);
    setSubnavSelection(
        openPackButton,
        cardsSubnav,
        cardsContent,
        'open-pack',
        'Open Pack'
    );
});

statsButton.addEventListener('click', switchToStats);

rngTodayButton.addEventListener('click', () => {
    setSubnavSelection(
        rngTodayButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'rng-today',
        'RNG Today'
    );
});

rngAllTimeButton.addEventListener('click', () => {
    setSubnavSelection(
        rngAllTimeButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'rng-all-time',
        'RNG All Time'
    );
});

cardsNetWorthButton.addEventListener('click', () => {
    setSubnavSelection(
        cardsNetWorthButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'cards-net-worth',
        'Cards Net Worth'
    );
});

dailyPackScoreButton.addEventListener('click', () => {
    setSubnavSelection(
        dailyPackScoreButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'daily-pack-score',
        "Today's Card Pack Score"
    );
});

openPackButton.addEventListener('click', () => {
    setSubnavSelection(
        openPackButton,
        cardsSubnav,
        cardsContent,
        'open-pack',
        'Open Pack'
    );
});

myCollectionButton.addEventListener('click', () => {
    setSubnavSelection(
        myCollectionButton,
        cardsSubnav,
        cardsContent,
        'my-collection',
        'My Collection'
    );
});

tradesButton.addEventListener('click', () => {
    setSubnavSelection(
        tradesButton,
        cardsSubnav,
        cardsContent,
        'trades',
        'Trades'
    );
});

const scrollRail = document.querySelector('.scrollRail');  

const statsValueElements = {};
let cardGameStatsRequested = false;
let cardGameStatsReceived = false;
let rngRecordsDiscoveredCount = null;
let collectionStats = null;
let collectionCardsDiscoveredValue = null;
let collectionCardsOwnedValue = null;
let latestCardGameStatsData = null;

function createRngRecordsDiscoveredCount() {
    if (!generateScreen || rngRecordsDiscoveredCount) {
        return;
    }

    rngRecordsDiscoveredCount = document.createElement('div');
    rngRecordsDiscoveredCount.className = 'rngRecordsDiscoveredCount';
    rngRecordsDiscoveredCount.style.color = '#fff';
    rngRecordsDiscoveredCount.textContent = '— out of — records discovered';
    generateScreen.appendChild(rngRecordsDiscoveredCount);

    if (latestCardGameStatsData) {
        updateCardGameCountDisplays(latestCardGameStatsData);
    }
}

function createCollectionStats() {
    if (!cardsContent || collectionStats) {
        return;
    }

    collectionStats = document.createElement('div');
    collectionStats.className = 'collectionStats hidden';
    collectionStats.style.color = '#fff';

    collectionCardsDiscoveredValue = document.createElement('div');
    collectionCardsDiscoveredValue.className = 'collectionCardsDiscovered';
    collectionCardsDiscoveredValue.textContent = 'Cards Discovered: —';

    collectionCardsOwnedValue = document.createElement('div');
    collectionCardsOwnedValue.className = 'collectionCardsOwned';
    collectionCardsOwnedValue.textContent = 'Cards Owned: —';

    collectionStats.append(
        collectionCardsDiscoveredValue,
        collectionCardsOwnedValue
    );

    cardsContent.appendChild(collectionStats);

    if (latestCardGameStatsData) {
        updateCardGameCountDisplays(latestCardGameStatsData);
    }
}

function updateCardGameCountDisplays(statsData) {
    const recordsDiscovered = statsData
        ? statsData.recordsDiscovered
        : undefined;
    const totalRecords = statsData
        ? statsData.totalRecords
        : undefined;

    if (rngRecordsDiscoveredCount) {
        rngRecordsDiscoveredCount.textContent =
            `${formatStatsValue(recordsDiscovered)} out of ${formatStatsValue(totalRecords)} records discovered`;
    }

    if (collectionCardsDiscoveredValue) {
        collectionCardsDiscoveredValue.textContent =
            `Cards Discovered: ${formatStatsValue(statsData ? statsData.cardsDiscovered : undefined)}`;
    }

    if (collectionCardsOwnedValue) {
        collectionCardsOwnedValue.textContent =
            `Cards Owned: ${formatStatsValue(statsData ? statsData.cardsOwned : undefined)}`;
    }
}

function createStatsScreen() {
    if (!statsScreen || statsScreen.dataset.initialized === 'true') {
        return;
    }

    statsScreen.replaceChildren();

    const header = document.createElement('div');
    header.className = 'statsHeader';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'tabEyebrow';
    eyebrow.textContent = 'PROFILE';

    const title = document.createElement('h1');
    title.textContent = 'Stats';

    header.append(eyebrow, title);

    const profile = document.createElement('div');
    profile.className = 'statsProfile';

    const avatar = document.createElement('img');
    avatar.id = 'statsProfileAvatar';
    avatar.className = 'statsProfileAvatar';
    avatar.alt = 'Profile picture';
    avatar.hidden = true;

    const identity = document.createElement('div');
    identity.className = 'statsProfileIdentity';

    const username = document.createElement('h2');
    username.id = 'statsProfileUsername';
    username.textContent = 'Loading profile...';

    identity.appendChild(username);
    profile.append(avatar, identity);

    const grid = document.createElement('div');
    grid.className = 'statsGrid';

    const stats = [
        ['rolls', 'Rolls'],
        ['recordsDiscovered', 'Records Discovered'],
        ['cardsDiscovered', 'Cards Discovered'],
        ['cardsOwned', 'Cards Owned'],
        ['packsOpened', 'Packs Opened'],
        ['tradesCompleted', 'Trades Completed']
    ];

    stats.forEach(([key, label]) => {
        const item = document.createElement('div');
        item.className = 'statsItem';

        const itemLabel = document.createElement('span');
        itemLabel.className = 'statsItemLabel';
        itemLabel.textContent = label;

        const itemValue = document.createElement('span');
        itemValue.className = 'statsItemValue';
        itemValue.textContent = '—';
        itemValue.dataset.stat = key;
        statsValueElements[key] = itemValue;

        item.append(itemLabel, itemValue);
        grid.appendChild(item);
    });

    statsScreen.append(header, profile, grid);
    statsScreen.dataset.initialized = 'true';
}

function getFirstDefinedValue(source, keys) {
    if (!source || typeof source !== 'object') {
        return undefined;
    }

    for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null) {
            return source[key];
        }
    }

    return undefined;
}

function formatStatsValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString();
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const numericValue = Number(value);
        return Number.isFinite(numericValue)
            ? numericValue.toLocaleString()
            : value;
    }

    return '—';
}

function setStatsProfile(profileData) {
    if (!profileData || typeof profileData !== 'object') {
        return;
    }

    const usernameElement = document.getElementById('statsProfileUsername');
    const avatarElement = document.getElementById('statsProfileAvatar');

    const username = getFirstDefinedValue(profileData, [
        'username'
    ]);

    if (usernameElement && typeof username === 'string' && username.trim()) {
        usernameElement.textContent = username;
    }

    const avatarUrl = getFirstDefinedValue(profileData, [
        'avatarUrl'
    ]);

    if (avatarElement && typeof avatarUrl === 'string') {
        try {
            const parsedAvatarUrl = new URL(avatarUrl, window.location.href);

            if (parsedAvatarUrl.protocol === 'https:' || parsedAvatarUrl.protocol === 'http:') {
                avatarElement.src = parsedAvatarUrl.href;
                avatarElement.hidden = false;
                avatarElement.onerror = () => {
                    avatarElement.hidden = true;
                };
            }
        } catch (err) {
            avatarElement.hidden = true;
        }
    }
}

function applyCardGameStats(payload) {
    if (!payload || typeof payload !== 'object') {
        return;
    }

    const profileData =
        payload.profile && typeof payload.profile === 'object'
            ? payload.profile
            : null;

    const statsData =
        payload.stats && typeof payload.stats === 'object'
            ? payload.stats
            : null;

    latestCardGameStatsData = statsData;
    updateCardGameCountDisplays(statsData);
    setStatsProfile(profileData);

    const statKeys = {
        rolls: 'rolls',
        recordsDiscovered: 'recordsDiscovered',
        cardsDiscovered: 'cardsDiscovered',
        cardsOwned: 'cardsOwned',
        packsOpened: 'packsOpened',
        tradesCompleted: 'tradesCompleted'
    };

    Object.entries(statKeys).forEach(([key, field]) => {
        const value = statsData ? statsData[field] : undefined;

        if (statsValueElements[key] && value !== undefined) {
            statsValueElements[key].textContent = formatStatsValue(value);
        }
    });

    cardGameStatsReceived = true;
    updateScrollRail();
}

function handleCardGameStatsMessage(message) {
    if (
        !message ||
        typeof message !== 'object' ||
        message.type !== 'stats_send'
    ) {
        return false;
    }

    if (message.data && typeof message.data === 'object') {
        applyCardGameStats(message.data);
    }

    return true;
}

function requestCardGameStats() {
    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    cardGameStatsRequested = true;

    socket.send(JSON.stringify({
        protocol: 'cardgame',
        version: 1,
        request: 'get_stats'
    }));
}

createStatsScreen();

function updateScrollRail() {  
    document.documentElement.style.minHeight = '';  
    document.body.style.minHeight = ''; 

    const pageHeight = Math.max(  
        document.documentElement.scrollHeight,  
        document.body.scrollHeight,  
        mainScreen.scrollHeight,  
        window.innerHeight  
    );  

    document.documentElement.style.minHeight = `${pageHeight}px`;  
    document.body.style.minHeight = `${pageHeight}px`; 

    if (!scrollRail) {  
        return;  
    }  

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

const tabButtons = document.querySelectorAll('.navigation > #generateButton, .navigation > #leaderboardsButton, .navigation > #cardsButton');  
const buttonShakeStates = new Map(); 
const TAB_BUTTON_NORMAL_WIGGLE_DURATION = 450;  

function startButtonEarthquake(button) {  
    if (buttonShakeStates.has(button)) {  
        return;  
    }  

    const state = {  
        active: true,  
        animationFrame: null,  
        startedAt: performance.now(),  
        normalWiggleActive: true  
    };  

    buttonShakeStates.set(button, state);  
    button.classList.add('normalButtonWiggle');  

    function shakeFrame(now) {  
        if (!state.active) {  
            return;  
        }  

        const elapsed = now - state.startedAt;  
        let x = 0;  
        let y = 0;  
        let angle = 0;  

        if (elapsed < TAB_BUTTON_NORMAL_WIGGLE_DURATION) {  
            state.animationFrame = requestAnimationFrame(shakeFrame);  
            return;  
        }  

        if (state.normalWiggleActive) {  
            state.normalWiggleActive = false;  
            button.classList.remove('normalButtonWiggle');  
        }  

        const earthquakeElapsed =  
            elapsed - TAB_BUTTON_NORMAL_WIGGLE_DURATION;  

        if (earthquakeElapsed < 5000) {  
            const progress = Math.min(earthquakeElapsed / 5000, 1);  
            const tilt = 0.2 + progress * 1.3;  
            angle = Math.sin(earthquakeElapsed / 140) * tilt;  
        } else {  
            const progress = Math.min((earthquakeElapsed - 5000) / 5000, 1);  
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

    button.classList.remove('normalButtonWiggle');  
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

const RNG_RARITY_GRADIENTS = { 
    common: 
        `linear-gradient( 
            135deg, 
            #557590 0%, 
            #4a6981 28%, 
            #435d70 55%, 
            #3d5363 78%, 
            #374a58 100% 
        )`, 
    uncommon: 
        `linear-gradient( 
            135deg, 
            #247b79 0%, 
            #286f72 28%, 
            #2d626b 55%, 
            #315664 78%, 
            #344b59 100% 
        )`, 
    rare: 
        `linear-gradient( 
            135deg, 
            #2468a3 0%, 
            #285f97 28%, 
            #2e587f 55%, 
            #334f6e 78%, 
            #37485b 100% 
        )`, 
    legendary: 
        `linear-gradient( 
            135deg, 
            #7b671f 0%, 
            #6c5d2c 28%, 
            #5d5234 55%, 
            #4e4839 78%, 
            #41403d 100% 
        )` 
}; 

const RNG_RANDOM_CHARACTERS = 
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"; 

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
const RNG_POP_DURATION = 650; 
const RNG_LIFETIME_ROLL_DELAY = 3000; 
const RNG_LIFETIME_FADE_DURATION = 260; 
const RNG_LIFETIME_ROLL_DURATION = 2000; 
const RNG_LIFETIME_DIGIT_STAGGER = 0; 
const RNG_LIFETIME_VISIBLE_STEPS = 1; 
const RNG_RECORD_WIGGLE_DURATION = 30000; 
const RNG_RECORD_WIGGLE_AMPLITUDE = 8; 
const RNG_RECORD_WIGGLE_ROTATION = 3; 
const RNG_RECORD_FINISH_FLASH_DELAY = 1000; 

let rngRequestPending = false;  
let rngRollLoadingPending = false;  
let rngResultPanel = null;  
let rngScrambleElement = null; 
let rngScrambleTimer = null;  
let rngScrambleProgressTimer = null;  
let rngCountdownTimer = null;  
let rngDailyStatus = null;  
let rngDailyMessage = null;  
let rngDailyCountdown = null;  
let rngDailyActionArea = null;  
let rngTopControlArea = null; 
let rngControlSlot = null; 
let rngServerTimeBase = null;  
let rngPerformanceTimeBase = null;  
let rngNextResetTimestamp = null;  
let rngLocalRollState = null;  
let rngFrontendInitialized = false;  
let rngLaunchFlashPending = false; 
let rngPendingLifetimeScore = null; 
let rngLifetimeAnimationActive = false; 
let rngLifetimeRollTimer = null; 
let rngLifetimeAnimationFrames = []; 
let rngRecordCardWiggleFrame = null; 
let rngStoredResultScrollPending = false; 

function getRandomRngCharacter() {  
    const index = Math.floor(  
        Math.random() * RNG_RANDOM_CHARACTERS.length  
    );  

    return RNG_RANDOM_CHARACTERS[index];  
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
        rngLocalRollState = 
            loadLocalRngRollState();  
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
        lifetimeRecordScore: 
            payload.lifetimeRecordScore ?? 
            payload.lifetimeScore ?? 
            payload.lifetime_record_score ?? 
            '0', 
        timesRolled: 
            payload.timesRolled ?? 
            payload.times_rolled ?? 
            1, 
        duplicateRoll: 
            isRngDuplicatePayload(payload), 
        modifiers: payload.modifiers ?? [] 
    }; 
} 

function isRngDuplicatePayload(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return false; 
    } 

    const duplicateValue = 
        payload.duplicateRoll ?? 
        payload.duplicate_roll ?? 
        payload.isDuplicate ?? 
        payload.is_duplicate ?? 
        payload.duplicate; 

    return ( 
        duplicateValue === true || 
        duplicateValue === 1 || 
        ( 
            typeof duplicateValue === 'string' && 
            ['true', 'yes', 'duplicate', '1'].includes( 
                duplicateValue.trim().toLowerCase() 
            ) 
        ) 
    ); 
} 

function loadLocalRngRollState() { 
    try { 
        const stored = 
            localStorage.getItem( 
                RNG_LOCAL_ROLL_STORAGE_KEY 
            ); 

        if (!stored) { 
            return null; 
        } 

        const numericTimestamp = 
            Number(stored); 

        if ( 
            Number.isFinite( 
                numericTimestamp 
            ) 
        ) { 
            return { 
                nextRollTimestamp: 
                    numericTimestamp 
            }; 
        } 

        const payload = 
            JSON.parse(stored); 

        if ( 
            !payload || 
            typeof payload !== 'object' 
        ) { 
            localStorage.removeItem( 
                RNG_LOCAL_ROLL_STORAGE_KEY 
            ); 

            return null; 
        } 

        const nextRollTimestamp = 
            Number( 
                payload.nextRollTimestamp 
            ); 

        if ( 
            !Number.isFinite( 
                nextRollTimestamp 
            ) 
        ) { 
            localStorage.removeItem( 
                RNG_LOCAL_ROLL_STORAGE_KEY 
            ); 

            return null; 
        } 

        const lastRollTimestamp = 
            Number( 
                payload.lastRollTimestamp 
            ); 

        if ( 
            Number.isFinite( 
                lastRollTimestamp 
            ) 
        ) { 
            return { 
                nextRollTimestamp, 
                lastRollTimestamp 
            }; 
        } 

        return { 
            nextRollTimestamp 
        }; 
    } catch (err) { 
        return null; 
    } 
} 

function saveLocalRngRollState(payload) { 
    if ( 
        !payload || 
        typeof payload.nextRollTimestamp !== 'number' || 
        !Number.isFinite(payload.nextRollTimestamp) 
    ) { 
        return; 
    } 

    const lastRollTimestamp = 
        typeof payload.lastRollTimestamp === 'number' && 
        Number.isFinite(payload.lastRollTimestamp) 
            ? payload.lastRollTimestamp 
            : ( 
                typeof rngLocalRollState?.lastRollTimestamp === 'number' && 
                Number.isFinite(rngLocalRollState.lastRollTimestamp) 
                    ? rngLocalRollState.lastRollTimestamp 
                    : null 
            ); 

    rngLocalRollState = { 
        nextRollTimestamp: 
            payload.nextRollTimestamp 
    }; 

    if ( 
        lastRollTimestamp !== null 
    ) { 
        rngLocalRollState.lastRollTimestamp = 
            lastRollTimestamp; 
    } 

    try { 
        localStorage.setItem( 
            RNG_LOCAL_ROLL_STORAGE_KEY, 
            JSON.stringify( 
                rngLocalRollState 
            ) 
        ); 
    } catch (err) { 
    } 
} 

function clearLocalRngRollState() { 
    rngLocalRollState = null; 

    try { 
        localStorage.removeItem( 
            RNG_LOCAL_ROLL_STORAGE_KEY 
        ); 
    } catch (err) { 
    } 
} 

function loadLocalRngResult() { 
    try { 
        const stored = 
            localStorage.getItem( 
                RNG_LOCAL_RESULT_STORAGE_KEY 
            ); 

        if (!stored) { 
            return null; 
        } 

        const payload = 
            JSON.parse(stored); 

        return sanitizeRngStoredResult( 
            payload 
        ); 
    } catch (err) { 
        return null; 
    } 
} 

function saveLocalRngResult(payload) { 
    const sanitized = 
        sanitizeRngStoredResult( 
            payload 
        ); 

    if (!sanitized) { 
        return; 
    } 

    try { 
        localStorage.setItem( 
            RNG_LOCAL_RESULT_STORAGE_KEY, 
            JSON.stringify( 
                sanitized 
            ) 
        ); 
    } catch (err) { 
    } 
} 

function clearLocalRngResult() { 
    try { 
        localStorage.removeItem( 
            RNG_LOCAL_RESULT_STORAGE_KEY 
        ); 
    } catch (err) { 
    } 
} 

function getRngNextRollTimestamp() { 
    return rngLocalRollState?.nextRollTimestamp ?? 
        null; 
} 

function isRngCooldownActive() { 
    const nextRollTimestamp = 
        getRngNextRollTimestamp(); 

    const serverNow = 
        getRngServerNow(); 

    if ( 
        typeof nextRollTimestamp !== 'number' || 
        !Number.isFinite(nextRollTimestamp) || 
        typeof rngNextResetTimestamp !== 'number' || 
        !Number.isFinite(rngNextResetTimestamp) || 
        typeof serverNow !== 'number' || 
        !Number.isFinite(serverNow) 
    ) { 
        return false; 
    } 

    if ( 
        nextRollTimestamp !== 
        rngNextResetTimestamp 
    ) { 
        return false; 
    } 

    if ( 
        nextRollTimestamp <= 
        serverNow 
    ) { 
        return false; 
    } 

    const lastRollTimestamp = 
        Number( 
            rngLocalRollState?.lastRollTimestamp 
        ); 

    if ( 
        Number.isFinite( 
            lastRollTimestamp 
        ) 
    ) { 
        return ( 
            lastRollTimestamp <= 
            serverNow 
        ); 
    } 

    return Boolean( 
        loadLocalRngResult() 
    ); 
} 

function createRngTopControlArea() { 
    if (rngTopControlArea) { 
        return; 
    } 

    rngTopControlArea = 
        document.createElement('div'); 

    rngTopControlArea.className = 
        'rngTopControlArea'; 

    rngTopControlArea.style.height = 
        'auto'; 

    rngTopControlArea.style.minHeight = 
        '86px'; 

    rngTopControlArea.style.display = 
        'flex'; 

    rngTopControlArea.style.flexDirection = 
        'column'; 

    rngTopControlArea.style.alignItems = 
        'center'; 

    rngTopControlArea.style.justifyContent = 
        'flex-start'; 

    rngTopControlArea.style.overflow = 
        'visible'; 

    rngControlSlot = 
        document.createElement('div'); 

    rngControlSlot.className = 
        'rngControlSlot'; 

    rngControlSlot.style.width = 
        '350px'; 

    rngControlSlot.style.minWidth = 
        '350px'; 

    rngControlSlot.style.maxWidth = 
        '350px'; 

    rngControlSlot.style.height = 
        '86px'; 

    rngControlSlot.style.minHeight = 
        '86px'; 

    rngControlSlot.style.display = 
        'flex'; 

    rngControlSlot.style.alignItems = 
        'center'; 

    rngControlSlot.style.justifyContent = 
        'center'; 

    rngControlSlot.style.flexShrink = 
        '0'; 

    rngTopControlArea.appendChild( 
        rngControlSlot 
    ); 

    generateScreen.appendChild( 
        rngTopControlArea 
    );

    createRngRecordsDiscoveredCount();
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

    rngDailyStatus.style.color = 
        '#8a8f94'; 

    rngDailyMessage =  
        document.createElement('div');  

    rngDailyMessage.className =  
        'rngDailyMessage';  

    rngDailyMessage.style.color = 
        '#8a8f94'; 

    rngDailyMessage.textContent =  
        'You have already rolled for this period';  

    rngDailyCountdown =  
        document.createElement('div');  

    rngDailyCountdown.className =  
        'rngDailyCountdown';  

    rngDailyCountdown.style.color = 
        '#8a8f94'; 

    rngDailyStatus.appendChild(  
        rngDailyMessage  
    );  

    rngDailyStatus.appendChild(  
        rngDailyCountdown  
    );  

    rngControlSlot.appendChild(  
        rngDailyStatus  
    );  
}  

function updateRngDailyCountdown() {  
    const nextRollTimestamp = 
        getRngNextRollTimestamp(); 

    const serverNow = 
        getRngServerNow(); 

    if ( 
        typeof serverNow !== 'number' || 
        !Number.isFinite(serverNow) 
    ) { 
        stopRngDailyCountdown(); 
        hideRngDailyStatus(); 
        return false; 
    } 

    if ( 
        typeof nextRollTimestamp !== 'number' || 
        !Number.isFinite(nextRollTimestamp) || 
        !isRngCooldownActive() 
    ) { 
        stopRngDailyCountdown(); 
        hideRngDailyStatus(); 

        if (rngResultPanel) { 
            clearRngLifetimeAnimation(); 
            clearRngRecordCardWiggle(); 
            rngResultPanel.remove(); 
            rngResultPanel = null; 
        } 

        if (rngScrambleElement) { 
            rngScrambleElement.remove(); 
            rngScrambleElement = null; 
        } 

        clearLocalRngResult(); 
        clearLocalRngRollState(); 
        clearRngRarityTheme(); 

        if ( 
            !rngRequestPending && 
            !rngRollLoadingPending 
        ) { 
            initializeRngGenerateButton(); 
        } 

        return false; 
    } 

    const remaining = 
        nextRollTimestamp - 
        serverNow; 

    if ( 
        remaining <= 0 
    ) { 
        stopRngDailyCountdown(); 

        clearLocalRngRollState(); 
        clearLocalRngResult(); 
        hideRngDailyStatus(); 
        clearRngRarityTheme(); 

        if (rngResultPanel) { 
            clearRngLifetimeAnimation(); 
            clearRngRecordCardWiggle(); 
            rngResultPanel.remove(); 
            rngResultPanel = null; 
        } 

        if (rngScrambleElement) { 
            rngScrambleElement.remove(); 
            rngScrambleElement = null; 
        } 

        if ( 
            !rngRequestPending && 
            !rngRollLoadingPending 
        ) { 
            initializeRngGenerateButton(); 
        } 

        return false; 
    } 

    createRngDailyStatus(); 

    rngDailyMessage.textContent = 
        'You have already rolled for this period'; 

    rngDailyCountdown.textContent = 
        `Next roll in ${formatRngCountdown( 
            remaining 
        )}`; 

    rngDailyMessage.style.color = 
        '#8a8f94'; 

    rngDailyCountdown.style.color = 
        '#8a8f94'; 

    showRngDailyStatus(); 
    startRngDailyCountdown(); 

    return true; 
}  

function startRngDailyCountdown() {  
    stopRngDailyCountdown(); 

    rngCountdownTimer = 
        setInterval(() => { 
            updateRngDailyCountdown(); 
        }, 1000); 
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
    if (!rngDailyStatus) { 
        return; 
    } 

    rngDailyStatus.classList.remove( 
        'hidden' 
    ); 
}  

function clearRngRarityTheme() { 
    if (!document.body) { 
        return; 
    } 

    RNG_RARITY_THEME_CLASSES.forEach(className => { 
        document.body.classList.remove(className); 
    }); 

    document.body.style.background = ''; 
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

function getRngDisplayRarity(payload) { 
    const baseRarity = 
        normalizeRngRarity( 
            payload && 
            payload.rarity 
        );

    /* 
    // FUTURE MODIFIER-BASED RARITY PROCESSING 

    let rarityTier = 
        baseRarity === 'common' 
            ? 0 
            : baseRarity === 'uncommon' 
                ? 1 
                : baseRarity === 'rare' 
                    ? 2 
                    : baseRarity === 'legendary' 
                        ? 3 
                        : -1; 

    if ( 
        rarityTier >= 0 && 
        Array.isArray(payload?.modifiers) 
    ) { 
        payload.modifiers.forEach(modifier => { 
            // Future modifier processing will determine 
            // whether a modifier increases rarity here. 
        }); 
    } 

    const rarityByTier = [ 
        'common', 
        'uncommon', 
        'rare', 
        'legendary' 
    ]; 

    if (rarityTier >= 0) { 
        return rarityByTier[ 
            Math.min( 
                rarityTier, 
                rarityByTier.length - 1 
            ) 
        ]; 
    } 
    */

        return baseRarity; 
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

        if ( 
            RNG_RARITY_GRADIENTS[normalized] 
        ) { 
            document.body.style.background = 
                RNG_RARITY_GRADIENTS[normalized]; 
        } 
    } 

    return normalized; 
} 

function getRngRarityGradient(rarity) { 
    const normalized = 
        normalizeRngRarity( 
            rarity 
        ); 

    return ( 
        RNG_RARITY_GRADIENTS[normalized] ?? 
        '' 
    ); 
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

function clearRngRecordCardWiggle() { 
    if ( 
        rngRecordCardWiggleFrame 
    ) { 
        cancelAnimationFrame( 
            rngRecordCardWiggleFrame 
        ); 

        rngRecordCardWiggleFrame = 
            null; 
    } 
} 

function startRngRecordCardWiggle( 
    card 
) { 
    if (!card) { 
        return; 
    } 

    clearRngRecordCardWiggle(); 

    const startedAt = 
        performance.now(); 

    function wiggleFrame(now) { 
        if ( 
            !card.isConnected 
        ) { 
            rngRecordCardWiggleFrame = 
                null; 

            return; 
        } 

        const elapsed = 
            now - 
            startedAt; 

        const cycleAngle = 
            (elapsed / 
                RNG_RECORD_WIGGLE_DURATION) * 
            Math.PI * 
            2; 

        const wave = 
            Math.sin( 
                cycleAngle 
            ); 

        const secondaryWave = 
            Math.sin( 
                cycleAngle * 
                    2 + 
                    Math.PI / 
                        2 
            ); 

        const x = 
            wave * 
            RNG_RECORD_WIGGLE_AMPLITUDE; 

        const y = 
            secondaryWave * 
            1.8; 

        const rotation = 
            wave * 
            RNG_RECORD_WIGGLE_ROTATION; 

        card.style.transform = 
            `translate(${x}px, ${y}px) rotate(${rotation}deg)`; 

        rngRecordCardWiggleFrame = 
            requestAnimationFrame( 
                wiggleFrame 
            ); 
    } 

    rngRecordCardWiggleFrame = 
        requestAnimationFrame( 
            wiggleFrame 
        ); 
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
        } 

        return; 
    } 

    if (rngScrambleElement) { 
        return; 
    } 

    updateRngDailyCountdown(); 

    if ( 
        !rngRequestPending && 
        !rngRollLoadingPending 
    ) { 
        initializeRngGenerateButton(); 
    } 
} 

function startRngCardFinishEffects(card) {
    if (
        !card ||
        !card.isConnected ||
        card.dataset.rngCardFinishStarted === 'true'
    ) {
        return;
    }

    card.dataset.rngCardFinishStarted = 'true';

    card.classList.remove(
        'rngResultPopIn'
    );

    card.style.opacity =
        '1';

    card.style.transform =
        'none';

    void card.offsetWidth;

    startRngRecordCardWiggle(
        card
    );

    window.setTimeout(
        () => {
            if (
                !card.isConnected
            ) {
                return;
            }

            playRngLaunchFlash();

            card.classList.remove(
                'rngRecordCardFinalPop'
            );

            void card.offsetWidth;

            const finishPopHandler = event => {
                if (
                    event.animationName !==
                    'rngRecordCardFinalPop'
                ) {
                    return;
                }

                card.classList.remove(
                    'rngRecordCardFinalPop'
                );

                card.style.opacity =
                    '1';

                card.removeEventListener(
                    'animationend',
                    finishPopHandler
                );
            };

            card.addEventListener(
                'animationend',
                finishPopHandler
            );

            card.classList.add(
                'rngRecordCardFinalPop'
            );
        },
        RNG_RECORD_FINISH_FLASH_DELAY
    );
}

function scheduleRngDuplicateReveal(card) {
    if (!card) {
        return;
    }

    const duplicateOverlay =
        card.querySelector(
            '.rngDuplicateOverlay'
        );

    const modifiersTitle =
        card.querySelector(
            '.rngModifiersTitle'
        );

    const modifierCards =
        card.querySelectorAll(
            '.rngModifier'
        );

    const lastModifier =
        modifierCards.length > 0
            ? modifierCards[modifierCards.length - 1]
            : null;

    const revealTrigger =
        lastModifier || modifiersTitle;

    if (
        !duplicateOverlay ||
        card.dataset.rngDuplicateRevealScheduled === 'true'
    ) {
        return;
    }

    card.dataset.rngDuplicateRevealScheduled = 'true';

    const duplicateText =
        duplicateOverlay.querySelector(
            '.rngDuplicateText'
        );

    const startDuplicateRevealTimer = () => {
        if (
            card.dataset.rngDuplicateRevealTimerStarted === 'true'
        ) {
            return;
        }

        card.dataset.rngDuplicateRevealTimerStarted = 'true';

        window.setTimeout(
            () => {
                if (
                    !duplicateOverlay.isConnected
                ) {
                    return;
                }

                const handleDuplicatePopInFinished = event => {
                    if (
                        event.animationName !==
                        'rngDuplicateStampPopIn'
                    ) {
                        return;
                    }

                    duplicateText.removeEventListener(
                        'animationend',
                        handleDuplicatePopInFinished
                    );

                    startRngCardFinishEffects(
                        card
                    );
                };

                if (duplicateText) {
                    duplicateText.addEventListener(
                        'animationend',
                        handleDuplicatePopInFinished
                    );
                } else {
                    window.setTimeout(
                        () => {
                            startRngCardFinishEffects(
                                card
                            );
                        },
                        1000
                    );
                }

                duplicateOverlay.classList.add(
                    'rngDuplicateVisible'
                );
            },
            4000
        );
    };

    if (!revealTrigger) {
        startDuplicateRevealTimer();
        return;
    }

    revealTrigger.addEventListener(
        'animationend',
        event => {
            if (
                event.animationName !==
                'rngResultPopIn'
            ) {
                return;
            }

            startDuplicateRevealTimer();
        }
    );
}

function animateRngRecordCard( 
    card, 
    onLifetimeLabelShown = null, 
    onRevealFinished = null 
) {  
    if (!card) {  
        return;  
    }  

    clearRngRecordCardWiggle(); 

    const childElements =  
        card.querySelectorAll(  
            '.rngRecordLabel, .rngRecordValue, .rngStat, .rngStatLabel, .rngStatValue:not(.rngRarityValue), .rngModifiersTitle, .rngModifiersDescription, .rngModifier, .rngNoModifiers'  
        );  

    const fullRarityPlaceholder =
        card.querySelector(
            '.rngFullRarityPlaceholder'
        );

    const elements = [ 
        card, 
        ...childElements 
    ];

    if (fullRarityPlaceholder) {
        elements.push(
            fullRarityPlaceholder
        );
    }

    const modifierElements =
        elements.filter(
            element => element.classList.contains('rngModifier')
        );

    const firstModifierIndex =
        elements.findIndex(
            element => element.classList.contains('rngModifier')
        );

    const modifierPopInterval =
        (RNG_POP_DURATION + 100) / 1000;

    const finalElement = 
        elements[ 
            elements.length - 1 
        ]; 

    elements.forEach(  
        (element, index) => {  

            if ( 
                onLifetimeLabelShown && 
                element.classList.contains( 
                    'rngStatLabel' 
                ) && 
                element.textContent === 
                    'Lifetime Score' 
            ) { 
                element.addEventListener( 
                    'animationend', 
                    event => { 
                        if ( 
                            event.animationName === 
                            'rngResultPopIn' 
                        ) { 
                            onLifetimeLabelShown(); 
                        } 
                    }, 
                    { once: true } 
                ); 
            } 

            const cardHasDuplicate = Boolean(
                card.querySelector(
                    '.rngDuplicateOverlay'
                )
            );

            const contentLoadTrigger =
                modifierElements.length > 0
                    ? modifierElements[modifierElements.length - 1]
                    : elements.find(element => element.classList.contains('rngNoModifiers')) ||
                        elements.find(element => element.classList.contains('rngModifiersDescription')) ||
                        finalElement;

            if (
                element === contentLoadTrigger
            ) {
                element.addEventListener(
                    'animationend',
                    event => {
                        if (
                            event.animationName !==
                            'rngResultPopIn'
                        ) {
                            return;
                        }

                        if (!cardHasDuplicate) {
                            startRngCardFinishEffects(
                                card
                            );
                        }
                    },
                    { once: true }
                );
            }

            if (
                element === finalElement &&
                onRevealFinished
            ) {
                element.addEventListener(
                    'animationend',
                    event => {
                        if (
                            event.animationName !==
                            'rngResultPopIn'
                        ) {
                            return;
                        }

                        onRevealFinished();
                    },
                    { once: true }
                );
            }

            let popDelay =
                index * (RNG_POP_INTERVAL / 1000);

            if (
                element.classList.contains('rngModifier') &&
                firstModifierIndex !== -1
            ) {
                const modifierIndex =
                    modifierElements.indexOf(element);

                popDelay =
                    firstModifierIndex * (RNG_POP_INTERVAL / 1000) +
                    modifierIndex * modifierPopInterval;
            } else if (
                fullRarityPlaceholder &&
                element === fullRarityPlaceholder &&
                modifierElements.length > 0 &&
                firstModifierIndex !== -1
            ) {
                popDelay =
                    firstModifierIndex * (RNG_POP_INTERVAL / 1000) +
                    modifierElements.length * modifierPopInterval;
            }

            element.style.setProperty(
                '--rng-pop-delay',
                `${popDelay}s`
            );

            element.style.animationDuration = 
                `${RNG_POP_DURATION}ms`; 

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

function clearRngLifetimeAnimation() { 
    if ( 
        rngLifetimeRollTimer 
    ) { 
        clearTimeout( 
            rngLifetimeRollTimer 
        ); 

        rngLifetimeRollTimer = 
            null; 
    } 

    rngLifetimeAnimationFrames.forEach( 
        frameId => { 
            cancelAnimationFrame( 
                frameId 
            ); 
        } 
    ); 

    rngLifetimeAnimationFrames = 
        []; 

    rngLifetimeAnimationActive = 
        false; 

    if (rngResultPanel) { 
        rngResultPanel 
            .querySelectorAll( 
                '.rngLifetimeStat.rngLifetimeUpdating' 
            ) 
            .forEach(stat => { 
                stat.classList.remove( 
                    'rngLifetimeUpdating' 
                ); 
            }); 
    } 
} 

function resetDailyRngFrontend() {  
    stopRngDailyCountdown();  
    clearLocalRngRollState();  
    clearLocalRngResult(); 
    clearRngRarityTheme(); 

    clearRngLifetimeAnimation(); 
    clearRngRecordCardWiggle(); 
    rngPendingLifetimeScore = null; 

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

    if (rngScrambleElement) { 
        rngScrambleElement.remove(); 
        rngScrambleElement = null; 
    } 

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
    saveLocalRngResult( 
        payload 
    ); 

    if ( 
        typeof rngNextResetTimestamp === 'number' && 
        Number.isFinite(rngNextResetTimestamp) 
    ) { 
        const serverNow = 
            getRngServerNow(); 

        const statePayload = { 
            nextRollTimestamp: 
                rngNextResetTimestamp 
        }; 

        if ( 
            typeof serverNow === 'number' && 
            Number.isFinite(serverNow) 
        ) { 
            statePayload.lastRollTimestamp = 
                serverNow; 
        } 

        saveLocalRngRollState( 
            statePayload 
        ); 
    } 

    rngLocalRollState = 
        loadLocalRngRollState(); 

    updateRngDailyCountdown(); 

    sendRngLifetimeUpdate( 
        payload 
    ); 

    if (rngDailyActionArea) {  
        rngDailyActionArea.remove();  
        rngDailyActionArea = null;  
    }  
} 

function getRngLifetimePayloadScore(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return null; 
    } 

    const value = 
        Number( 
            payload.lifetimeRecordScore ?? 
            payload.lifetimeScore ?? 
            payload.lifetime_record_score 
        ); 

    if ( 
        !Number.isFinite(value) 
    ) { 
        return null; 
    } 

    return Math.round( 
        value 
    ); 
} 

function getRngLifetimeStatValueElement() { 
    if ( 
        !rngResultPanel 
    ) { 
        return null; 
    } 

    const statLabels = 
        rngResultPanel.querySelectorAll( 
            '.rngStatLabel' 
        ); 

    for ( 
        const statLabel of statLabels 
    ) { 
        if ( 
            !statLabel.textContent 
                .toLowerCase() 
                .includes( 
                    'lifetime' 
                ) 
        ) { 
            continue; 
        } 

        const stat = 
            statLabel.parentElement; 

        if (!stat) { 
            return null; 
        } 

        return stat.querySelector( 
            '.rngStatValue' 
        ); 
    } 

    return null; 
} 

function createRngLifetimeDigitFace( 
    digit 
) { 
    const face = 
        document.createElement('span'); 

    face.className = 
        'rngLifetimeDigitFace'; 

    face.textContent = 
        String( 
            ( 
                Number(digit) + 
                10 
            ) % 
            10 
        ); 

    return face; 
} 

function getRngLifetimeReelDigit( 
    baseDigit, 
    offset 
) { 
    return ( 
        ( 
            baseDigit + 
            offset 
        ) % 
        10 + 
        10 
    ) % 10; 
} 

function createRngLifetimeDigitReel( 
    oldDigit, 
    targetDigit, 
    delay, 
    onFinished 
) { 
    const digitFrame = 
        document.createElement('span'); 

    digitFrame.className = 
        'rngLifetimeDigit'; 

    const strip = 
        document.createElement('span'); 

    strip.className = 
        'rngLifetimeDigitStrip'; 

    const numericOldDigit = 
        Number( 
            oldDigit 
        ); 

    const numericTargetDigit = 
        Number( 
            targetDigit 
        ); 

    const forwardSteps = 
        ( 
            numericTargetDigit - 
            numericOldDigit + 
            10 
        ) % 
        10; 

    const totalFaces = 
        forwardSteps + 
        3; 

    for ( 
        let index = 0; 
        index < totalFaces; 
        index++ 
    ) { 
        const digit = 
            getRngLifetimeReelDigit( 
                numericOldDigit, 
                index - 
                    RNG_LIFETIME_VISIBLE_STEPS 
            ); 

        strip.appendChild( 
            createRngLifetimeDigitFace( 
                digit 
            ) 
        ); 
    } 

    digitFrame.appendChild( 
        strip 
    ); 

    return { 
        digitFrame, 
        strip, 
        oldDigit: 
            numericOldDigit, 
        targetDigit: 
            numericTargetDigit, 
        forwardSteps, 
        delay, 
        onFinished 
    }; 
} 

function updateRngLifetimeDigitFaces( 
    reel, 
    translateY, 
    faceHeight, 
    frameHeight 
) { 
    const centerY = 
        frameHeight / 
        2; 

    const faces = 
        reel.strip.children; 

    for ( 
        let index = 0; 
        index < faces.length; 
        index++ 
    ) { 
        const face = 
            faces[index]; 

        const faceTop = 
            translateY + 
            ( 
                index * 
                faceHeight 
            ); 

        const faceCenter = 
            faceTop + 
            ( 
                faceHeight / 
                2 
            ); 

        const distance = 
            Math.abs( 
                faceCenter - 
                centerY 
            ); 

        const fadeStart = 
            faceHeight * 
            1.2; 

        const fadeEnd = 
            faceHeight * 
            2; 

        let opacity = 1; 

        if ( 
            distance > 
            fadeStart 
        ) { 
            opacity = 
                Math.max( 
                    0, 
                    1 - 
                        ( 
                            ( 
                                distance - 
                                fadeStart 
                            ) / 
                            ( 
                                fadeEnd - 
                                fadeStart 
                            ) 
                        ) 
                ); 
        } 

        face.style.opacity = 
            String( 
                opacity 
            ); 
    } 
} 

function easeRngLifetimeRoll( 
    progress 
) { 
    const clamped = 
        Math.max( 
            0, 
            Math.min( 
                1, 
                progress 
            ) 
        ); 

    return ( 
        1 - 
        Math.pow( 
            1 - 
                clamped, 
            3 
        ) 
    ); 
} 

function startRngLifetimeDigitReel( 
    reel, 
    faceHeight, 
    frameHeight, 
    onGlobalFrame 
) { 
    const centerOffset = 
        ( 
            frameHeight - 
            faceHeight 
        ) / 2; 

    const startIndex = 
        RNG_LIFETIME_VISIBLE_STEPS; 

    const endIndex = 
        startIndex + 
        reel.forwardSteps; 

    const startTranslate = 
        centerOffset - 
        ( 
            startIndex * 
            faceHeight 
        ); 

    const endTranslate = 
        centerOffset - 
        ( 
            endIndex * 
            faceHeight 
        ); 

    reel.strip.style.transform = 
        `translateY(${startTranslate}px)`; 

    updateRngLifetimeDigitFaces( 
        reel, 
        startTranslate, 
        faceHeight, 
        frameHeight 
    ); 

    let startedAt = 
        null; 

    let frameId = 
        null; 

    function complete() { 
        if ( 
            frameId 
        ) { 
            cancelAnimationFrame( 
                frameId 
            ); 
        } 

        reel.strip.style.transform = 
            `translateY(${endTranslate}px)`; 

        updateRngLifetimeDigitFaces( 
            reel, 
            endTranslate, 
            faceHeight, 
            frameHeight 
        ); 

        reel.onFinished(); 
    } 

    function animate(now) { 
        if ( 
            startedAt === null 
        ) { 
            startedAt = 
                now; 
        } 

        const elapsed = 
            now - 
            startedAt; 

        if ( 
            elapsed < 
            reel.delay 
        ) { 
            frameId = 
                requestAnimationFrame( 
                    animate 
                ); 

            rngLifetimeAnimationFrames.push( 
                frameId 
            ); 

            return; 
        } 

        if ( 
            reel.forwardSteps === 
            0 
        ) { 
            complete(); 
            return; 
        } 

        const localElapsed = 
            elapsed - 
            reel.delay; 

        const duration = 
            RNG_LIFETIME_ROLL_DURATION; 

        const progress = 
            Math.min( 
                localElapsed / 
                    duration, 
                1 
            ); 

        const eased = 
            easeRngLifetimeRoll( 
                progress 
            ); 

        const currentTranslate = 
            startTranslate + 
            ( 
                ( 
                    endTranslate - 
                    startTranslate 
                ) * 
                eased 
            ); 

        reel.strip.style.transform = 
            `translateY(${currentTranslate}px)`; 

        updateRngLifetimeDigitFaces( 
            reel, 
            currentTranslate, 
            faceHeight, 
            frameHeight 
        ); 

        if ( 
            onGlobalFrame 
        ) { 
            onGlobalFrame(); 
        } 

        if ( 
            progress >= 1 
        ) { 
            complete(); 
            return; 
        } 

        frameId = 
            requestAnimationFrame( 
                animate 
            ); 

        rngLifetimeAnimationFrames.push( 
            frameId 
        ); 
    } 

    frameId = 
        requestAnimationFrame( 
            animate 
        ); 

    rngLifetimeAnimationFrames.push( 
        frameId 
    ); 
} 

function animateRngLifetimeScore( 
    element, 
    oldScore, 
    newScore 
) { 
    if ( 
        !element || 
        typeof oldScore !== 'number' || 
        !Number.isFinite(oldScore) || 
        typeof newScore !== 'number' || 
        !Number.isFinite(newScore) 
    ) { 
        return; 
    } 

    const normalizedOldScore = 
        Math.max( 
            0, 
            Math.round( 
                oldScore 
            ) 
        ); 

    const normalizedNewScore = 
        Math.max( 
            0, 
            Math.round( 
                newScore 
            ) 
        ); 

    const oldText = 
        String( 
            normalizedOldScore 
        ); 

    const newText = 
        String( 
            normalizedNewScore 
        ); 

    const lifetimeStat = 
        element.closest( 
            '.rngLifetimeStat' 
        ); 

    if ( 
        oldText === newText 
    ) { 
        if (lifetimeStat) { 
            lifetimeStat.classList.remove( 
                'rngLifetimeUpdating' 
            ); 
        } 

        const normalValue = 
            element.querySelector( 
                '.rngLifetimeNormalValue' 
            ); 

        if (normalValue) { 
            normalValue.textContent = 
                newText; 

            normalValue.style.opacity = 
                '1'; 
        } else { 
            element.textContent = 
                newText; 
        } 

        element.setAttribute( 
            'data-rng-lifetime-score', 
            newText 
        ); 

        element.setAttribute( 
            'aria-label', 
            newText 
        ); 

        return; 
    } 

    clearRngLifetimeAnimation(); 

    if (lifetimeStat) { 
        lifetimeStat.classList.add( 
            'rngLifetimeUpdating' 
        ); 
    } 

    element.classList.add( 
        'rngLifetimeScoreValue' 
    ); 

    let normalValue = 
        element.querySelector( 
            '.rngLifetimeNormalValue' 
        ); 

    if (!normalValue) { 
        element.textContent = 
            ''; 

        normalValue = 
            document.createElement('span'); 

        normalValue.className = 
            'rngLifetimeNormalValue'; 

        element.appendChild( 
            normalValue 
        ); 
    } 

    normalValue.textContent = 
        oldText; 

    normalValue.style.opacity = 
        '0'; 

    element.setAttribute( 
        'data-rng-lifetime-score', 
        oldText 
    ); 

    element.setAttribute( 
        'data-rng-lifetime-old-score', 
        oldText 
    ); 

    element.setAttribute( 
        'data-rng-lifetime-target-score', 
        newText 
    ); 

    element.setAttribute( 
        'aria-label', 
        newText 
    ); 

    const wheel = 
        document.createElement('span'); 

    wheel.className = 
        'rngLifetimeWheel'; 

    wheel.setAttribute( 
        'aria-hidden', 
        'true' 
    ); 

    const wheelLength = 
        Math.max( 
            oldText.length, 
            newText.length 
        ); 

    const oldPadded = 
        oldText.padStart( 
            wheelLength, 
            '0' 
        ); 

    const newPadded = 
        newText.padStart( 
            wheelLength, 
            '0' 
        ); 

    let completedDigits = 
        0; 

    const digitReels = []; 

    function finishDigit() { 
        completedDigits++; 

        if ( 
            completedDigits < 
            digitReels.length 
        ) { 
            return; 
        } 

        normalValue.textContent = 
            newText; 

        element.setAttribute( 
            'data-rng-lifetime-score', 
            newText 
        ); 

        element.setAttribute( 
            'aria-label', 
            newText 
        ); 

        wheel.style.opacity = 
            '0'; 

        window.setTimeout( 
            () => { 
                if ( 
                    wheel.parentElement 
                ) { 
                    wheel.remove(); 
                } 

                normalValue.style.opacity = 
                    '1'; 

                if (lifetimeStat) { 
                    lifetimeStat.classList.remove( 
                        'rngLifetimeUpdating' 
                    ); 
                } 

                rngLifetimeAnimationFrames = 
                    []; 

                rngLifetimeAnimationActive = 
                    false; 
            }, 
            RNG_LIFETIME_FADE_DURATION 
        ); 
    } 

    for ( 
        let index = 0; 
        index < wheelLength; 
        index++ 
    ) { 
        const oldDigit = 
            Number( 
                oldPadded[index] 
            ); 

        const targetDigit = 
            Number( 
                newPadded[index] 
            ); 

        const delay = 
            ( 
                wheelLength - 
                1 - 
                index 
            ) * 
            RNG_LIFETIME_DIGIT_STAGGER; 

        const reel = 
            createRngLifetimeDigitReel( 
                oldDigit, 
                targetDigit, 
                delay, 
                finishDigit 
            ); 

        wheel.appendChild( 
            reel.digitFrame 
        ); 

        digitReels.push( 
            reel 
        ); 

    } 

    element.appendChild( 
        wheel 
    ); 

    rngLifetimeAnimationActive = 
        true; 

    requestAnimationFrame(() => { 
        wheel.style.opacity = 
            '1'; 
    }); 

    window.setTimeout( 
        () => { 
            if ( 
                !wheel.parentElement 
            ) { 
                return; 
            } 

            const sampleDigit = 
                wheel.querySelector( 
                    '.rngLifetimeDigit' 
                ); 

            const sampleFace = 
                wheel.querySelector( 
                    '.rngLifetimeDigitFace' 
                ); 

            if ( 
                !sampleDigit || 
                !sampleFace 
            ) { 
                return; 
            } 

            const faceHeight = 
                sampleFace.getBoundingClientRect().height; 

            const frameHeight = 
                sampleDigit.getBoundingClientRect().height; 

            if ( 
                !Number.isFinite( 
                    faceHeight 
                ) || 
                faceHeight <= 0 || 
                !Number.isFinite( 
                    frameHeight 
                ) || 
                frameHeight <= 0 
            ) { 
                normalValue.textContent = 
                    newText; 

                wheel.style.opacity = 
                    '0'; 

                window.setTimeout( 
                    () => { 
                        wheel.remove(); 

                        normalValue.style.opacity = 
                            '1'; 

                        if (lifetimeStat) { 
                            lifetimeStat.classList.remove( 
                                'rngLifetimeUpdating' 
                            ); 
                        } 

                        rngLifetimeAnimationActive = 
                            false; 
                    }, 
                    RNG_LIFETIME_FADE_DURATION 
                ); 

                return; 
            } 

            digitReels.forEach( 
                reel => { 
                    startRngLifetimeDigitReel( 
                        reel, 
                        faceHeight, 
                        frameHeight 
                    ); 
                } 
            ); 
        }, 
        270 
    ); 
} 

function scheduleRngLifetimeScoreAnimation( 
    payload 
) { 
    if ( 
        typeof rngPendingLifetimeScore !== 'number' || 
        !Number.isFinite( 
            rngPendingLifetimeScore 
        ) 
    ) { 
        return; 
    } 

    if ( 
        rngLifetimeRollTimer 
    ) { 
        clearTimeout( 
            rngLifetimeRollTimer 
        ); 

        rngLifetimeRollTimer = 
            null; 
    } 

    const targetScore = 
        rngPendingLifetimeScore; 

    rngLifetimeRollTimer = 
        setTimeout(() => { 
            rngLifetimeRollTimer = 
                null; 

            if ( 
                !rngResultPanel 
            ) { 
                return; 
            } 

            const lifetimeValueElement = 
                getRngLifetimeStatValueElement(); 

            if ( 
                !lifetimeValueElement 
            ) { 
                return; 
            } 

            const currentScore = 
                getRngLifetimePayloadScore( 
                    payload 
                ); 

            if ( 
                currentScore === null 
            ) { 
                return; 
            } 

            rngPendingLifetimeScore = 
                null; 

            animateRngLifetimeScore( 
                lifetimeValueElement, 
                currentScore, 
                targetScore 
            ); 
        }, RNG_LIFETIME_ROLL_DELAY); 
} 

function sendRngLifetimeUpdate(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return; 
    } 

    const currentLifetime = 
        getRngLifetimePayloadScore( 
            payload 
        ); 

    const points = 
        Number( 
            payload.points 
        ); 

    if ( 
        currentLifetime === null || 
        !Number.isFinite(points) 
    ) { 
        console.error( 
            "❌ Could not calculate new RNG lifetime score." 
        ); 

        return; 
    } 

    const newLifetimeScore = 
        currentLifetime + 
        points; 

    if ( 
        !Number.isFinite(newLifetimeScore) 
    ) { 
        console.error( 
            "❌ Could not calculate new RNG lifetime score." 
        ); 

        return; 
    } 

    rngPendingLifetimeScore = 
        Math.round( 
            newLifetimeScore 
        ); 

    if ( 
        !socket || 
        socket.readyState !== 
            WebSocket.OPEN 
    ) { 
        rngPendingLifetimeScore = 
            null; 

        console.error( 
            "❌ Could not send RNG lifetime update because socket is not open." 
        ); 

        return; 
    } 

    socket.send( 
        JSON.stringify({ 
            protocol: "cardgame", 
            version: 1, 
            request: "rng_lifetime_update", 
            info: { 
                score: 
                    newLifetimeScore 
            } 
        }) 
    ); 

    console.log( 
        `📈 RNG lifetime score update sent: ${currentLifetime} + ${points} = ${newLifetimeScore}` 
    ); 
} 

function applyRngLifetimeUpdateResult(score) { 
    const storedResult = 
        loadLocalRngResult(); 

    if ( 
        storedResult 
    ) { 
        storedResult.lifetimeRecordScore = 
            score; 

        saveLocalRngResult( 
            storedResult 
        ); 
    } 

    const lifetimeValueElement = 
        getRngLifetimeStatValueElement(); 

    if ( 
        !lifetimeValueElement 
    ) { 
        return; 
    } 

    lifetimeValueElement.setAttribute( 
        'data-rng-lifetime-confirmed-score', 
        String( 
            Math.round( 
                score 
            ) 
        ) 
    ); 
} 

function applyDailyRollState(state) {  
    return;  
}  

function renderStoredRngResult(payload) {  
    if ( 
        !payload || 
        typeof payload !== 'object' || 
        payload.record === undefined 
    ) { 
        return; 
    } 

    if (rngScrambleElement) { 
        rngScrambleElement.remove(); 
        rngScrambleElement = null; 
    } 

    clearRngRecordCardWiggle(); 

    if (rngResultPanel) {  
        rngResultPanel.remove();  
        rngResultPanel = null;  
    }  

    const displayRarity = 
        getRngDisplayRarity( 
            payload 
        ); 

    applyRngRarityTheme( 
        displayRarity 
    ); 

    rngResultPanel =  
        document.createElement('div');  

    rngResultPanel.className =  
        'rngResultPanel';  

    generateScreen.appendChild(  
        rngResultPanel  
    );  

    const card = createRngRecordCard(
        payload,
        String(payload.record ?? '')
    );

    rngResultPanel.appendChild(card);
    scheduleRngDuplicateReveal(card); 

    animateRngRecordCard( 
        card, 
        null, 
        () => { 
            scheduleRngDuplicateReveal(card); 
        } 
    ); 

    if ( 
        mainScreen.classList.contains( 
            'hidden' 
        ) 
    ) { 
        rngStoredResultScrollPending = 
            true; 
    } else { 
        scrollRngResultIntoView(card); 
    } 

    updateScrollRail();  
}  

function normalizeRngModifiers(modifiers) {  
    const normalizeModifierObject = (modifier, fallbackLabel) => {
        const label =
            modifier.name ??
            modifier.modifier ??
            modifier.type ??
            modifier.id ??
            fallbackLabel;

        const excludedFields = [
            'name',
            'modifier',
            'type',
            'id',
            'rarity',
            'tier',
            'rank',
            'points',
            'pointBonus',
            'point_bonus',
            'pointsBonus',
            'points_bonus',
            'pointValue',
            'point_value',
            'description',
            'shortDescription',
            'short_description',
            'desc',
            'details'
        ];

        const detailEntries = Object.entries(modifier)
            .filter(([key]) => {
                return !excludedFields.includes(key);
            });

        let detail =
            modifier.description ??
            modifier.shortDescription ??
            modifier.short_description ??
            modifier.desc ??
            modifier.details ??
            '';

        if (
            detail === '' &&
            detailEntries.length === 1
        ) {
            detail = detailEntries[0][1];
        } else if (
            detail === '' &&
            detailEntries.length > 1
        ) {
            detail = detailEntries
                .map(([key, value]) => {
                    return `${key}: ${formatRngValue(value)}`;
                })
                .join(' • ');
        }

        return {
            label: String(label),
            value: formatRngValue(detail),
            description: formatRngValue(detail),
            rarity:
                modifier.rarity ??
                modifier.tier ??
                modifier.rank ??
                '',
            points:
                modifier.points ??
                modifier.pointBonus ??
                modifier.point_bonus ??
                modifier.pointsBonus ??
                modifier.points_bonus ??
                modifier.pointValue ??
                modifier.point_value ??
                null
        };
    };

    if (Array.isArray(modifiers)) {  
        return modifiers.map((modifier, index) => {  
            if (  
                modifier &&  
                typeof modifier === 'object' &&  
                !Array.isArray(modifier)  
            ) {  
                return normalizeModifierObject(
                    modifier,
                    `Modifier ${index + 1}`
                );
            }  

            const value = formatRngValue(modifier);

            return {  
                label: `Modifier ${index + 1}`,  
                value,
                description: value,
                rarity: '',
                points: null
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
                return normalizeModifierObject(
                    value,
                    key
                );
            }  

            const detail = formatRngValue(value);

            return {  
                label: key,  
                value: detail,
                description: detail,
                rarity: '',
                points: null
            };  
        });  
    }  

    if (  
        modifiers !== undefined &&  
        modifiers !== null &&  
        modifiers !== ''  
    ) {  
        const detail = formatRngValue(modifiers);

        return [{ 
            label: 'Modifier', 
            value: detail,
            description: detail,
            rarity: '',
            points: null
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

    if ( 
        String(label).toLowerCase().includes( 
            'lifetime' 
        ) 
    ) { 
        stat.classList.add( 
            'rngLifetimeStat' 
        ); 

        stat.style.position = 
            'relative'; 

        statLabel.classList.add( 
            'rngLifetimeStatLabel' 
        ); 
    } 

    const statValue = document.createElement('div');  
    statValue.className = 'rngStatValue';  

    statValue.style.overflowWrap = 
        'anywhere'; 

    statValue.style.wordBreak = 
        'break-word'; 

    if ( 
        String(label).toLowerCase().includes( 
            'lifetime' 
        ) 
    ) { 
        statValue.classList.add( 
            'rngLifetimeScoreValue' 
        ); 

        const normalValue = 
            document.createElement('span'); 

        normalValue.className = 
            'rngLifetimeNormalValue'; 

        const initialLifetime = 
            Number( 
                value 
            ); 

        if ( 
            Number.isFinite( 
                initialLifetime 
            ) 
        ) { 
            normalValue.textContent = 
                String( 
                    Math.round( 
                        initialLifetime 
                    ) 
                ); 

            statValue.setAttribute( 
                'data-rng-lifetime-score', 
                String( 
                    Math.round( 
                        initialLifetime 
                    ) 
                ) 
            ); 

            statValue.setAttribute( 
                'aria-label', 
                String( 
                    Math.round( 
                        initialLifetime 
                    ) 
                ) 
            ); 
        } else { 
            normalValue.textContent = 
                formatRngValue( 
                    value 
                ); 
        } 

        statValue.appendChild( 
            normalValue 
        ); 
    } else { 
        statValue.textContent = 
            formatRngValue( 
                value 
            ); 
    } 

    if (valueColor) {  
        statValue.style.color = valueColor;  
        statValue.style.textShadow =  
            `0 0 8px ${valueColor}55`;  
    }  

    stat.appendChild(  
        statLabel  
    );  

    stat.appendChild(  
        statValue  
    );  

    return stat;  
}  

function createRngRecordCard(payload, recordText) {  
    const card = document.createElement('div');  
    card.className = 'rngRecordCard';
    card.style.background =
        'linear-gradient(135deg, #30343a 0%, #24282d 48%, #13171b 100%)';

    const displayRarity = 
        getRngDisplayRarity( 
            payload 
        ); 

    const normalizedRarity = 
        normalizeRngRarity( 
            displayRarity 
        ); 

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

    recordLabel.style.fontSize = 
        '28px'; 

    const recordValue = document.createElement('div');  
    recordValue.className = 'rngRecordValue';  
    recordValue.textContent = recordText;  

    const fullRarityPlaceholder = document.createElement('div');
    fullRarityPlaceholder.className = 'rngFullRarityPlaceholder';
    fullRarityPlaceholder.textContent = 'N/A';

    recordHeader.appendChild(recordLabel);  
    recordHeader.appendChild(recordValue);  
    recordHeader.appendChild(fullRarityPlaceholder);
    card.appendChild(recordHeader);  

    const stats = document.createElement('div');  
    stats.className = 'rngStats';  

    const rarityStat = 
        createRngStat(  
            'Base Rarity',  
            displayRarity !== 'unknown' 
                ? displayRarity 
                : payload.rarity ?? 'Unknown',  
            getRngRarityColor(displayRarity)  
        ); 

    const rarityValue =
        rarityStat.querySelector(
            '.rngStatValue'
        );

    if (rarityValue) {
        const rarityText =
            document.createElement('span');

        rarityText.className =
            'rngRarityText';

        rarityText.textContent =
            rarityValue.textContent.trim();

        rarityText.setAttribute(
            'data-rng-shine-text',
            rarityText.textContent
        );

        rarityValue.textContent = '';

        rarityValue.classList.add(
            'rngRarityValue'
        );

        rarityValue.appendChild(
            rarityText
        );
    }

    stats.appendChild( 
        rarityStat 
    );  

    stats.appendChild(  
        createRngStat(  
            'Points',  
            payload.points ?? '0'  
        )  
    );  

    stats.appendChild( 
        createRngStat( 
            'Lifetime Score', 
            payload.lifetimeRecordScore ?? 
                payload.lifetimeScore ?? 
                payload.lifetime_record_score ?? 
                '0' 
        ) 
    ); 

    stats.appendChild( 
        createRngStat( 
            'Times Rolled', 
            payload.timesRolled ?? 
                payload.times_rolled ?? 
                1 
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

    const modifiersDescription = document.createElement('div');
    modifiersDescription.className = 'rngModifiersDescription';
    modifiersDescription.textContent = 'Modifiers can increase rarity and points beyond the base rarity.';

    modifiersSection.appendChild(
        modifiersDescription
    );

    const modifiersGrid = document.createElement('div');  
    modifiersGrid.className = 'rngModifiers';  

    const modifiers = normalizeRngModifiers(  
        payload.modifiers 
    );

    modifiers.push({
        label: 'Test Modifier',
        value: '',
        description: 'A temporary test modifier used to preview the stacked modifier layout.',
        rarity: displayRarity !== 'unknown' ? displayRarity : 'common',
        points: 25
    });

    if (modifiers.length === 0) {  
        const none = document.createElement('div');  
        none.className = 'rngNoModifiers';  
        none.textContent = 'No modifiers';  
        modifiersGrid.appendChild(none);  
    } else {  
        modifiers.forEach(modifier => {  
            const modifierCard = document.createElement('div');  
            modifierCard.className = 'rngModifier';

            const modifierRarity =
                normalizeRngRarity(
                    modifier.rarity || displayRarity
                );

            const finalModifierRarity =
                modifierRarity !== 'unknown'
                    ? modifierRarity
                    : (normalizedRarity !== 'unknown' ? normalizedRarity : 'common');

            modifierCard.setAttribute(
                'data-rarity',
                finalModifierRarity
            );

            const modifierHeader = document.createElement('div');
            modifierHeader.className = 'rngModifierHeader';

            const modifierRarityLabel = document.createElement('span');
            modifierRarityLabel.className = 'rngModifierRarity';
            modifierRarityLabel.textContent = `[${finalModifierRarity.toUpperCase()}]`;

            const modifierName = document.createElement('span');
            modifierName.className = 'rngModifierName';
            modifierName.textContent = modifier.label;

            modifierHeader.appendChild(modifierRarityLabel);
            modifierHeader.appendChild(modifierName);

            if (
                modifier.points !== null &&
                modifier.points !== undefined &&
                modifier.points !== ''
            ) {
                const numericPoints = Number(modifier.points);
                const pointsText = Number.isFinite(numericPoints)
                    ? `(${numericPoints >= 0 ? '+' : ''}${numericPoints})`
                    : `(${String(modifier.points).trim()})`;

                const modifierPoints = document.createElement('span');
                modifierPoints.className = 'rngModifierPoints';
                modifierPoints.textContent = pointsText;
                modifierHeader.appendChild(modifierPoints);
            }

            const modifierDescription = document.createElement('div');
            modifierDescription.className = 'rngModifierDescription';
            modifierDescription.textContent =
                modifier.description ||
                modifier.value ||
                'Modifier details unavailable.';

            modifierCard.appendChild(modifierHeader);
            modifierCard.appendChild(modifierDescription);
            modifiersGrid.appendChild(modifierCard);  
        });  
    }  

    modifiersSection.appendChild(modifiersGrid);  
    card.appendChild(modifiersSection);  

    if (isRngDuplicatePayload(payload)) {
        const duplicateOverlay =
            document.createElement('div');

        duplicateOverlay.className =
            'rngDuplicateOverlay';

        duplicateOverlay.setAttribute(
            'aria-label',
            'Duplicate roll'
        );

        const duplicateText =
            document.createElement('span');

        duplicateText.className =
            'rngDuplicateText';

        duplicateText.textContent =
            'DUPLICATE';

        duplicateText.setAttribute(
            'data-rng-shine-text',
            'DUPLICATE'
        );

        duplicateText.setAttribute(
            'aria-hidden',
            'true'
        );

        duplicateOverlay.appendChild(
            duplicateText
        );

        card.appendChild(
            duplicateOverlay
        );
    }

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

    if (rngScrambleElement) { 
        rngScrambleElement.remove(); 
        rngScrambleElement = null; 
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

    const displayRarity = 
        getRngDisplayRarity( 
            payload 
        ); 

    applyRngRarityTheme( 
        displayRarity 
    ); 

    createRngTopControlArea(); 

    const scramble =  
        document.createElement('div');  

    scramble.className =  
        'rngScramble';  

    scramble.style.display = 
        'flex'; 

    scramble.style.alignItems = 
        'center'; 

    scramble.style.justifyContent = 
        'center'; 

    scramble.style.visibility = 
        'visible'; 

    scramble.style.opacity = 
        '1'; 

    scramble.style.background = 
        'transparent'; 

    scramble.style.border = 
        '0'; 

    scramble.style.boxShadow = 
        'none'; 

    scramble.style.position = 
        'relative'; 

    scramble.style.zIndex = 
        '2'; 

    scramble.style.width = 
        '350px'; 

    scramble.style.minWidth = 
        '350px'; 

    scramble.style.maxWidth = 
        '350px'; 

    scramble.style.minHeight = 
        '58px'; 

    scramble.style.margin = 
        '0 auto'; 

    scramble.style.flexShrink = 
        '0'; 

    rngScrambleElement = 
        scramble; 

    rngTopControlArea.appendChild( 
        scramble 
    ); 

    void scramble.offsetWidth; 

    updateScrollRail(); 

    const recordText = String(payload.record);  

    if (recordText.length === 0) {  
        scramble.textContent = '';  

        rngResultPanel = 
            document.createElement('div'); 

        rngResultPanel.className = 
            'rngResultPanel'; 

        generateScreen.appendChild( 
            rngResultPanel 
        ); 

        const card =  
            createRngRecordCard(  
                payload,  
                recordText  
            );  

        rngResultPanel.appendChild(card);
        scheduleRngDuplicateReveal(card);
        scrollRngResultIntoView(card); 

        animateRngRecordCard( 
            card, 
            () => { 
                scheduleRngLifetimeScoreAnimation( 
                    payload 
                ); 
            }, 
            () => { 
                scheduleRngDuplicateReveal(card); 
            } 
        ); 

        updateScrollRail();  
        initializeRngGenerateButton(); 
        rngScrambleElement = null; 
        scramble.remove(); 
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

        rngResultPanel = 
            document.createElement('div'); 

        rngResultPanel.className = 
            'rngResultPanel'; 

        generateScreen.appendChild( 
            rngResultPanel 
        ); 

        const card = 
            createRngRecordCard( 
                payload, 
                recordText 
            ); 

        rngResultPanel.appendChild(card);

        scheduleRngDuplicateReveal(card);

        scrollRngResultIntoView(card); 

        animateRngRecordCard( 
            card, 
            () => { 
                scheduleRngLifetimeScoreAnimation( 
                    payload 
                ); 
            }, 
            () => { 
                scheduleRngDuplicateReveal(card); 
            } 
        ); 

        updateRngDailyCountdown(); 
        updateScrollRail(); 

        rngScrambleElement = null; 

        scramble.remove(); 
    } 

    appearedCount = 
        1; 

    for ( 
        let i = 0; 
        i < appearedCount; 
        i++ 
    ) { 
        scrambleCharacters[i] = 
            getRandomRngCharacter(); 
    } 

    renderScramble(); 

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

    if ( 
        isRngCooldownActive() 
    ) { 
        return; 
    } 

    if (rngDailyActionArea) {  
        return;  
    }  

    if (rngRequestPending) {  
        return;  
    }  

    if (rngRollLoadingPending) { 
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

    rngControlSlot.appendChild(  
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

            rngRollLoadingPending = true; 
            errorMessage.classList.add( 
                "hidden" 
            ); 

            startRngRollLoading(() => { 
                rngRollLoadingPending = false; 
                beginRngRollRequest(); 
            }); 
        }  
    );  
}  

function beginRngRollRequest() { 
    const nextRollTimestamp = 
        getRngNextRollTimestamp(); 

    const serverNow = 
        getRngServerNow(); 

    if ( 
        typeof nextRollTimestamp !== 'number' || 
        !Number.isFinite(nextRollTimestamp) || 
        typeof serverNow !== 'number' || 
        !Number.isFinite(serverNow) 
    ) { 
        if ( 
            typeof serverNow !== 'number' || 
            !Number.isFinite(serverNow) 
        ) { 
            rngRequestPending = false; 

            errorMessage.textContent = 
                "⚠️ Action Cancelled: Server time has not been synchronized yet."; 

            errorMessage.classList.remove( 
                "hidden" 
            ); 

            initializeRngGenerateButton(); 
            return; 
        } 
    } 

    if ( 
        isRngCooldownActive() 
    ) { 
        updateRngDailyCountdown(); 
        return; 
    } 

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

function initializeRngFrontend() {  
    if ( 
        !generateScreen ||  
        rngFrontendInitialized 
    ) { 
        return; 
    } 

    rngFrontendInitialized = true; 

    if (!rngLocalRollState) { 
        rngLocalRollState = 
            loadLocalRngRollState(); 
    } 

    createRngTopControlArea();  
    createRngDailyStatus();  
    hideRngDailyStatus();  
    clearRngRarityTheme();  

    const storedResult = 
        loadLocalRngResult(); 

    if ( 
        storedResult && 
        isRngCooldownActive() 
    ) { 
        renderStoredRngResult( 
            storedResult 
        ); 
    } else if ( 
        storedResult 
    ) { 
        clearLocalRngResult(); 
    } 

    updateRngDailyCountdown();  

    if ( 
        !rngResultPanel && 
        !rngRequestPending && 
        !rngRollLoadingPending 
    ) { 
        initializeRngGenerateButton(); 
    } 

    maybePlayRngLaunchFlash();  
} 




/* 
============================================================ 
===== TEMP RNG COOLDOWN BYPASS - START REMOVE HERE ===== 
============================================================ 

REMOVE EVERYTHING FROM THE START MARKER ABOVE 
THROUGH THE END MARKER BELOW. 

PRESS CTRL + SHIFT + R TO ROLL DURING COOLDOWN. 
*/

document.addEventListener( 
    'keydown', 
    event => { 

        if ( 
            !event.ctrlKey || 
            !event.shiftKey || 
            event.key.toLowerCase() !== 'r' 
        ) { 
            return; 
        } 

        event.preventDefault(); 

        if ( 
            rngRequestPending || 
            rngRollLoadingPending 
        ) { 
            return; 
        } 

        if ( 
            !socket || 
            socket.readyState !== 
                WebSocket.OPEN 
        ) { 
            errorMessage.textContent = 
                "⚠️ Temporary RNG bypass failed: Socket is not open."; 

            errorMessage.classList.remove( 
                "hidden" 
            ); 

            return; 
        } 

        console.log( 
            "⚠️ TEMP RNG COOLDOWN BYPASS ACTIVE" 
        ); 

        if (rngDailyActionArea) { 
            rngDailyActionArea.remove(); 
            rngDailyActionArea = null; 
        } 

        rngRollLoadingPending = 
            true; 

        errorMessage.classList.add( 
            "hidden" 
        ); 

        startRngRollLoading(() => { 

            rngRollLoadingPending = 
                false; 

            rngRequestPending = 
                true; 

            socket.send( 
                JSON.stringify({ 
                    protocol: "cardgame", 
                    version: 1, 
                    request: "rng_go" 
                }) 
            ); 

        }); 

    } 
);


/* 
============================================================ 
===== TEMP RNG COOLDOWN BYPASS - END MARKER ===== 
============================================================ 

EVERYTHING ABOVE THIS END MARKER IS TEMPORARY. 
EVERYTHING BELOW/OUTSIDE THIS BLOCK IS REAL CODE. 
============================================================ 
*/