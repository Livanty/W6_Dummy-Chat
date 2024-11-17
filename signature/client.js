const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // impor modul 

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let registeredUsername = "";
let username = "";
const users = new Map();

// untuk menghasilkan pasangan kunci RSA (publicKey dan privateKey).
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048, // standart min keamanan RSA
});

socket.on("connect", () => {
  console.log("Connected to the server");

  socket.on("init", (keys) => {
    keys.forEach(([user, key]) => users.set(user, key)); // pakai map untuk menyimpang username sma kunci publik 
    console.log(`There are currently ${users.size} users in the chat`);

    rl.question("Enter your username: ", (input) => {
      username = input;
      registeredUsername = input;
      console.log(`Welcome, ${username} to the chat`);

      socket.emit("registerPublicKey", { // Mengirim kunci publik ke server
        username,
        publicKey: publicKey.export({ type: "pkcs1", format: "pem" }),
      });
      rl.prompt();

      rl.on("line", (message) => {
        if (message.trim()) {
          if ((match = message.match(/^!impersonate (\w+)$/))) {
            username = match[1];
            console.log(`Now impersonating as ${username}`);
          } else if (message.match(/^!exit$/)) {
            username = registeredUsername;
            console.log(`Now you are ${username}`);
          } else { // Membuat signature yang digunakan untuk memastikan keaslian dan integritas pesan
            const sign = crypto.createSign("sha256");
            sign.update(message); 
            sign.end();
            const signature = sign.sign(privateKey, "hex"); // dikonversi ke heksa

            // mengirim pesan dan signature
            socket.emit("message", {
              username,
              message,
              signature,
            });
          }
        }
        rl.prompt();
      });
    });
  });
});

socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey);
  console.log(`${username} joined the chat`);
  rl.prompt();
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage, signature } = data;

  if (senderUsername !== username) // tidak memproses pesan yang mereka kirim sendiri.
 { 
    const senderPublicKey = users.get(senderUsername); // Mencari public key pengirim

    // Verifikasi oleh Penerima dengan kunci publik 
    if (senderPublicKey && signature) {
      const verify = crypto.createVerify("sha256");
      verify.update(senderMessage);
      verify.end();

      // Signature diverifikasi menggunakan public key dari pengirim.
      const isVerified = verify.verify(senderPublicKey, signature, "hex");

      if (isVerified) {
        console.log(`${senderUsername}: ${senderMessage}`);
      } else {
        console.log(`${senderUsername}: ${senderMessage}`);
        console.log(`This user is fake`);
      }
    } else if (!signature) {
      console.log(`Warning: ${senderUsername} sent a message without a signature`);
    } else {
      console.log(`Warning: No public key found for ${senderUsername}`);
    }
  }

  rl.prompt();
});

socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});
