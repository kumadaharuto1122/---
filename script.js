// ===== ユーザー設定 =====
let username = localStorage.getItem("username") || "ゲスト" + Math.floor(Math.random() * 1000);
localStorage.setItem("username", username);

// ===== SkyWay初期化 =====
const peer = new Peer({
  key: "9c855024-4e55-4756-bf81-a37bcae33004", // ← SkyWayのAPIキーに置き換えてください
  debug: 2,
});

let localStream;
let connections = {};
let dataConnections = {};

// ===== DOM参照 =====
const videoGrid = document.getElementById("video-grid");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const btnMic = document.getElementById("btn-mic");
const btnCam = document.getElementById("btn-cam");

// ===== カメラ・マイク取得 =====
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    addVideo(stream, peer.id, username, true);
  })
  .catch(err => console.error(err));

// ===== Peer接続準備 =====
peer.on("open", id => {
  console.log("My peer ID:", id);
  // 他の参加者に接続
  peer.listAllPeers(list => {
    list.forEach(pid => {
      if (pid !== id) connectToPeer(pid);
    });
  });
});

// ===== 呼び出しを受けた場合 =====
peer.on("call", call => {
  call.answer(localStream);
  setupCall(call);
});

// ===== データ接続を受けた場合 =====
peer.on("connection", conn => {
  setupDataConnection(conn);
});

// ===== 接続関数 =====
function connectToPeer(peerId) {
  if (connections[peerId]) return;

  const call = peer.call(peerId, localStream);
  setupCall(call);

  const conn = peer.connect(peerId);
  setupDataConnection(conn);
}

// ===== メディア接続設定 =====
function setupCall(call) {
  call.on("stream", stream => {
    addVideo(stream, call.peer, "???");
  });
  call.on("close", () => {
    removeVideo(call.peer);
  });
  connections[call.peer] = call;
}

// ===== データ接続設定 =====
function setupDataConnection(conn) {
  conn.on("open", () => {
    conn.send({ type: "username", name: username });
  });
  conn.on("data", data => {
    if (data.type === "chat") {
      appendChat(data.name, data.text);
    } else if (data.type === "username") {
      updateName(conn.peer, data.name);
    }
  });
  conn.on("close", () => {
    removeVideo(conn.peer);
  });
  dataConnections[conn.peer] = conn;
}

// ===== 映像追加 =====
function addVideo(stream, peerId, name, isLocal = false) {
  if (document.getElementById("video-" + peerId)) return;

  const wrapper = document.createElement("div");
  wrapper.className = "video-wrapper";
  wrapper.id = "video-" + peerId;

  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  if (isLocal) video.muted = true;

  const tag = document.createElement("div");
  tag.className = "name-tag";
  tag.textContent = name;

  wrapper.appendChild(video);
  wrapper.appendChild(tag);
  videoGrid.appendChild(wrapper);
}

// ===== 映像削除 =====
function removeVideo(peerId) {
  const el = document.getElementById("video-" + peerId);
  if (el) el.remove();
  delete connections[peerId];
  delete dataConnections[peerId];
}

// ===== 名前更新 =====
function updateName(peerId, name) {
  const el = document.querySelector(`#video-${peerId} .name-tag`);
  if (el) el.textContent = name;
}

// ===== チャット送受信 =====
chatForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  appendChat(username, text);
  Object.values(dataConnections).forEach(conn => {
    conn.send({ type: "chat", name: username, text });
  });
  chatInput.value = "";
});

function appendChat(name, text) {
  const div = document.createElement("div");
  div.textContent = `${name}: ${text}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ===== マイク・カメラ制御（文字付きボタン） =====
let micEnabled = true;
let camEnabled = true;

btnMic.addEventListener("click", () => {
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
  btnMic.textContent = micEnabled ? "マイクON" : "マイクOFF";
  btnMic.style.background = micEnabled ? "#40444b" : "red";
});

btnCam.addEventListener("click", () => {
  camEnabled = !camEnabled;
  localStream.getVideoTracks().forEach(track => track.enabled = camEnabled);
  btnCam.textContent = camEnabled ? "カメラON" : "カメラOFF";
  btnCam.style.background = camEnabled ? "#40444b" : "red";
});
