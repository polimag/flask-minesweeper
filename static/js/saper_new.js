// ============================================
// СОСТОЯНИЕ
// ============================================

let currentDifficulty = 'easy';
let timer = 0;
let timerInterval = null;
let gameActive = false;

// Данные от сервера
let rows = 5;
let cols = 6;
let mineCount = 3;

// Состояние игры (получаем с сервера)
let openedValues = [];      // значения для отображения в открытых клетках
let currentFlags = [];      // флаги
let opened = [];           // какие клетки открыты (булевы)

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Клиент Сапёр загружен');
    loadScores();
    newGame();
});

// ============================================
// ТАЙМЕР
// ============================================

function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        timer++;
        document.getElementById('timer').textContent = timer;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    stopTimer();
    timer = 0;
    document.getElementById('timer').textContent = timer;
}

// ============================================
// РАБОТА С СЕРВЕРОМ
// ============================================

async function newGame() {
    resetTimer();
    
    try {
        const response = await fetch('/api/saper/new', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({difficulty: currentDifficulty})
        });
        
        if (!response.ok) throw new Error('Ошибка создания игры');
        
        const gameState = await response.json();
        
        // Получаем только размеры поля
        rows = gameState.rows;
        cols = gameState.cols;
        mineCount = gameState.mine_count;
        
        // Инициализируем пустые массивы
        openedValues = Array(rows).fill().map(() => Array(cols).fill(null));
        opened = Array(rows).fill().map(() => Array(cols).fill(false));
        currentFlags = Array(rows).fill().map(() => Array(cols).fill(false));
        
        gameActive = true;
        
        renderBoard();
        updateCounters();
        
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('❌ Ошибка соединения с сервером', 'error');
    }
}

async function openCell(row, col) {
    if (!gameActive) return;
    
    try {
        const response = await fetch('/api/saper/open', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ row, col })
        });
        
        if (!response.ok) throw new Error('Ошибка открытия клетки');
        
        const gameState = await response.json();
        
        // Обновляем состояние из ответа сервера
        openedValues = gameState.opened_values;
        opened = gameState.opened;
        currentFlags = gameState.flags;
        gameActive = gameState.game_active;
        
        renderBoard();
        updateCounters();
        
        // Показываем сообщение
        if (gameState.message) {
            showMessage(gameState.message, 
                gameState.message.includes('Победа') ? 'success' : 'error');
            
            if (gameState.message.includes('Победа')) {
                stopTimer();
                document.getElementById('winTime').textContent = timer;
                document.getElementById('nameModal').classList.add('show');
                document.getElementById('overlay').classList.add('show');
            } else if (gameState.message.includes('проиграли')) {
                stopTimer();
            }
        }
        
        // Запускаем таймер при первом ходе
        if (!timerInterval && gameActive) {
            startTimer();
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('❌ Ошибка соединения с сервером', 'error');
    }
}

async function toggleFlag(row, col) {
    if (!gameActive) return;
    
    try {
        const response = await fetch('/api/saper/flag', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ row, col })
        });
        
        if (!response.ok) throw new Error('Ошибка установки флага');
        
        const gameState = await response.json();
        currentFlags = gameState.flags;
        
        renderBoard();
        updateCounters();
        
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('❌ Ошибка соединения с сервером', 'error');
    }
}

// ============================================
// ОТРИСОВКА
// ============================================

function renderBoard() {
    const boardEl = document.getElementById('gameBoard');
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 40px)`;
    
    let html = '';
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            let cellClass = 'cell';
            let content = '';
            let dataNumber = '';
            
            if (openedValues[i][j] !== null) {
                cellClass += ' open';
                
                if (openedValues[i][j] === '💣') {
                    cellClass += ' mine';
                    content = '💣';
                } else if (typeof openedValues[i][j] === 'number') {
                    content = openedValues[i][j];
                    dataNumber = `data-number="${openedValues[i][j]}"`;
                }
                // если пустая клетка (''), то просто открытая без содержимого
            } else if (currentFlags[i][j]) {
                cellClass += ' flag';
            }
            
            html += `<div class="${cellClass}" 
                           ${dataNumber}
                           onclick="openCell(${i}, ${j})"
                           oncontextmenu="event.preventDefault(); toggleFlag(${i}, ${j})">${content}</div>`;
        }
    }
    
    boardEl.innerHTML = html;
}

function updateCounters() {
    // Считаем открытые клетки
    let openedCount = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (opened[i][j]) openedCount++;
        }
    }
    document.getElementById('openedCount').textContent = openedCount;
    
    // Считаем флаги
    let flagsCount = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (currentFlags[i][j]) flagsCount++;
        }
    }
    document.getElementById('flagCount').textContent = flagsCount;
    document.getElementById('mineCount').textContent = mineCount - flagsCount;
}

// ============================================
// УПРАВЛЕНИЕ СЛОЖНОСТЬЮ
// ============================================

function setDifficulty(level) {
    currentDifficulty = level;
    
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadScores();
    newGame();
}

// ============================================
// РАБОТА С РЕКОРДАМИ
// ============================================

async function submitScore() {
    const name = document.getElementById('winnerName').value.trim() || 'Аноним';
    
    try {
        const response = await fetch('/api/saper/score', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                difficulty: currentDifficulty,
                name: name,
                time: timer
            })
        });
        
        if (response.ok) {
            document.getElementById('nameModal').classList.remove('show');
            document.getElementById('overlay').classList.remove('show');
            showMessage('🎉 Рекорд сохранен!', 'success');
            loadScores();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function loadScores() {
    try {
        const response = await fetch(`/api/saper/scores/${currentDifficulty}`);
        const scores = await response.json();
        
        const tbody = document.getElementById('scoresBody');
        
        if (scores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">Пока нет рекордов</td></tr>';
        } else {
            let html = '';
            scores.forEach((score, index) => {
                html += `<tr>
                    <td>${index + 1}. ${score.name}</td>
                    <td>${score.time} сек</td>
                    <td>${score.date || '—'}</td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }
    } catch (error) {
        console.error('Ошибка загрузки рекордов:', error);
    }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================

function showMessage(text, type = 'info') {
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed; top: 20px; left: 50%;
        transform: translateX(-50%);
        padding: 15px 30px;
        background: ${type === 'error' ? '#f8d7da' : type === 'success' ? '#d4edda' : '#fff3cd'};
        color: ${type === 'error' ? '#721c24' : type === 'success' ? '#155724' : '#856404'};
        border-radius: 4px; z-index: 1000;
        animation: slideDown 0.3s ease;
    `;
    msg.textContent = text;
    document.body.appendChild(msg);
    
    setTimeout(() => {
        msg.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => msg.remove(), 300);
    }, 3000);
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('nameModal').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
    }
});

document.getElementById('overlay').addEventListener('click', () => {
    document.getElementById('nameModal').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
});