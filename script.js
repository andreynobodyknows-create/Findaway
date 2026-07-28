const NEWS_ENDPOINT = 'https://api.rss2json.com/v1/api.json';
const WORLD_RSS_FEED = 'https://feeds.bbci.co.uk/russian/rss.xml';
const APP_VERSION = 'neutral-cards-v2';
const DAILY_CACHE_PREFIX = `findaway-daily-news-${APP_VERSION}`;
const FALLBACK_HEADLINES = [
  'Лидеры G7 обсуждают новые санкции и меры энергетической безопасности на саммите',
  'Европейские регуляторы начали проверку практик крупной технологической платформы',
  'Учёные сообщили о рекордном нагреве океанов в обновлённых климатических данных',
  'Представители центробанка призвали к осторожности после новых данных об инфляции',
  'Международные гуманитарные организации предупреждают об ухудшении продовольственной ситуации в зонах конфликтов',
  'Космическое агентство подтвердило успешный запуск нового спутника наблюдения Земли',
  'Крупные судоходные компании меняют маршруты после новых предупреждений о безопасности',
  'Органы здравоохранения расширили кампанию вакцинации после региональной вспышки',
  'Агентства ООН запросили срочное финансирование после сильных наводнений',
  'Исследователи опубликовали новые данные о батарейных хранилищах для возобновляемой энергетики'
];

const fakeTemplates = [
  (story) => `${story.actor} тайно одобрил глобальный запрет на частные прогнозы погоды`,
  (story) => `${story.actor} заявил, что все международные рейсы потребуют рукописное разрешение`,
  (story) => `${story.actor} подтвердил новое правило: телефоны будут отключаться во время политических выступлений`,
  (story) => `${story.actor} объявил, что онлайн-карты временно скроют столицы из соображений безопасности`,
  (story) => `${story.actor} поддержал план заменить паспорта профилями в соцсетях`,
  (story) => `${story.actor} сообщил, что электромобили должны проигрывать гимн страны во время зарядки`,
  (story) => `${story.actor} представил экстренный проект по изменению русла крупной реки со спутников`,
  (story) => `${story.actor} утверждает, что супермаркеты начнут маркировать товары будущей прогнозной ценой`,
  (story) => `${story.actor} предложил считать непрочитанные письма официальными документами с истекающим сроком`,
  (story) => `${story.actor} заявил, что астронавты нашли на Луне работающий дорожный знак`
];

let stories = [];
let current = 0;
let score = 0;
let streak = 0;

