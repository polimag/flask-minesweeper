/**
 * Игра "Сапёр" на JavaScript
 * Полная реализация с тремя уровнями сложности и таблицей рекордов
 */

// ============================================
// СОСТОЯНИЕ ИГРЫ
// ============================================

let board = [];                 // Игровое поле (значения клеток)
let boardState = [];            // Состояние (открыто/закрыто)
let flags = [];                 // Флаги
let gameActive = false;         // Активна ли игра
let gameOver = false;           // Проигрыш
let gameWin = false;            // Победа
let timer = 0;                  // Таймер
let timerInterval = null;       // Интервал таймера
let mineCount = 3;              // Количество мин
let rows = 5;                   // Количество строк
let cols = 6;                   // Количество столбцов
let difficulty = 'easy';        // Сложность
let firstMove = true;           // Первый ход
let flagsCount = 0;             // Сколько флагов поставлено
let openedCount = 0;            // Сколько безопасных клеток открыто

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    newGame();
    loadScores();
});

// ============================================
// УПРАВЛЕНИЕ СЛОЖНОСТЬЮ
// ============================================

function setDifficulty(level) {
    difficulty = level;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Настройки сложности
    switch(level) {
        case 'easy':
            rows = 5;
            cols = 6;
            mineCount = 3;
            break;
        case 'medium':
            rows = 8;
            cols = 8;
            mineCount = 10;
            break;
        case 'hard':
            rows = 10;
            cols = 10;
            mineCount = 20;
            break;
    }
    
    loadScores();
    newGame();
}

// ============================================
// НОВАЯ ИГРА
// ============================================

function newGame() {
    // Останавливаем таймер
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    timer = 0;
    gameActive = true;
    gameOver = false;
    gameWin = false;
    firstMove = true;
    flagsCount = 0;
    openedCount = 0;

    // Обновляем отображение
    document.getElementById('timer').textContent = timer;
    document.getElementById('mineCount').textContent = mineCount;
    document.getElementById('openedCount').textContent = 0;
    document.getElementById('flagCount').textContent = 0;
    
    // Создаем пустые массивы
    board = Array(rows).fill().map(() => Array(cols).fill(0));
    boardState = Array(rows).fill().map(() => Array(cols).fill(false));
    flags = Array(rows).fill().map(() => Array(cols).fill(false));
    
    // Отрисовываем пустое поле
    renderBoard();
}

// ============================================
// ГЕНЕРАЦИЯ МИН (ТОЛЬКО ПОСЛЕ ПЕРВОГО ХОДА)
// ============================================

function generateMines(firstRow, firstCol) {
    console.log('Генерация мин, первый ход:', firstRow, firstCol);
    
    // Очищаем поле
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            board[i][j] = 0;
        }
    }
    
    // Расставляем мины случайно, но не на первом ходе и не рядом с ним
    let minesPlaced = 0;
    const maxAttempts = 1000;
    let attempts = 0;
    
    while (minesPlaced < mineCount && attempts < maxAttempts) {
        let row = Math.floor(Math.random() * rows);
        let col = Math.floor(Math.random() * cols);
        
        // Проверяем, что это не первый ход и не соседняя клетка
        if (row === firstRow && col === firstCol) continue;
        
        // Проверяем, что это не соседняя клетка (для удобства)
        let isAdjacent = Math.abs(row - firstRow) <= 1 && Math.abs(col - firstCol) <= 1;
        if (isAdjacent) continue;
        
        if (board[row][col] !== 100) {
            board[row][col] = 100;
            minesPlaced++;
        }
        
        attempts++;
    }
    
    // Если не смогли расставить все мины, расставляем оставшиеся где угодно (кроме первого хода)
    while (minesPlaced < mineCount) {
        let row = Math.floor(Math.random() * rows);
        let col = Math.floor(Math.random() * cols);
        
        if (row === firstRow && col === firstCol) continue;
        
        if (board[row][col] !== 100) {
            board[row][col] = 100;
            minesPlaced++;
        }
    }
    
    // Подсчитываем числа: для каждой мины добавляем +1 её соседям
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (board[i][j] === 100) {
                // Обходим все 8 соседей мины
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        if (di === 0 && dj === 0) continue;
                        let ni = i + di;
                        let nj = j + dj;
                        // Сосед существует и сам не мина
                        if (ni >= 0 && ni < rows && nj >= 0 && nj < cols && board[ni][nj] !== 100) {
                            board[ni][nj]++;
                        }
                    }
                }
            }
        }
    }
    
    console.log('Мины расставлены:', board);
}

