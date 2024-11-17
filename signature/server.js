const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer();
const io = socketIo(server);

const users = new Map();

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  socket.emit("init", Array.from(users.entries()));

  // Menerima data klien (username & public key)
  socket.on("registerPublicKey", (data) => {
    const { username, publicKey } = data;
    users.set(username, publicKey); // menyimpan user name & public key ke dlm struktur data users
    console.log(`${username} registered with public key.`);

    io.emit("newUser", { username, publicKey });
     // mengirim user sma public key yang disimpan ke semua klien yg terhubung
  });

  socket.on("message", (data) => {
    const { username, message, signature } = data;
    io.emit("message", { username, message, signature });
  });
  

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});