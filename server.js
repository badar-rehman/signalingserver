const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("🚀 Signaling server running on port", PORT);

// Store connected clients
let camera = null; // Android camera (only one)
const viewers = new Set(); // Multiple browser viewers

wss.on("connection", (ws) => {
    console.log("🟢 Client connected");

    ws.on("message", (message) => {
        const msg = message.toString();
        const data = JSON.parse(msg);

        // First message decides role
        if (data.type === "register") {
            if (data.role === "camera") {
                // Android camera registration
                if (camera && camera.readyState === WebSocket.OPEN) {
                    // Notify existing camera it's being replaced
                    camera.send(JSON.stringify({
                        type: "camera_replaced",
                        message: "Another camera connected"
                    }));
                    camera.close();
                }
                
                camera = ws;
                console.log("📷 Camera registered (Android)");
                
                // Notify camera it's ready
                ws.send(JSON.stringify({
                    type: "camera_registered",
                    status: "ready",
                    message: "Camera registered, waiting for viewers..."
                }));
                
                // Notify all viewers that camera is available
                viewers.forEach(viewer => {
                    if (viewer.readyState === WebSocket.OPEN) {
                        viewer.send(JSON.stringify({
                            type: "camera_status",
                            available: true
                        }));
                    }
                });
            } else if (data.role === "viewer") {
                // Browser viewer registration
                viewers.add(ws);
                console.log("👁️ Viewer registered (Browser)");
                
                // Send camera status to new viewer
                ws.send(JSON.stringify({
                    type: "camera_status",
                    available: camera !== null && camera.readyState === WebSocket.OPEN
                }));
            }
            return;
        }

        // Camera → Viewer (offer, answer, candidate)
        if (ws === camera) {
            if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
                // Forward to all connected viewers
                viewers.forEach(viewer => {
                    if (viewer.readyState === WebSocket.OPEN && viewer !== ws) {
                        viewer.send(msg);
                    }
                });
            }
        }
        
        // Viewer → Camera
        if (viewers.has(ws)) {
            if (data.type === "request_stream") {
                // Viewer requests stream from camera
                if (camera && camera.readyState === WebSocket.OPEN) {
                    camera.send(JSON.stringify({
                        type: "stream_request",
                        viewerId: data.viewerId || "anonymous"
                    }));
                }
            } else if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
                // Forward WebRTC signaling to camera
                if (camera && camera.readyState === WebSocket.OPEN) {
                    camera.send(msg);
                }
            } else if (data.type === "control") {
                // Forward control commands to camera
                if (camera && camera.readyState === WebSocket.OPEN) {
                    camera.send(msg);
                }
            }
        }
    });

    ws.on("close", () => {
        console.log("🔴 Client disconnected");
        
        // Remove from appropriate list
        if (ws === camera) {
            camera = null;
            console.log("📷 Camera disconnected");
            
            // Notify all viewers that camera is unavailable
            viewers.forEach(viewer => {
                if (viewer.readyState === WebSocket.OPEN) {
                    viewer.send(JSON.stringify({
                        type: "camera_status",
                        available: false
                    }));
                }
            });
        }
        
        if (viewers.has(ws)) {
            viewers.delete(ws);
            console.log("👁️ Viewer disconnected");
        }
    });
    
    ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error);
    });
});

// Keep alive ping
setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.ping();
        }
    });
}, 30000);