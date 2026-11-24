import json
import os
import random
from flask import Flask, request, jsonify, render_template, session

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

app.secret_key = 'your-secret-key-here-change-in-production'

SCORES_FILE = os.path.join(os.path.dirname(__file__), 'data', 'scores.json')
os.makedirs(os.path.dirname(SCORES_FILE), exist_ok=True)

# ============================================
# КОНСТАНТЫ
# ============================================

CELL_MINE = 100

DIFFICULTIES = {
    'easy': {'rows': 5, 'cols': 6, 'mines': 3},
    'medium': {'rows': 8, 'cols': 8, 'mines': 10},
    'hard': {'rows': 10, 'cols': 10, 'mines': 20}
}

# ============================================
# РАБОТА С РЕКОРДАМИ
# ============================================

def load_scores():
    if os.path.exists(SCORES_FILE):
        try:
            with open(SCORES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {'easy': [], 'medium': [], 'hard': []}
    return {'easy': [], 'medium': [], 'hard': []}

def save_scores(scores):
    with open(SCORES_FILE, 'w', encoding='utf-8') as f:
        json.dump(scores, f, ensure_ascii=False, indent=2)

# ============================================
# ЛОГИКА ИГРЫ
# ============================================

def create_empty_state(rows, cols, mine_count, difficulty):
    """Создает пустое состояние игры"""
    return {
        'board': [[0 for _ in range(cols)] for _ in range(rows)],  # поле с минами
        'opened': [[False for _ in range(cols)] for _ in range(rows)],  # открытые клетки
        'flags': [[False for _ in range(cols)] for _ in range(rows)],   # флаги
        'game_active': True,
        'game_over': False,
        'game_won': False,
        'first_move': True,
        'rows': rows,
        'cols': cols,
        'mine_count': mine_count,
        'difficulty': difficulty
    }

def generate_mines(board, first_row, first_col, mine_count):
    """Расставляет мины"""
    rows = len(board)
    cols = len(board[0])
    
    # Очищаем поле
    for i in range(rows):
        for j in range(cols):
            board[i][j] = 0
    
    # Расставляем мины
    mines_placed = 0
    max_attempts = 1000
    attempts = 0
    
    while mines_placed < mine_count and attempts < max_attempts:
        row = random.randint(0, rows - 1)
        col = random.randint(0, cols - 1)
        
        # Не ставим мину на первый ход или рядом
        if (row == first_row and col == first_col) or \
           (abs(row - first_row) <= 1 and abs(col - first_col) <= 1):
            attempts += 1
            continue
        
        if board[row][col] != CELL_MINE:
            board[row][col] = CELL_MINE
            mines_placed += 1
        
        attempts += 1
    
    # Если не хватило попыток
    while mines_placed < mine_count:
        row = random.randint(0, rows - 1)
        col = random.randint(0, cols - 1)
        
        if row == first_row and col == first_col:
            continue
        
        if board[row][col] != CELL_MINE:
            board[row][col] = CELL_MINE
            mines_placed += 1
    
    # Подсчитываем числа
    for i in range(rows):
        for j in range(cols):
            if board[i][j] != CELL_MINE:
                count = 0
                for di in [-1, 0, 1]:
                    for dj in [-1, 0, 1]:
                        if di == 0 and dj == 0:
                            continue
                        ni, nj = i + di, j + dj
                        if 0 <= ni < rows and 0 <= nj < cols:
                            if board[ni][nj] == CELL_MINE:
                                count += 1
                board[i][j] = count

def get_cell_display_value(game_state, row, col):
    """
    Возвращает значение для отображения на клиенте:
    - Для открытых клеток: число (1-8) или 0 для пустой
    - Для закрытых: None
    - Для мин: '💣' (только когда игра проиграна)
    """
    if not game_state['opened'][row][col]:
        return None  # закрытая клетка
    
    if game_state['board'][row][col] == CELL_MINE:
        return '💣'  # мина
    elif game_state['board'][row][col] > 0:
        return game_state['board'][row][col]  # число
    else:
        return ''  # пустая клетка

def open_cell(game_state, row, col):
    """
    Открывает клетку и возвращает обновленное состояние
    """
    # Проверки
    if not game_state['game_active'] or game_state['game_over'] or game_state['game_won']:
        return game_state, {'error': 'Игра неактивна'}
    
    if row < 0 or row >= game_state['rows'] or col < 0 or col >= game_state['cols']:
        return game_state, {'error': 'Координаты вне поля'}
    
    if game_state['opened'][row][col]:
        return game_state, {'error': 'Клетка уже открыта'}
    
    if game_state['flags'][row][col]:
        return game_state, {'error': 'Нельзя открыть клетку с флагом'}
    
    # Первый ход - генерируем мины
    if game_state['first_move']:
        generate_mines(
            game_state['board'], 
            row, col, 
            game_state['mine_count']
        )
        game_state['first_move'] = False
    
    # Открываем клетку
    game_state['opened'][row][col] = True
    
    # Проверка на мину
    if game_state['board'][row][col] == CELL_MINE:
        game_state['game_over'] = True
        game_state['game_active'] = False
        
        # Открываем все мины
        for i in range(game_state['rows']):
            for j in range(game_state['cols']):
                if game_state['board'][i][j] == CELL_MINE:
                    game_state['opened'][i][j] = True
        
        return game_state, {'status': 'game_over', 'message': '💥 Вы проиграли!'}
    
    # Если клетка пустая (0), рекурсивно открываем соседей
    if game_state['board'][row][col] == 0:
        for di in [-1, 0, 1]:
            for dj in [-1, 0, 1]:
                if di == 0 and dj == 0:
                    continue
                ni, nj = row + di, col + dj
                if 0 <= ni < game_state['rows'] and 0 <= nj < game_state['cols']:
                    if not game_state['opened'][ni][nj] and not game_state['flags'][ni][nj]:
                        game_state, _ = open_cell(game_state, ni, nj)
    
    # Проверка победы
    opened_count = 0
    total_cells = game_state['rows'] * game_state['cols']
    for i in range(game_state['rows']):
        for j in range(game_state['cols']):
            if game_state['opened'][i][j]:
                opened_count += 1
    
    if opened_count == total_cells - game_state['mine_count']:
        game_state['game_won'] = True
        game_state['game_active'] = False
        return game_state, {'status': 'won', 'message': '🎉 Победа!'}
    
    return game_state, {'status': 'ok'}

def toggle_flag(game_state, row, col):
    """Устанавливает или снимает флаг"""
    if not game_state['game_active'] or game_state['game_over'] or game_state['game_won']:
        return game_state, {'error': 'Игра неактивна'}
    
    if row < 0 or row >= game_state['rows'] or col < 0 or col >= game_state['cols']:
        return game_state, {'error': 'Координаты вне поля'}
    
    if game_state['opened'][row][col]:
        return game_state, {'error': 'Нельзя поставить флаг на открытую клетку'}
    
    game_state['flags'][row][col] = not game_state['flags'][row][col]
    return game_state, {'status': 'ok'}

# ============================================
# МАРШРУТЫ ДЛЯ СТРАНИЦ
# ============================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/saper')
def saper_game():
    return render_template('saper.html')

# ============================================
# API ДЛЯ ИГРЫ
# ============================================

@app.route('/api/saper/new', methods=['POST'])
def new_game():
    """Создает новую игру"""
    data = request.get_json()
    difficulty = data.get('difficulty', 'easy')
    
    if difficulty not in DIFFICULTIES:
        return jsonify({'error': 'Неверная сложность'}), 400
    
    config = DIFFICULTIES[difficulty]
    game_state = create_empty_state(
        config['rows'], 
        config['cols'],
        config['mines'],
        difficulty
    )
    
    session['game_state'] = game_state
    
    #Отправляем только размеры поля!
    return jsonify({
        'rows': game_state['rows'],
        'cols': game_state['cols'],
        'mine_count': game_state['mine_count']
    })

@app.route('/api/saper/open', methods=['POST'])
def open_cell_api():
    """Открывает клетку и возвращает результат"""
    game_state = session.get('game_state')
    if not game_state:
        return jsonify({'error': 'Нет активной игры'}), 404
    
    data = request.get_json()
    row = data.get('row')
    col = data.get('col')
    
    if row is None or col is None:
        return jsonify({'error': 'Не указаны координаты'}), 400
    
    new_state, result = open_cell(game_state, row, col)
    session['game_state'] = new_state
    
    # Формируем ответ для клиента
    # Клиент должен знать ТОЛЬКО:
    # - какие клетки открыты (opened)
    # - какие значения в открытых клетках (для отображения)
    opened_values = []
    for i in range(new_state['rows']):
        row_values = []
        for j in range(new_state['cols']):
            if new_state['opened'][i][j]:
                if new_state['board'][i][j] == CELL_MINE:
                    row_values.append('💣')
                elif new_state['board'][i][j] > 0:
                    row_values.append(new_state['board'][i][j])
                else:
                    row_values.append('')
            else:
                row_values.append(None)  # закрытая клетка
        opened_values.append(row_values)
    
    response = {
        'opened': new_state['opened'],           # булева матрица
        'opened_values': opened_values,          # значения для отображения
        'flags': new_state['flags'],
        'game_active': new_state['game_active'],
        'game_over': new_state['game_over'],
        'game_won': new_state['game_won']
    }
    
    if 'message' in result:
        response['message'] = result['message']
    
    return jsonify(response)

@app.route('/api/saper/flag', methods=['POST'])
def flag_cell_api():
    """Устанавливает/снимает флаг"""
    game_state = session.get('game_state')
    if not game_state:
        return jsonify({'error': 'Нет активной игры'}), 404
    
    data = request.get_json()
    row = data.get('row')
    col = data.get('col')
    
    if row is None or col is None:
        return jsonify({'error': 'Не указаны координаты'}), 400
    
    new_state, _ = toggle_flag(game_state, row, col)
    session['game_state'] = new_state
    
    return jsonify({
        'flags': new_state['flags']
    })

'''@app.route('/api/saper/state', methods=['GET'])
def get_game_state():
    """Возвращает текущее состояние (для синхронизации)"""
    game_state = session.get('game_state')
    if not game_state:
        return jsonify({'error': 'Нет активной игры'}), 404
    
    # Формируем opened_values как в open_cell_api
    opened_values = []
    for i in range(game_state['rows']):
        row_values = []
        for j in range(game_state['cols']):
            if game_state['opened'][i][j]:
                if game_state['board'][i][j] == CELL_MINE:
                    row_values.append('💣')
                elif game_state['board'][i][j] > 0:
                    row_values.append(game_state['board'][i][j])
                else:
                    row_values.append('')
            else:
                row_values.append(None)
        opened_values.append(row_values)
    
    return jsonify({
        'opened': game_state['opened'],
        'opened_values': opened_values,
        'flags': game_state['flags'],
        'game_active': game_state['game_active'],
        'game_over': game_state['game_over'],
        'game_won': game_state['game_won'],
        'rows': game_state['rows'],
        'cols': game_state['cols'],
        'mine_count': game_state['mine_count']
    })'''

# ============================================
# API ДЛЯ РЕКОРДОВ
# ============================================

@app.route('/api/saper/score', methods=['POST'])
def save_saper_score():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Нет данных'}), 400
    
    difficulty = data.get('difficulty', 'easy')
    name = data.get('name', 'Аноним').strip()
    time = data.get('time', 0)
    
    if difficulty not in ['easy', 'medium', 'hard']:
        return jsonify({'error': 'Неверная сложность'}), 400
    
    if not isinstance(time, (int, float)) or time <= 0:
        return jsonify({'error': 'Неверное время'}), 400
    
    scores = load_scores()
    
    scores[difficulty].append({
        'name': name[:20],
        'time': time,
        'date': __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')
    })
    
    scores[difficulty].sort(key=lambda x: x['time'])
    scores[difficulty] = scores[difficulty][:10]
    save_scores(scores)
    
    return jsonify({'status': 'ok', 'scores': scores[difficulty]})

@app.route('/api/saper/scores/<difficulty>')
def get_saper_scores(difficulty):
    if difficulty not in ['easy', 'medium', 'hard']:
        return jsonify({'error': 'Неверная сложность'}), 400
    
    scores = load_scores()
    return jsonify(scores.get(difficulty, []))

@app.route('/api/greet', methods=['POST'])
def greet():
    try:
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({'error': 'Имя не предоставлено'}), 400
        
        user_name = data['name'].strip()
        
        if not user_name:
            return jsonify({'error': 'Имя не может быть пустым'}), 400
        
        # Серверная логика
        greeting_message = f"Привет, {user_name}! Это ответ от сервера на Python. Сервер работает отлично!"
        
        return jsonify({
            'message': greeting_message,
            'time': __import__('datetime').datetime.now().strftime('%H:%M:%S')
        })
        
    except Exception as e:
        return jsonify({'error': f'Ошибка сервера: {str(e)}'}), 500

# ============================================
# ОБРАБОТЧИКИ ОШИБОК

@app.errorhandler(404)
def not_found(error):
    """Страница 404"""
    return jsonify({'error': 'Страница не найдена'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Страница 500"""
    return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

# ============================================
# ЗАПУСК
# ============================================

if __name__ == '__main__':
    print("=" * 50)
    print("🎮 Сапёр (минное поле на сервере!)")
    print("=" * 50)
    print("🌐 http://127.0.0.1:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)
