const screen1 = document.getElementById('screen1');
const screen2 = document.getElementById('screen2');
const testButton = document.getElementById('testButton');
const rngButton = document.getElementById('rngButton');
const errorMessage = document.getElementById('errorMessage');

let socket = null;

function initializeWebSocket() {
    // Relative configuration tells Discord to funnel traffic through your portal mapping
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
            errorMessage.textContent = "❌ ERROR: Proxy Handoff Failure (1006). Discord's network engine cannot ping your Bot-Hosting container port, or your backend layout dropped the connection.";
        } else if (event.code === 1015) {
            errorMessage.textContent = "❌ ERROR: SSL Handshake failure (1015). Discord required a secure connection that your backend container port didn't accept.";
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
