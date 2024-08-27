function updateTimeDate() {
  const timeDateElement = document.getElementById("time-date");
  const currentDateTime = new Date();

  const timeOptions = {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 1,
  };

  const dateOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };

  const formattedTime = currentDateTime.toLocaleString("default", timeOptions);
  const formattedDate = currentDateTime.toLocaleString("default", dateOptions);

  timeDateElement.textContent = `${formattedDate.replace(
    /\//g,
    "/"
  )} ${formattedTime}`;
}

function toggleMode() {
  document.documentElement.classList.toggle("dark-mode");
  const modeSwitch = document.getElementById("mode-switch");
  const isDarkMode = document.documentElement.classList.contains("dark-mode");
  modeSwitch.textContent = isDarkMode ? "☀" : "☽";
  modeSwitch.setAttribute(
    "aria-label",
    isDarkMode ? "Switch to light mode" : "Switch to dark mode"
  );
}

setInterval(updateTimeDate, 10);

document.getElementById("mode-switch").addEventListener("click", toggleMode);

///////////////////////* COMMENTS *////////////////////////
///////////////////////* COMMENTS *////////////////////////
///////////////////////* COMMENTS *////////////////////////
///////////////////////* COMMENTS *////////////////////////

const API_URL = "http://comments.matiasberrios.com"

function toggleCommentBox() {
  const commentBox = document.getElementById("comment-box");
  commentBox.classList.toggle("hidden");

  const blurOverlay = document.getElementById("blur-overlay");
  blurOverlay.classList.toggle("blur");
}

function closeCommentBox() {
  const commentBox = document.getElementById("comment-box");
  commentBox.classList.add("hidden");

  const blurOverlay = document.getElementById("blur-overlay");
  blurOverlay.classList.remove("blur");
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeCommentBox();
  }
});

function sanitizeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function fetchComments() {
  return fetch(`${API_URL}`)
    .then((response) => response.json())
    .then((comments) => {
      const commentsList = document.getElementById("comments-list");
      commentsList.innerHTML = "";
      comments.forEach((comment) => {
        const commentElement = document.createElement("div");
        commentElement.classList.add("comment");

        const sanitizedTime = sanitizeHTML(comment.time);
        const sanitizedAlias = sanitizeHTML(comment.alias || "Anonymous");
        const sanitizedContent = sanitizeHTML(comment.content);

        commentElement.innerHTML = `<b>[${sanitizedTime}] ${sanitizedAlias}</b>: ${sanitizedContent}`;
        commentsList.appendChild(commentElement);
      });
    })
    .catch((error) => console.error("Error fetching comments:", error));
}

function submitComment(event) {
  event.preventDefault();
  const name = document.getElementById("commenter-name").value || "Anonymous";
  const comment = document.getElementById("comment-text").value;
  const submitButton = document.getElementById("submit-button");
  const loadingSpinner = document.getElementById("loading-spinner");
  const nameInput = document.getElementById("commenter-name");
  const textInput = document.getElementById("comment-text");

  loadingSpinner.classList.remove("hidden");
  submitButton.disabled = true;
  nameInput.disabled = true;
  textInput.disabled = true;

  fetch(`${API_URL}/new?alias=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: comment,
  })
    .then((response) => {
      if (response.ok) {
        return fetchComments();
      } else {
        console.error("Failed to submit comment");
        throw new Error("Failed to submit comment");
      }
    })
    .catch((error) => console.error("Error submitting comment:", error))
    .finally(() => {
      fetchComments().finally(() => {
        submitButton.disabled = false;
        document.getElementById("comment-form").reset();
        nameInput.disabled = false;
        textInput.disabled = false;
        loadingSpinner.classList.add("hidden");
        const list = document.getElementById("comments-list");
        list.scroll({ top: list.scrollHeight });
      });
    });
}

document
  .getElementById("comment-toggle")
  .addEventListener("click", toggleCommentBox);

document
  .getElementById("comment-close")
  .addEventListener("click", toggleCommentBox);

document
  .getElementById("comment-form")
  .addEventListener("submit", submitComment);

fetchComments();

///////////////////////* COMMENTS *////////////////////////
///////////////////////* COMMENTS *////////////////////////
///////////////////////* COMMENTS *////////////////////////
///////////////////////* COMMENTS *////////////////////////
///////////////////////* COMMENTS *////////////////////////

///////////////////////* DRAG *////////////////////////
///////////////////////* DRAG *////////////////////////
///////////////////////* DRAG *////////////////////////
///////////////////////* DRAG *////////////////////////
dragElement(document.getElementById("comment-box"));

function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  elmnt.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();

    // Check if the target element is an input, button, or textarea
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      e.target.focus();
      return;
    }
    if (e.target.tagName === "BUTTON") {
      return;
    }

    if (
      e.target.id === "comments-list" ||
      e.target.classList.contains("comment")
    ) {
      return;
    }

    pos3 = e.clientX;
    elmnt.classList.toggle("dragging");

    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    elmnt.classList.toggle("dragging");
  }
}
