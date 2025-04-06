document.addEventListener("DOMContentLoaded", () => {
  const cellSize = 10;

  if (window.innerWidth <= 768) { 
    console.log("Palette functionality disabled on smaller screens.");
    return; 
  }

  const paletteWindow = document.getElementById("palette-window");
  if (!paletteWindow) {
    console.error("Palette window element not found!");
    return;
  }
  const paletteTitleBar = paletteWindow.querySelector(".title-bar");
  const colorSwatches = paletteWindow.querySelectorAll(".color-swatch");
  let isDraggingPalette = false;
  let paletteOffsetX, paletteOffsetY;

  let selectedColor = null;
  let isPaintingMode = false;
  let paintingGrid = null;

  const movePaletteWindow = (e) => {
    if (!isDraggingPalette) return;
    const currentX = e.pageX || e.touches[0].pageX;
    const currentY = e.pageY || e.touches[0].pageY;
    paletteWindow.style.left = `${currentX - paletteOffsetX}px`;
    paletteWindow.style.top = `${currentY - paletteOffsetY}px`;
    paletteWindow.style.transform = "none";
  };

  const startPaletteDrag = (e) => {
    isDraggingPalette = true;
    const startX = e.pageX || e.touches[0].pageX;
    const startY = e.pageY || e.touches[0].pageY;
    const rect = paletteWindow.getBoundingClientRect();
    paletteOffsetX = startX - rect.left;
    paletteOffsetY = startY - rect.top;
    document.addEventListener("mousemove", movePaletteWindow);
    document.addEventListener("touchmove", movePaletteWindow);
    document.addEventListener("mouseup", endPaletteDrag);
    document.addEventListener("touchend", endPaletteDrag);
    paletteWindow.classList.add("is-dragging");
  };

  const endPaletteDrag = () => {
    if (!isDraggingPalette) return;
    isDraggingPalette = false;
    document.removeEventListener("mousemove", movePaletteWindow);
    document.removeEventListener("touchmove", movePaletteWindow);
    document.removeEventListener("mouseup", endPaletteDrag);
    document.removeEventListener("touchend", endPaletteDrag);
    paletteWindow.classList.remove("is-dragging");
  };

  function createPaintingGrid() {
    if (paintingGrid) return;

    paintingGrid = document.createElement("div");
    paintingGrid.id = "painting-grid";
    paintingGrid.style.position = "fixed";
    paintingGrid.style.top = "0";
    paintingGrid.style.left = "0";
    paintingGrid.style.width = "100vw";
    paintingGrid.style.height = "100vh";
    paintingGrid.style.zIndex = "5"; 
    paintingGrid.style.display = "grid";
    paintingGrid.style.cursor = "crosshair";

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const cols = Math.floor(screenWidth / cellSize);
    const rows = Math.floor(screenHeight / cellSize);

    paintingGrid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    paintingGrid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

    for (let i = 0; i < rows * cols; i++) {
      const cell = document.createElement("div");
      cell.classList.add("grid-cell");
      cell.style.width = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;
      cell.style.border = "1px solid rgba(0, 0, 0, 0.1)";
      cell.style.backgroundColor = "transparent"; 
      cell.addEventListener("click", () => {
        if (isPaintingMode && selectedColor) {
          cell.style.backgroundColor = selectedColor;
        }
      });
      cell.addEventListener("mouseover", (e) => {
        if (e.buttons === 1 && isPaintingMode && selectedColor && !isDraggingPalette) {
          cell.style.backgroundColor = selectedColor;
        }
      });
      paintingGrid.appendChild(cell);
    }

    document.body.insertBefore(paintingGrid, document.body.firstChild);
    paintingGrid.addEventListener("dragstart", (e) => e.preventDefault());
  }

  function exitPaintingMode() {
    selectedColor = null;
    isPaintingMode = false;
    if (paintingGrid) {
      paintingGrid.style.cursor = "default"; 
    }
  }

  if (paletteTitleBar) {
    paletteTitleBar.addEventListener("mousedown", startPaletteDrag);
    paletteTitleBar.addEventListener("touchstart", startPaletteDrag);
  } else {
    console.error("Title bar for palette window not found!");
  }

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;

      const previouslySelected = paletteWindow.querySelector('.color-swatch.selected-swatch');
      if (previouslySelected) {
        previouslySelected.classList.remove('selected-swatch');
      }

      if (selectedColor === color) {
        exitPaintingMode(); 
      } else {
        selectedColor = color;
        isPaintingMode = true;
        swatch.classList.add('selected-swatch'); 
        if (paintingGrid) {
          paintingGrid.style.cursor = 'crosshair';
        }
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isPaintingMode) {
      const currentlySelected = paletteWindow.querySelector('.color-swatch.selected-swatch');
      if (currentlySelected) {
        currentlySelected.classList.remove('selected-swatch');
      }
      exitPaintingMode();
    }
  });

  createPaintingGrid();
});
