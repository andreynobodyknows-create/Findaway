const stories = [
  {
    headline: 'Индия стала первой страной, посадившей аппарат около южного полюса Луны',
    summary: 'Миссия Chandrayaan-3 успешно доставила спускаемый аппарат Vikram на поверхность Луны в августе 2023 года.',
    category: 'Космос',
    date: '2023',
    answer: 'real',
    explanation: 'Это реальная новость: посадка Chandrayaan-3 стала историческим достижением индийской космической программы.'
  },
  {
    headline: 'ООН ввела единый мировой налог на личные сообщения в мессенджерах',
    summary: 'Вирусные посты утверждают, что пользователи теперь платят за каждое отправленное сообщение.',
    category: 'Технологии',
    date: '2025',
    answer: 'fake',
    explanation: 'Это фейк: у ООН нет механизма взимать такой налог напрямую с пользователей мессенджеров.'
  },
  {
    headline: 'В Японии впервые за 17 лет повысили ключевую процентную ставку',
    summary: 'Банк Японии завершил эпоху отрицательных ставок, изменив курс денежно-кредитной политики.',
    category: 'Экономика',
    date: '2024',
    answer: 'real',
    explanation: 'Это реальная новость: решение стало заметным поворотом для японской экономики.'
  },
  {
    headline: 'Учёные подтвердили, что зарядка телефона ночью стирает часть памяти владельца',
    summary: 'Публикации ссылаются на “исследование”, но не называют журнал, институт или авторов.',
    category: 'Наука',
    date: '2024',
    answer: 'fake',
    explanation: 'Это фейк: причинной связи между ночной зарядкой телефона и памятью человека не существует.'
  },
  {
    headline: 'Европейский союз окончательно одобрил комплексные правила регулирования искусственного интеллекта',
    summary: 'AI Act вводит риск-ориентированные требования к разработчикам и пользователям ИИ-систем.',
    category: 'Политика',
    date: '2024',
    answer: 'real',
    explanation: 'Это реальная новость: ЕС принял AI Act как крупный нормативный акт об искусственном интеллекте.'
  },
  {
    headline: 'Австралия перенесла столицу из Канберры в Сидней ради туристов',
    summary: 'Заголовок распространился без официальных документов и заявлений правительства.',
    category: 'Мир',
    date: '2025',
    answer: 'fake',
    explanation: 'Это фейк: столицей Австралии остаётся Канберра.'
  },
  {
    headline: 'Всемирная организация здравоохранения объявила конец чрезвычайной фазы COVID-19',
    summary: 'ВОЗ сняла статус чрезвычайной ситуации международного значения, сохранив рекомендации по наблюдению.',
    category: 'Здоровье',
    date: '2023',
    answer: 'real',
    explanation: 'Это реальная новость: статус PHEIC был завершён в мае 2023 года.'
  },
  {
    headline: 'NASA нашло на Марсе работающий светофор и опубликовало схему перекрёстка',
    summary: 'Картинка из соцсетей похожа на обработанную фотографию марсохода.',
    category: 'Космос',
    date: '2024',
    answer: 'fake',
    explanation: 'Это фейк: подобные изображения обычно являются монтажом или шуткой.'
  },
  {
    headline: 'Норвегия, Ирландия и Испания объявили о признании государства Палестина',
    summary: 'Три европейские страны синхронно сообщили о дипломатическом решении весной 2024 года.',
    category: 'Дипломатия',
    date: '2024',
    answer: 'real',
    explanation: 'Это реальная новость: решение стало заметным дипломатическим событием.'
  },
  {
    headline: 'Мировые авиакомпании договорились запретить пассажирам смотреть в иллюминатор при взлёте',
    summary: 'Посты утверждают, что правило связано с “секретными маршрутами”, но источников нет.',
    category: 'Путешествия',
    date: '2025',
    answer: 'fake',
    explanation: 'Это фейк: такого глобального авиационного правила не существует.'
  }
];

let current = 0;
let score = 0;
let streak = 0;
const order = [...stories].sort(() => Math.random() - 0.5);

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

function renderStory() {
  const story = order[current];
  roundEl.textContent = `${current + 1} / ${order.length}`;
  scoreEl.textContent = score;
  streakEl.textContent = streak;
  categoryEl.textContent = story.category;
  dateEl.textContent = story.date;
  headlineEl.textContent = story.headline;
  summaryEl.textContent = story.summary;
  feedbackEl.className = 'feedback hidden';
  feedbackEl.textContent = '';
  nextBtn.classList.add('hidden');
  actionsEl.querySelectorAll('button').forEach((button) => (button.disabled = false));
}

function finishGame() {
  headlineEl.textContent = 'Игра окончена!';
  summaryEl.textContent = `Твой результат: ${score} из ${order.length}. ${score >= 8 ? 'Отличный детектор фейков!' : 'Попробуй ещё раз и проверяй источники внимательнее.'}`;
  categoryEl.textContent = 'Финал';
  dateEl.textContent = 'результат';
  actionsEl.classList.add('hidden');
  nextBtn.textContent = 'Сыграть ещё раз';
  nextBtn.classList.remove('hidden');
}

function checkAnswer(answer) {
  const story = order[current];
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
  feedbackEl.textContent = `${correct ? 'Верно!' : 'Промах.'} ${story.explanation}`;
  actionsEl.querySelectorAll('button').forEach((button) => (button.disabled = true));
  nextBtn.textContent = current === order.length - 1 ? 'Показать результат' : 'Следующий раунд';
  nextBtn.classList.remove('hidden');
}

actionsEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-answer]');
  if (button) checkAnswer(button.dataset.answer);
});

nextBtn.addEventListener('click', () => {
  if (current === order.length - 1) {
    if (actionsEl.classList.contains('hidden')) window.location.reload();
    else finishGame();
    return;
  }
  current += 1;
  renderStory();
});

renderStory();
