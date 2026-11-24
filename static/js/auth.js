/**
 * Панель пользователя — общая для всех страниц.
 * Спрашивает у сервера, кто вошёл (/api/me), и показывает
 * «Вы вошли как …  Выйти» или «Войти / Регистрация».
 */

let currentUser = null;     // имя вошедшего пользователя или null

// Промис — другие скрипты (saper.js) могут дождаться, пока станет известно, кто вошёл
const authReady = fetch('/api/me')
    .then(response => response.json())
    .then(data => {
        currentUser = data.username;
        renderUserBar();
        return currentUser;
    })
    .catch(() => {
        currentUser = null;
        renderUserBar();
        return null;
    });

function renderUserBar() {
    const bar = document.getElementById('userBar');
    if (!bar) return;

    bar.innerHTML = '';     // очищаем панель

    if (currentUser) {
        const who = document.createElement('span');
        who.textContent = '👤 ' + currentUser + ' ';
        const mark = document.createElement('span');
        mark.className = 'verified';
        mark.title = 'Подтверждённый пользователь';
        mark.textContent = '✔';
        who.appendChild(mark);

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'user-bar-btn';
        logoutBtn.textContent = 'Выйти';
        logoutBtn.onclick = logout;

        bar.append(who, logoutBtn);
    } else {
        const text = document.createElement('span');
        text.textContent = 'Вы не вошли — рекорды сохраняются как «Аноним»';

        // next — куда вернуться после входа (на текущую страницу)
        const next = encodeURIComponent(location.pathname);
        const link = document.createElement('a');
        link.className = 'user-bar-btn';
        link.href = '/login?next=' + next;
        link.textContent = 'Войти / Регистрация';

        bar.append(text, link);
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();      // перезагружаем страницу, чтобы всё обновилось
}

// Защита от XSS: превращает спецсимволы HTML в безопасные сущности
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
