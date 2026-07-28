const RSS_JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json';
const ALL_ORIGINS_ENDPOINT = 'https://api.allorigins.win/raw';
const WORLD_RSS_FEED = 'https://feeds.bbci.co.uk/russian/rss.xml';
const MIN_HEADLINE_LENGTH = 35;
const ROUND_COUNT = 10;

const fakeActions = [
  'одобрил временный запрет на частные прогнозы погоды',
  'обсуждает правило о рукописных разрешениях для международных рейсов',
  'готовит требование отключать телефоны во время политических выступлений',
  'предлагает скрывать столицы на онлайн-картах во время кризисов',
  'изучает замену паспортов подтверждёнными профилями в соцсетях',
  'проверяет идею обязательного звукового сигнала для электромобилей на зарядке',
  'представил проект спутникового контроля цен в супермаркетах',
  'рассматривает статус официального документа для непрочитанных электронных писем',
  'сообщил о пилотной программе цифровых очередей для доступа к новостным сайтам',
  'планирует маркировать товары прогнозной ценой на неделю вперёд'
];

const fakeContexts = [
  'после серии закрытых консультаций',
  'на фоне новых международных переговоров',
  'после публикации предварительного доклада',
  'в рамках экспериментальной программы безопасности',
  'из-за опасений по поводу дезинформации',
  'после обращения группы регуляторов',
  'на фоне роста напряжённости в регионе',
  'в ответ на обновлённые рекомендации экспертов'
];

const fakeQualifiers = [
  'пишут местные СМИ',
  'сообщают источники, знакомые с обсуждением',
  'утверждают авторы документа',
  'говорится в проекте заявления',
  'следует из предварительных материалов',
  'заявил представитель инициативы'
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

function randomInt(max) {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function sample(items) {
  return items[randomInt(items.length)];
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
  return proper || 'Международные чиновники';
}

function buildRealStories(articles, count) {
  return shuffle(articles).slice(0, count).map((article) => ({
    headline: normalizeTitle(article.title),
    summary: 'Краткое сообщение из мировой повестки: в заголовке есть конкретные участники и событие, но деталей пока недостаточно для уверенного вывода.',
    category: 'Мировая повестка',
    date: article.pubDate ? article.pubDate.slice(0, 10) : todayKey(),
    answer: 'real',
    url: article.link,
    explanation: 'Это реальная новость из сегодняшней международной ленты BBC Russian. Хорошая проверка — найти тот же факт в нескольких независимых источниках.'
  }));
}

function buildFakeStories(realStories, count) {
  return shuffle(realStories).slice(0, count).map((story) => ({
    headline: `${actorFromTitle(story.headline)} ${sample(fakeActions)} — ${sample(fakeQualifiers)}, ${sample(fakeContexts)}`,
    summary: 'Краткое сообщение из мировой повестки: в заголовке есть конкретные участники и событие, но деталей пока недостаточно для уверенного вывода.',
    category: 'Мировая повестка',
    date: todayKey(),
    answer: 'fake',
    explanation: 'Это сгенерированный фейк: он заново собирается при запуске из участников текущей повестки и правдоподобных новостных формулировок, но само утверждение не подтверждается сегодняшней лентой.'
  }));
}

function articlesFromRssXml(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
  return [...documentXml.querySelectorAll('item')].map((item) => ({
    title: item.querySelector('title')?.textContent || '',
    pubDate: item.querySelector('pubDate')?.textContent || todayKey(),
    link: item.querySelector('link')?.textContent || ''
  }));
}

async function fetchFromRss2Json() {
  const params = new URLSearchParams({ rss_url: WORLD_RSS_FEED, _: String(Date.now()) });
  const response = await fetch(`${RSS_JSON_ENDPOINT}?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('rss2json не ответил');
  const data = await response.json();
  if (data.status !== 'ok') throw new Error('rss2json вернул ошибку');
  return data.items || [];
}

async function fetchFromAllOrigins() {
  const params = new URLSearchParams({ url: WORLD_RSS_FEED, _: String(Date.now()) });
  const response = await fetch(`${ALL_ORIGINS_ENDPOINT}?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('allOrigins не ответил');
  return articlesFromRssXml(await response.text());
}

async function loadRssArticles() {
  const loaders = [fetchFromRss2Json, fetchFromAllOrigins];
  for (const loader of loaders) {
    try {
      const articles = await loader();
      if (articles.length) return articles;
    } catch (error) {
      console.warn(error.message);
    }
  }
  throw new Error('Не удалось загрузить RSS через доступные источники');
}

async function fetchFreshNews() {
  const articles = await loadRssArticles();
  const unique = [];
  const seen = new Set();
  for (const article of articles) {
    const title = normalizeTitle(article.title || '');
    if (title.length < MIN_HEADLINE_LENGTH || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    unique.push({ ...article, title });
  }
  const realCount = Math.min(Math.floor(ROUND_COUNT / 2), unique.length);
  if (realCount < 4) throw new Error('Недостаточно новостей для игры');
  const real = buildRealStories(unique, realCount);
  const fake = buildFakeStories(unique, ROUND_COUNT - real.length);
  return shuffle([...real, ...fake]);
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
    stories = await fetchFreshNews();
    statusEl.textContent = `Новый набор создан при запуске: реальные заголовки взяты из RSS, фейки сгенерированы заново.`;
  } catch (error) {
    statusEl.textContent = `Не удалось загрузить свежую ленту: ${error.message}. Проверь интернет и обнови страницу.`;
    headlineEl.textContent = 'Новости не загрузились';
    summaryEl.textContent = 'Игра создаёт раунды только из актуальной RSS-ленты, поэтому без доступа к новостям запуск невозможен.';
    actionsEl.classList.add('hidden');
    return;
  }
  renderStory();
}

startGame();