// ============================================
// ОТКРЫТИЕ КЛЕТКИ
// ============================================

function openCell(row, col) {
    // Проверки
    if (!gameActive || gameOver || gameWin) return;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (boardState[row][col]) return;
    if (flags[row][col]) return;
    
    // Если это первый ход, генерируем мины
    if (firstMove) {
        generateMines(row, col);
        firstMove = false;
        
        // Запускаем таймер
        timerInterval = setInterval(() => {
            timer++;
            document.getElementById('timer').textContent = timer;
        }, 1000);
    }
    
    // Открываем клетку
    boardState[row][col] = true;
    
    // Проверка на мину
    if (board[row][col] === 100) {
        gameOver = true;
        gameActive = false;
        clearInterval(timerInterval);
        timerInterval = null;
        
        // Показываем все мины
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (board[i][j] === 100) {
                    boardState[i][j] = true;
                }
            }
        }
        
        renderBoard();
        showMessage('💥 Вы проиграли!', 'error');
        return;
    }

    // Клетка безопасная — увеличиваем счётчик открытых
    openedCount++;

    // Если клетка пустая (0), рекурсивно открываем соседей
    if (board[row][col] === 0) {
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                if (di === 0 && dj === 0) continue;
                let ni = row + di;
                let nj = col + dj;
                if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
                    if (!boardState[ni][nj] && !flags[ni][nj]) {
                        openCell(ni, nj);
                    }
                }
            }
        }
    }
    
    renderBoard();
    checkWin();
}

// ============================================
// УСТАНОВКА/СНЯТИЕ ФЛАГА
// ============================================

function toggleFlag(row, col) {
    // Проверки
    if (!gameActive || gameOver || gameWin) return;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (boardState[row][col]) return;
    
    // Переключаем флаг и меняем счётчик
    flags[row][col] = !flags[row][col];
    if (flags[row][col]) {
        flagsCount++;      // флаг поставили
    } else {
        flagsCount--;      // флаг сняли
    }

    renderBoard();          // внутри обновятся и счётчики
}

// ============================================
// ОБНОВЛЕНИЕ СЧЕТЧИКОВ
// ============================================

// Счётчики хранятся в переменных flagsCount и openedCount,
// поэтому поле больше не нужно обходить заново — просто выводим числа

function updateFlagCount() {
    document.getElementById('flagCount').textContent = flagsCount;
    document.getElementById('mineCount').textContent = mineCount - flagsCount;
}

function updateOpenedCount() {
    document.getElementById('openedCount').textContent = openedCount;
}

// ============================================
// ПРОВЕРКА ПОБЕДЫ
// ============================================

function checkWin() {
    // Победа, если открыты все клетки без мин
    if (openedCount === rows * cols - mineCount) {
        gameWin = true;
        gameActive = false;
        clearInterval(timerInterval);
        timerInterval = null;
        
        // Показываем модальное окно победы
        document.getElementById('winTime').textContent = timer;

        // Под каким именем сохранится рекорд (currentUser берётся из auth.js)
        const saveAsText = document.getElementById('saveAsText');
        if (currentUser) {
            saveAsText.innerHTML = 'Рекорд будет сохранён как <b>' + escapeHtml(currentUser) +
                '</b> <span class="verified" title="Подтверждённый пользователь">✔</span>';
        } else {
            saveAsText.innerHTML = 'Вы не вошли в учётную запись — рекорд сохранится как <b>Аноним</b>.<br>' +
                '<a href="/login?next=/saper" style="color: #667eea;">Войти</a>';
        }

        document.getElementById('nameModal').classList.add('show');
        document.getElementById('overlay').classList.add('show');
    }
}

