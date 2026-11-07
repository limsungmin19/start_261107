'use strict';

(() => {
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  const COLORS = {
    I: '#55dce8',
    O: '#f5cb68',
    T: '#b294ff',
    S: '#68db9d',
    Z: '#ff7189',
    J: '#719bff',
    L: '#ff9d67'
  };
  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  };

  const boardCanvas = document.querySelector('#game-board');
  const boardContext = boardCanvas.getContext('2d');
  const nextCanvas = document.querySelector('#next-piece');
  const nextContext = nextCanvas.getContext('2d');
  const scoreElement = document.querySelector('#score');
  const levelElement = document.querySelector('#level');
  const linesElement = document.querySelector('#lines');
  const bestElement = document.querySelector('#best-score');
  const overlay = document.querySelector('#overlay');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayMessage = document.querySelector('#overlay-message');
  const overlayButton = document.querySelector('#overlay-button');
  const pauseButton = document.querySelector('#pause-button');
  const statusElement = document.querySelector('#game-status');

  let board;
  let current;
  let next;
  let score = 0;
  let lines = 0;
  let level = 1;
  let best = Number(localStorage.getItem('neonBlocksBest') || 0);
  let running = false;
  let paused = false;
  let gameOver = false;
  let lastDrop = 0;
  let animationId = 0;

  function makePiece(type) {
    return {
      type,
      shape: SHAPES[type].map(row => [...row]),
      x: Math.floor((COLS - SHAPES[type][0].length) / 2),
      y: 0
    };
  }

  function randomPiece() {
    const types = Object.keys(SHAPES);
    return makePiece(types[Math.floor(Math.random() * types.length)]);
  }

  function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0;
    lines = 0;
    level = 1;
    current = randomPiece();
    next = randomPiece();
    gameOver = false;
    paused = false;
    running = true;
    lastDrop = 0;
    updateStats();
    overlay.classList.add('hidden');
    pauseButton.disabled = false;
    pauseButton.innerHTML = 'Ⅱ <span>일시정지</span>';
    statusElement.textContent = 'GAME IN PROGRESS';
    cancelAnimationFrame(animationId);
    draw();
    animationId = requestAnimationFrame(loop);
  }

  function updateStats() {
    if (score > best) {
      best = score;
      localStorage.setItem('neonBlocksBest', String(best));
    }
    scoreElement.textContent = String(score).padStart(6, '0');
    levelElement.textContent = String(level).padStart(2, '0');
    linesElement.textContent = String(lines).padStart(2, '0');
    bestElement.textContent = String(best).padStart(6, '0');
  }

  function collides(piece, offsetX = 0, offsetY = 0, shape = piece.shape) {
    return shape.some((row, y) => row.some((cell, x) => {
      if (!cell) return false;
      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;
      return boardX < 0 || boardX >= COLS || boardY >= ROWS ||
        (boardY >= 0 && board[boardY][boardX] !== null);
    }));
  }

  function mergePiece() {
    current.shape.forEach((row, y) => row.forEach((cell, x) => {
      if (cell && current.y + y >= 0) {
        board[current.y + y][current.x + x] = current.type;
      }
    }));
    clearLines();
    spawnPiece();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared += 1;
        y += 1;
      }
    }
    if (cleared) {
      const points = [0, 100, 300, 500, 800];
      score += points[cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      updateStats();
    }
  }

  function spawnPiece() {
    current = next;
    current.x = Math.floor((COLS - current.shape[0].length) / 2);
    current.y = 0;
    next = randomPiece();
    if (collides(current)) endGame();
  }

  function rotate(matrix) {
    return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
  }

  function rotatePiece() {
    const rotated = rotate(current.shape);
    for (const shift of [0, -1, 1, -2, 2]) {
      if (!collides(current, shift, 0, rotated)) {
        current.x += shift;
        current.shape = rotated;
        draw();
        return;
      }
    }
  }

  function move(dx, dy) {
    if (!collides(current, dx, dy)) {
      current.x += dx;
      current.y += dy;
      return true;
    }
    if (dy > 0) mergePiece();
    return false;
  }

  function hardDrop() {
    while (!collides(current, 0, 1)) {
      current.y += 1;
      score += 2;
    }
    mergePiece();
    updateStats();
    draw();
  }

  function drawCell(context, x, y, color, size, alpha = 1) {
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,.19)';
    context.fillRect(x * size + 3, y * size + 3, size - 6, 2);
    context.globalAlpha = 1;
  }

  function draw() {
    boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardContext.fillStyle = '#111522';
    boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardContext.strokeStyle = 'rgba(150,160,195,.075)';
    boardContext.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      boardContext.beginPath();
      boardContext.moveTo(x * BLOCK + .5, 0);
      boardContext.lineTo(x * BLOCK + .5, boardCanvas.height);
      boardContext.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      boardContext.beginPath();
      boardContext.moveTo(0, y * BLOCK + .5);
      boardContext.lineTo(boardCanvas.width, y * BLOCK + .5);
      boardContext.stroke();
    }
    board.forEach((row, y) => row.forEach((type, x) => {
      if (type) drawCell(boardContext, x, y, COLORS[type], BLOCK);
    }));
    if (current) {
      let ghostY = current.y;
      while (!collides({ ...current, y: ghostY }, 0, 1)) ghostY += 1;
      current.shape.forEach((row, y) => row.forEach((cell, x) => {
        if (cell && ghostY + y >= 0) drawCell(boardContext, current.x + x, ghostY + y, COLORS[current.type], BLOCK, .2);
      }));
      current.shape.forEach((row, y) => row.forEach((cell, x) => {
        if (cell && current.y + y >= 0) drawCell(boardContext, current.x + x, current.y + y, COLORS[current.type], BLOCK);
      }));
    }
    drawNext();
  }

  function drawNext() {
    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!next) return;
    const size = 22;
    const width = next.shape[0].length * size;
    const height = next.shape.length * size;
    const offsetX = (nextCanvas.width - width) / 2;
    const offsetY = (nextCanvas.height - height) / 2;
    next.shape.forEach((row, y) => row.forEach((cell, x) => {
      if (!cell) return;
      nextContext.fillStyle = COLORS[next.type];
      nextContext.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
      nextContext.fillStyle = 'rgba(255,255,255,.19)';
      nextContext.fillRect(offsetX + x * size + 3, offsetY + y * size + 3, size - 6, 2);
    }));
  }

  function loop(timestamp = 0) {
    if (!running || paused) return;
    const interval = Math.max(90, 800 - (level - 1) * 65);
    if (timestamp - lastDrop > interval) {
      move(0, 1);
      lastDrop = timestamp;
    }
    draw();
    animationId = requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    gameOver = true;
    pauseButton.disabled = true;
    statusElement.textContent = 'GAME OVER';
    overlayTitle.textContent = '게임 오버';
    overlayMessage.textContent = `최종 점수 ${String(score).padStart(6, '0')}점`;
    overlayButton.textContent = '다시 플레이';
    overlay.classList.remove('hidden');
    updateStats();
  }

  function togglePause() {
    if (!running && !paused) return;
    paused = !paused;
    if (paused) {
      cancelAnimationFrame(animationId);
      overlayTitle.textContent = '잠시 멈춤';
      overlayMessage.textContent = '준비되면 게임을 계속하세요.';
      overlayButton.textContent = '계속하기';
      overlay.classList.remove('hidden');
      pauseButton.innerHTML = '▶ <span>계속하기</span>';
      statusElement.textContent = 'PAUSED';
    } else {
      overlay.classList.add('hidden');
      pauseButton.innerHTML = 'Ⅱ <span>일시정지</span>';
      statusElement.textContent = 'GAME IN PROGRESS';
      lastDrop = 0;
      animationId = requestAnimationFrame(loop);
    }
  }

  document.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '];
    if (keys.includes(event.key)) event.preventDefault();
    if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
      togglePause();
      return;
    }
    if (!running || paused) return;
    if (event.key === 'ArrowLeft') move(-1, 0);
    else if (event.key === 'ArrowRight') move(1, 0);
    else if (event.key === 'ArrowDown') {
      if (move(0, 1)) score += 1;
      updateStats();
    } else if (event.key === 'ArrowUp') rotatePiece();
    else if (event.key === ' ') hardDrop();
    draw();
  });

  document.querySelectorAll('.touch-controls button').forEach(button => {
    button.addEventListener('click', () => {
      if (!running || paused) return;
      const actions = {
        left: () => move(-1, 0),
        right: () => move(1, 0),
        down: () => { if (move(0, 1)) score += 1; updateStats(); },
        rotate: rotatePiece,
        drop: hardDrop
      };
      actions[button.dataset.action]();
      draw();
    });
  });

  overlayButton.addEventListener('click', () => {
    if (paused) togglePause();
    else resetGame();
  });
  pauseButton.addEventListener('click', togglePause);
  document.querySelector('#restart-button').addEventListener('click', resetGame);

  bestElement.textContent = String(best).padStart(6, '0');
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  next = randomPiece();
  draw();
})();
