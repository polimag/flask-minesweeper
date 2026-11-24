import json
import os
import re
import secrets
from datetime import datetime

from flask import Flask, request, jsonify, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash

# Создаем экземпляр приложения
app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# Путь к файлу с рекордами
SCORES_FILE = os.path.join(DATA_DIR, 'scores.json')
# Путь к файлу с пользователями
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
# Путь к файлу с секретным ключом
SECRET_FILE = os.path.join(DATA_DIR, 'secret.key')

#==================================================================
'''Секретный ключ для подписи сессий.
Создаётся один раз и хранится в файле, чтобы после перезапуска
сервера пользователи оставались в своей учётной записи.'''
if not os.path.exists(SECRET_FILE):
    with open(SECRET_FILE, 'w') as f:
        f.write(secrets.token_hex(32))
with open(SECRET_FILE) as f:
    app.secret_key = f.read().strip()

#==================================================================
'''загрузка и сохранение рекордов в json файл'''
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

#==================================================================
'''загрузка и сохранение пользователей в json файл'''
def load_users():
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def current_user():
    '''Имя вошедшего пользователя или None'''
    username = session.get('username')
    if username and username in load_users():
        return username
    return None

# Логин: 3–20 символов, буквы (в т.ч. русские), цифры и _
USERNAME_RE = re.compile(r'^[A-Za-zА-Яа-яЁё0-9_]{3,20}$')

#==================================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/saper')
def saper_game():
    return render_template('saper.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

# ============================================
# РЕГИСТРАЦИЯ И АВТОРИЗАЦИЯ

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', ''))

    if not USERNAME_RE.match(username):
        return jsonify({'error': 'Логин: от 3 до 20 символов, только буквы, цифры и _'}), 400
    if username.lower() == 'аноним':
        return jsonify({'error': 'Это имя зарезервировано'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Пароль должен быть не короче 6 символов'}), 400

    users = load_users()
    # Сравниваем без учёта регистра, чтобы не было «Polina» и «polina»
    if any(name.lower() == username.lower() for name in users):
        return jsonify({'error': 'Такой логин уже занят'}), 409

    users[username] = {
        'password_hash': generate_password_hash(password),
        'created': datetime.now().strftime('%Y-%m-%d %H:%M')
    }
    save_users(users)

    session['username'] = username      # сразу входим после регистрации
    return jsonify({'status': 'ok', 'username': username})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', ''))

    users = load_users()
    user = users.get(username)
    # Одно сообщение для обоих случаев, чтобы нельзя было подобрать существующие логины
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    session['username'] = username
    return jsonify({'status': 'ok', 'username': username})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify({'status': 'ok'})

@app.route('/api/me')
def me():
    '''Кто сейчас вошёл: {"username": "..."} или {"username": null}'''
    return jsonify({'username': current_user()})

# ============================================

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
            'time': datetime.now().strftime('%H:%M:%S')
        })

    except Exception as e:
        return jsonify({'error': f'Ошибка сервера: {str(e)}'}), 500

# ============================================

@app.route('/api/saper/score', methods=['POST'])
def save_saper_score():
    """
    Сохраняет рекорд игры Сапёр
    JSON: {
        "difficulty": "easy/medium/hard",
        "time": 123 (время в секундах)
    }
    Имя берётся НЕ из запроса, а из сессии:
    вошёл в учётную запись — имя пользователя и отметка verified,
    не вошёл — «Аноним».
    """
    try:
        data = request.get_json()

        # Валидация данных
        if not data:
            return jsonify({'error': 'Нет данных'}), 400

        difficulty = data.get('difficulty', 'easy')
        time = data.get('time', 0)

        if difficulty not in ['easy', 'medium', 'hard']:
            return jsonify({'error': 'Неверная сложность'}), 400

        if not isinstance(time, (int, float)) or time < 0:
            return jsonify({'error': 'Неверное время'}), 400

        username = current_user()
        if username:
            name, verified = username, True
        else:
            name, verified = 'Аноним', False

        scores = load_scores()

        # Добавляем новый рекорд
        scores[difficulty].append({
            'name': name,
            'verified': verified,
            'time': time,
            'date': datetime.now().strftime('%Y-%m-%d %H:%M')
        })

        # Сортируем по времени
        scores[difficulty].sort(key=lambda x: x['time'])

        # Оставляем только топ-10
        scores[difficulty] = scores[difficulty][:10]

        # Сохраняем
        save_scores(scores)

        return jsonify({
            'status': 'ok',
            'message': 'Рекорд сохранен',
            'name': name,
            'verified': verified,
            'scores': scores[difficulty]
        })

    except Exception as e:
        return jsonify({'error': f'Ошибка сервера: {str(e)}'}), 500

@app.route('/api/saper/scores/<difficulty>')
def get_saper_scores(difficulty):
    """
    Возвращает рекорды для указанной сложности
    """
    if difficulty not in ['easy', 'medium', 'hard']:
        return jsonify({'error': 'Неверная сложность'}), 400

    scores = load_scores()
    return jsonify(scores.get(difficulty, []))

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
# ЗАПУСК СЕРВЕРА

if __name__ == '__main__':

    app.run(host='0.0.0.0', port=5000, debug=True)