const roundEl = document.querySelector('#round');
const scoreEl = document.querySelector('#score');
const streakEl = document.querySelector('#streak');
const categoryEl = document.querySelector('#category');
const dateEl = document.querySelector('#date');
const headlineEl = document.querySelector('#headline');
const summaryEl = document.querySelector('#summary');
const feedbackEl = document.querySelector('#feedback');
const nextBtn = document.querySelector('#next');
const actionsEl = document.querySelector('#actions');
const statusEl = document.querySelector('#status');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clearOutdatedCaches() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('findaway-daily-news') && !key.startsWith(DAILY_CACHE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeTitle(title) {
  return title.replace(/\s+/g, ' ').replace(/\s+-\s+[^-]{2,40}$/u, '').trim();
}

function actorFromTitle(title) {
  const words = normalizeTitle(title)
    .replace(/[“”"'.,:;!?()]/g, '')
    .split(' ')
    .filter((word) => word.length > 2);
  const proper = words.find((word) => /^[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё-]+$/.test(word));
  return proper || 'International officials';
}

function buildRealStories(articles) {
  return articles.slice(0, 6).map((article) => ({
    headline: normalizeTitle(article.title),
    summary: 'Краткое сообщение из мировой повестки: в заголовке есть конкретные участники и событие, но деталей пока недостаточно для уверенного вывода.',
    category: 'Мировая повестка',
    date: article.pubDate ? article.pubDate.slice(0, 10) : todayKey(),
    answer: 'real',
    url: article.link,
    explanation: 'Это реальная новость из сегодняшней международной ленты BBC Russian. Хорошая проверка — найти тот же факт в нескольких независимых источниках.'
  }));
}

function buildFakeStories(realStories) {
  return realStories.slice(0, 6).map((story, index) => ({
    headline: fakeTemplates[index % fakeTemplates.length]({ actor: actorFromTitle(story.headline) }),
    summary: 'Краткое сообщение из мировой повестки: в заголовке есть конкретные участники и событие, но деталей пока недостаточно для уверенного вывода.',
    category: 'Мировая повестка',
    date: todayKey(),
    answer: 'fake',
    explanation: 'Это сгенерированный фейк: он использует реальные новостные обороты и участников повестки, но само утверждение не подтверждается сегодняшней лентой.'
  }));
}

function fallbackStories() {
  const real = buildRealStories(FALLBACK_HEADLINES.map((title, index) => ({
    title,
    author: 'offline-set',
    pubDate: todayKey(),
    link: ''
  })));
  return shuffle([...real, ...buildFakeStories(real)]).slice(0, 10);
}

async function fetchDailyNews() {
  clearOutdatedCaches();
  const cacheKey = `${DAILY_CACHE_PREFIX}-${todayKey()}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const params = new URLSearchParams({ rss_url: WORLD_RSS_FEED });
  const response = await fetch(`${NEWS_ENDPOINT}?${params.toString()}`);
  if (!response.ok) throw new Error('Не удалось загрузить актуальные новости');
  const data = await response.json();
  if (data.status !== 'ok') throw new Error('Новостная RSS-лента временно недоступна');
  const unique = [];
  const seen = new Set();
  for (const article of data.items || []) {
    const title = normalizeTitle(article.title || '');
    if (title.length < 35 || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    unique.push({ ...article, title });
  }
  const real = buildRealStories(unique);
  const dailyStories = shuffle([...real, ...buildFakeStories(real)]).slice(0, 10);
  if (dailyStories.length < 8) throw new Error('Недостаточно новостей для игры');
  localStorage.setItem(cacheKey, JSON.stringify(dailyStories));
  return dailyStories;
}

function setLoading(message) {
  headlineEl.textContent = message;
  summaryEl.textContent = 'Игра берёт свежие заголовки из открытой мировой новостной ленты и смешивает их с правдоподобными фейками.';
  actionsEl.querySelectorAll('button').forEach((button) => (button.disabled = true));
}

function renderStory() {
  const story = stories[current];
  roundEl.textContent = `${current + 1} / ${stories.length}`;
  scoreEl.textContent = score;
  streakEl.textContent = streak;
  categoryEl.textContent = story.category;
  dateEl.textContent = story.date;
  headlineEl.textContent = story.headline;
  summaryEl.textContent = story.summary;
  feedbackEl.className = 'feedback hidden';
  feedbackEl.innerHTML = '';
  nextBtn.classList.add('hidden');
  actionsEl.classList.remove('hidden');
  actionsEl.querySelectorAll('button').forEach((button) => (button.disabled = false));
}

function finishGame() {
  headlineEl.textContent = 'Игра окончена!';
  summaryEl.textContent = `Твой результат: ${score} из ${stories.length}. ${score >= 8 ? 'Отличный детектор фейков!' : 'Попробуй ещё раз и проверяй источники внимательнее.'}`;
  categoryEl.textContent = 'Финал';
  dateEl.textContent = 'результат';
  actionsEl.classList.add('hidden');
  nextBtn.textContent = 'Сыграть ещё раз';
  nextBtn.classList.remove('hidden');
}

function checkAnswer(answer) {
  const story = stories[current];
  const correct = answer === story.answer;
  if (correct) {
    score += 1;
    streak += 1;
  } else {
    streak = 0;
  }
  scoreEl.textContent = score;
  streakEl.textContent = streak;
  feedbackEl.className = `feedback ${correct ? 'correct' : 'wrong'}`;
  feedbackEl.innerHTML = `<strong>${correct ? 'Верно!' : 'Промах.'}</strong> ${story.explanation}`;
  actionsEl.querySelectorAll('button').forEach((button) => (button.disabled = true));
  nextBtn.textContent = current === stories.length - 1 ? 'Показать результат' : 'Следующий раунд';
  nextBtn.classList.remove('hidden');
}

actionsEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-answer]');
  if (button) checkAnswer(button.dataset.answer);
});

nextBtn.addEventListener('click', () => {
  if (current === stories.length - 1) {
    if (actionsEl.classList.contains('hidden')) window.location.reload();
    else finishGame();
    return;
  }
  current += 1;
  renderStory();
});

async function startGame() {
  setLoading('Загружаем сегодняшнюю мировую повестку…');
  try {
    stories = await fetchDailyNews();
    statusEl.textContent = `Обновлено сегодня: ${todayKey()}. Карточки обновлены: описания и категории до ответа больше не раскрывают тип новости.`;
  } catch (error) {
    stories = fallbackStories();
    statusEl.textContent = 'Онлайн-лента недоступна, поэтому запущен резервный набор. Проверь подключение и обнови страницу.';
  }
  renderStory();
}

startGame();
