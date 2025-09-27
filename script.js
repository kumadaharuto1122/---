const API_KEY = "9c855024-4e55-4756-bf81-a37bcae33004";

let localStream;
let peer;
let dataConnections = {};
let mediaConnections = {};
let username = "ユーザー";
let chatHistory = [];

let micEnabled = true;
let camEnabled = true;
let isSharing = false;
let displayStream;

// === UI要素 ===
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const videos = document.getElementById("videos");

const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const shareBtn = document.getElementById("shareBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const usernameInput = document.getElementById("usernameInput");
const micSelect = document.getElementById("micSelect");
const cameraSelect = document.getElementById("cameraSelect");
const settingsCancel = document.getElementById("settingsCancel");
const settingsSave = document.getElementById("settingsSave");

// === 初期化 ===
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    addVideo(stream, "自分");

    peer = new Peer({ key: API_KEY, debug: 2 });

    peer.on("open", id => {
      console.log("My peer ID:", id);
    });

    peer.on("call", call => {
      call.answer(localStream);
      setupMediaConnection(call);
    });

    peer.on("connection", conn => {
      setupDataConnection(conn);
    });

    setInterval(findPeers, 3000);
  })
  .catch(err => {
    console.error(err);
    alert("カメラとマイクの利用が許可されませんでした。");
  });

// === 他のPeerを探す ===
function findPeers() {
  peer.listAllPeers(peers => {
    peers.forEach(id => {
      if (id === peer.id) return;
      if (!dataConnections[id]) {
        const conn = peer.connect(id);
        setupDataConnection(conn);
      }
      if (!mediaConnections[id]) {
        const call = peer.call(id, localStream);
        setupMediaConnection(call);
      }
    });
  });
}

// === ビデオ追加 ===
function addVideo(stream, labelText, peerId = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "video-wrapper";
  if (peerId) wrapper.id = `video-${peerId}`;

  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = labelText;
  if (peerId) label.id = `label-${peerId}`;

  wrapper.appendChild(video);
  wrapper.appendChild(label);
  videos.appendChild(wrapper);
}

// === データ接続 ===
function setupDataConnection(conn) {
  dataConnections[conn.peer] = conn;

  conn.on("open", () => {
    conn.send({ type: "username", name: username });
    if (chatHistory.length > 0) {
      conn.send({ type: "chatHistory", history: chatHistory });
    }
  });

  conn.on("data", data => {
    if (data.type === "username") {
      const label = document.getElementById(`label-${conn.peer}`);
      if (label) label.textContent = data.name;
    }
    if (data.type === "chat") {
      if (!chatHistory.some(m => m.id === data.id)) {
        chatHistory.push(data);
        appendMessage(data.name, data.text);
      }
    }
    if (data.type === "chatHistory") {
      data.history.forEach(msg => {
        if (!chatHistory.some(m => m.id === msg.id)) {
          chatHistory.push(msg);
          appendMessage(msg.name, msg.text);
        }
      });
    }
  });

  conn.on("close", () => {
    delete dataConnections[conn.peer];
  });
}

// === メディア接続 ===
function setupMediaConnection(call) {
  mediaConnections[call.peer] = call;
  call.on("stream", stream => {
    if (!document.getElementById(`video-${call.peer}`)) {
      addVideo(stream, call.peer, call.peer);
    }
  });
  call.on("close", () => {
    const el = document.getElementById(`video-${call.peer}`);
    if (el) el.remove();
    delete mediaConnections[call.peer];
  });
}

// === チャット送信 ===
chatSend.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  if (msg === "") return;
  const message = { type: "chat", id: Date.now() + peer.id, name: username, text: msg };
  chatHistory.push(message);
  appendMessage(username, msg);
  Object.values(dataConnections).forEach(conn => conn.send(message));
  chatInput.value = "";
});

// === チャット表示 ===
function appendMessage(name, text) {
  const div = document.createElement("div");
  div.textContent = `${name}: ${text}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// === マイク・カメラ切り替え ===
function updateButtonUI() {
  if (micEnabled) {
    muteBtn.textContent = "マイクON";
    muteBtn.style.backgroundColor = "green";
    muteBtn.style.color = "white";
  } else {
    muteBtn.textContent = "マイクOFF";
    muteBtn.style.backgroundColor = "red";
    muteBtn.style.color = "white";
  }

  if (camEnabled) {
    cameraBtn.textContent = "カメラON";
    cameraBtn.style.backgroundColor = "green";
    cameraBtn.style.color = "white";
  } else {
    cameraBtn.textContent = "カメラOFF";
    cameraBtn.style.backgroundColor = "red";
    cameraBtn.style.color = "white";
  }
}

muteBtn.addEventListener("click", () => {
  micEnabled = !micEnabled;
  if (localStream) {
    localStream.getAudioTracks().forEach(track => (track.enabled = micEnabled));
  }
  updateButtonUI();
});

cameraBtn.addEventListener("click", () => {
  camEnabled = !camEnabled;
  if (localStream) {
    localStream.getVideoTracks().forEach(track => (track.enabled = camEnabled));
  }
  updateButtonUI();
});

updateButtonUI();

// === 画面共有 ===
shareBtn.addEventListener("click", async () => {
  if (!isSharing) {
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = displayStream.getVideoTracks()[0];

      replaceTrack(videoTrack);

      const selfVideo = document.querySelector(".video-wrapper video");
      if (selfVideo) {
        selfVideo.srcObject = displayStream;
      }

      isSharing = true;
      shareBtn.textContent = "共有停止";
      shareBtn.style.backgroundColor = "red";
      shareBtn.style.color = "white";

      videoTrack.onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error("画面共有エラー:", err);
    }
  } else {
    stopSharing();
  }
});

function stopSharing() {
  if (displayStream) {
    displayStream.getTracks().forEach(track => track.stop());
  }

  const videoTrack = localStream.getVideoTracks()[0];
  replaceTrack(videoTrack);

  const selfVideo = document.querySelector(".video-wrapper video");
  if (selfVideo) {
    selfVideo.srcObject = localStream;
  }

  isSharing = false;
  shareBtn.textContent = "画面共有";
  shareBtn.style.backgroundColor = "";
  shareBtn.style.color = "";
}

function replaceTrack(newTrack) {
  Object.values(mediaConnections).forEach(call => {
    const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
    if (sender) sender.replaceTrack(newTrack);
  });
}

// === 設定モーダル ===
settingsBtn.addEventListener("click", () => {
  usernameInput.value = username;
  settingsModal.style.display = "flex";
  loadDeviceList();
});

settingsCancel.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

settingsSave.addEventListener("click", () => {
  username = usernameInput.value || "ユーザー";
  settingsModal.style.display = "none";
  Object.values(dataConnections).forEach(conn => {
    conn.send({ type: "username", name: username });
  });
});

// === デバイス一覧 ===
function loadDeviceList() {
  navigator.mediaDevices.enumerateDevices().then(devices => {
    micSelect.innerHTML = "";
    cameraSelect.innerHTML = "";
    devices.forEach(device => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `${device.kind}`;
      if (device.kind === "audioinput") micSelect.appendChild(option);
      if (device.kind === "videoinput") cameraSelect.appendChild(option);
    });
  });
}