// ============================================
// ОТПРАВКА РЕКОРДА
// ============================================

async function submitScore() {
    // Имя НЕ отправляем: сервер сам возьмёт его из сессии
    // (вошёл — имя пользователя, не вошёл — «Аноним»)
    try {
        const response = await fetch('/api/saper/score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                difficulty: difficulty,
                time: timer
            })
        });
        
        if (response.ok) {
            // Закрываем модальное окно
            document.getElementById('nameModal').classList.remove('show');
            document.getElementById('overlay').classList.remove('show');
            
            // Показываем сообщение о победе (сервер вернул, под каким именем сохранил)
            const result = await response.json();
            showMessage('🎉 Рекорд сохранен как «' + result.name + '»!', 'success');
            
            // Обновляем таблицу рекордов
            loadScores();
        } else {
            const error = await response.json();
            showMessage('❌ Ошибка сохранения: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('❌ Ошибка соединения с сервером', 'error');
    }
}

// ============================================
// ЗАГРУЗКА РЕКОРДОВ
// ============================================

async function loadScores() {
    try {
        const response = await fetch(`/api/saper/scores/${difficulty}`);
        const scores = await response.json();
        
        const tbody = document.getElementById('scoresBody');
        
        if (scores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Пока нет рекордов</td></tr>';
        } else {
            let html = '';
            scores.forEach((score, index) => {
                // Галочка только у рекордов зарегистрированных пользователей
                const mark = score.verified
                    ? ' <span class="verified" title="Подтверждённый пользователь">✔</span>'
                    : '';
                // escapeHtml (из auth.js) защищает от XSS: HTML-код в имени не выполнится
                html += `<tr>
                    <td>${index + 1}. ${escapeHtml(score.name)}${mark}</td>
                    <td>${score.time} сек</td>
                    <td>${score.date || '—'}</td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }
    } catch (error) {
        console.error('Ошибка загрузки рекордов:', error);
        document.getElementById('scoresBody').innerHTML = 
            '<tr><td colspan="3" style="text-align: center; color: red;">Ошибка загрузки</td></tr>';
    }
}

// ============================================
// ПОКАЗ СООБЩЕНИЯ
// ============================================

function showMessage(text, type = 'info') {
    // Создаем временное сообщение
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 30px;
        background: ${type === 'error' ? '#f8d7da' : type === 'success' ? '#d4edda' : '#fff3cd'};
        color: ${type === 'error' ? '#721c24' : type === 'success' ? '#155724' : '#856404'};
        border: 1px solid ${type === 'error' ? '#f5c6cb' : type === 'success' ? '#c3e6cb' : '#ffeeba'};
        border-radius: 4px;
        z-index: 1000;
        animation: slideDown 0.3s ease;
    `;
    msg.textContent = text;
    document.body.appendChild(msg);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        msg.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => msg.remove(), 300);
    }, 3000);
}

// ============================================
// ОТРИСОВКА ПОЛЯ
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
            
            if (boardState[i][j]) {
                cellClass += ' open';
                
                if (board[i][j] === 100) {
                    cellClass += ' mine';
                    content = '💣';
                } else if (board[i][j] > 0) {
                    content = board[i][j];
                    dataNumber = `data-number="${board[i][j]}"`;
                }
            } else if (flags[i][j]) {
                cellClass += ' flag';
            }
            
            html += `<div class="${cellClass}" 
                           ${dataNumber}
                           onclick="openCell(${i}, ${j})"
                           oncontextmenu="event.preventDefault(); toggleFlag(${i}, ${j})">${content}</div>`;
        }
    }
    
    boardEl.innerHTML = html;
    
    // Обновляем счетчики
    updateOpenedCount();
    updateFlagCount();
}

// ============================================
// ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА ПО ESC
// ============================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('nameModal').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
    }
});

// Закрытие по клику на оверлей
document.getElementById('overlay').addEventListener('click', () => {
    document.getElementById('nameModal').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
});

// ============================================
// ДОБАВЛЯЕМ СТИЛИ ДЛЯ АНИМАЦИЙ
// ============================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);