import express from "express";
import http from "http";
import { Server } from "socket.io";
import axios from "axios";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // Join Room
  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom)?.delete(currentUser);
    }

    currentRoom = roomId;
    currentUser = userName;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(userName);

    io.to(roomId).emit("userJoined", [...rooms.get(roomId)]);
  });

  // Code Changes
  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  // Language Change
  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // Typing Indicator
  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  // Compile Code using Piston API
  socket.on("compileCode", async ({ code, roomId, language, version, input }) => {
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language,
        version,
        files: [{ content: code }],
        stdin: input
      });

      io.to(roomId).emit("codeResponse", response.data);
    } catch (error) {
      console.error("Compilation error:", error.message);
      io.to(roomId).emit("codeResponse", {
        run: { output: "Error compiling code or contacting API." }
      });
    }
  });

  // Leave Room
  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...rooms.get(currentRoom)]);
      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  // Handle Disconnect
  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...rooms.get(currentRoom)]);
    }
    console.log("User disconnected:", socket.id);
  });
});

// Static Frontend Support
const port = process.env.PORT || 5000;
app.use(express.static(path.join(__dirname, "./frontend/dist")));

app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});


// Start Server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
