const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("🚀 Signaling server running on port", PORT);

let android = null;
let browser = null;

wss.on("connection", (ws) => {
    console.log("🟢 Client connected");

    ws.on("message", (message) => {
        const msg = message.toString();
        const data = JSON.parse(msg);

        // First message decides role
        if (data.type === "register") {
            if (data.role === "android") {
                android = ws;
                console.log("🤖 Android registered");
            } else if (data.role === "browser") {
                browser = ws;
                console.log("🖥 Browser registered");
            }
            return;
        }

        // Android → Browser
        if (ws === android && browser) {
            browser.send(msg);
        }

        // Browser → Android
        if (ws === browser && android) {
            android.send(msg);
        }
    });

    ws.on("close", () => {
        if (ws === android) android = null;
        if (ws === browser) browser = null;
        console.log("🔴 Client disconnected");
    });
});
