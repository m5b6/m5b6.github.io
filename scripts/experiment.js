let socket;
let localVersion = 0;
let serverVersion = 0;

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function initWebSocket(userId) {
  socket = new WebSocket(
    `wss://experiment.matiasberrios.com/websocket?userId=${userId}`
  );

  socket.onopen = () => {
    document.getElementById("status").textContent += " ✓";
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received update:", data);

    if (data.error) {
      document.getElementById("status").textContent = data.error;
    } else if (data.version > serverVersion) {
      serverVersion = data.version;
      if (serverVersion > localVersion) {
        document.getElementById("collaborativeTextarea").value = data.content;
        localVersion = serverVersion;
      }
    }
  };

  socket.onclose = (event) => {
    console.log("WebSocket connection closed:", event);
    document.getElementById("status").textContent +=
      " - disconnected please reload :(";
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    document.getElementById("status").textContent += " - something went wrong";
  };
}

const sendUpdate = debounce(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    localVersion++;
    const content = document.getElementById("collaborativeTextarea").value;
    console.log("Sending update:", { content, version: localVersion });
    socket.send(JSON.stringify({ content, version: localVersion }));
  }
}, 100);

document
  .getElementById("collaborativeTextarea")
  .addEventListener("input", (event) => {
    sendUpdate();
  });

function handleCredentialResponse(response) {
  const responsePayload = decodeJwtResponse(response.credential);

  document.getElementById("collaborativeTextarea").disabled = false;
  document.getElementById("status").textContent =
    "welcome " + responsePayload.name;

  initWebSocket(responsePayload.sub);
}

function decodeJwtResponse(token) {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
  return JSON.parse(jsonPayload);
}