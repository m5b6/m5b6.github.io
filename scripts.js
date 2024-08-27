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

const API_URL = "http://35.174.112.111:8080";

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

function fetchComments() {
  fetch(`${API_URL}/comments`)
    .then((response) => response.json())
    .then((comments) => {
      const commentsList = document.getElementById("comments-list");
      commentsList.innerHTML = "";
      comments.forEach((comment) => {
        const commentElement = document.createElement("div");
        commentElement.classList.add("comment");
        commentElement.innerHTML = `<b>[${comment.time}] ${comment.alias}</b>: ${comment.content}`;
        commentsList.appendChild(commentElement);
      });
    })
    .catch((error) => console.error("Error fetching comments:", error));
}

function submitComment(event) {
  event.preventDefault();
  const name = document.getElementById("commenter-name").value;
  const comment = document.getElementById("comment-text").value;

  fetch(`${API_URL}/comments?alias=${encodeURIComponent(name)}`, {
    method: "POST",
    body: comment,
  })
    .then((response) => {
      if (response.ok) {
        document.getElementById("comment-form").reset();
        fetchComments();
      } else {
        console.error("Failed to submit comment");
      }
    })
    .catch((error) => console.error("Error submitting comment:", error));
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
    if (
      e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA"){
        e.target.focus();
      }
    if (
      e.target.tagName === "BUTTON")
      {
        e.target.click();
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
