API_URL = "https://comments.matiasberrios.com";

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

async function getVisits() {
  await fetch(`${API_URL}/visit`);

  let visitorCount = await fetch(`${API_URL}/visitor-count`);
  visitorCount = await visitorCount.json();

  const visitorCountElement = document.getElementById("visitor-count");
  visitorCountElement.textContent = `visitor #${visitorCount.count}`;
}

getVisits();
