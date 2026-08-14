(function initializeFindawayCore(root) {
  "use strict";

  const DEFAULT_SUMMARY =
    "Заголовок показан без подсказок о его происхождении. Оцените формулировку, а после ответа проверьте источник и контекст.";

  const FAKE_SUBJECTS = [
    "Международный исследовательский совет",
    "Координационный центр крупных городов",
    "Экспертный комитет транспортных операторов",
    "Оргкомитет технологического форума",
    "Аналитический консорциум университетов",
    "Международный совет по цифровой устойчивости",
    "Экспертный центр городской инфраструктуры",
  ];

  const FAKE_ACTIONS = [
    "предложил временно скрывать прогнозы погоды в дни крупных мероприятий",
    "обсуждает рукописные разрешения для отдельных международных рейсов",
    "готовит правило об отключении телефонов во время публичных выступлений",
    "предложил скрывать столицы на онлайн-картах во время учений",
    "изучает замену пропусков подтверждёнными профилями в социальных сетях",
    "проверяет обязательный звуковой сигнал для электромобилей на зарядке",
    "представил проект спутникового контроля цен в супермаркетах",
    "рассматривает статус официального документа для непрочитанных писем",
    "тестирует цифровые очереди для доступа к новостным сайтам",
    "планирует маркировать товары прогнозной ценой на неделю вперёд",
  ];

  const FAKE_CONTEXTS = [
    "после серии закрытых консультаций",
    "на фоне международных переговоров",
    "после публикации предварительного доклада",
    "в рамках экспериментальной программы безопасности",
    "из-за опасений по поводу дезинформации",
    "после обращения группы регуляторов",
    "на время пилотного проекта",
    "в ответ на рекомендации приглашённых экспертов",
  ];

  const FAKE_LEADS = [
    "В предварительной концепции указано",
    "По данным авторов пилотной программы",
    "Как следует из проекта заявления",
    "Организаторы эксперимента сообщили",
    "В рабочем документе говорится",
    "Участники консультаций утверждают",
  ];

  const FAKE_TAILS = [
    "детали обещают раскрыть после пилота",
    "результаты планируют оценить до конца года",
    "проект пока не имеет окончательного статуса",
    "инициативу представили как ограниченный эксперимент",
    "сроки запуска ещё обсуждаются",
    "решение объяснили вопросами безопасности",
  ];

  function todayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function randomInt(max) {
    if (!Number.isInteger(max) || max < 1) {
      throw new RangeError("max должен быть положительным целым числом");
    }

    if (root.crypto?.getRandomValues) {
      const range = 0x100000000;
      const limit = Math.floor(range / max) * max;
      const buffer = new Uint32Array(1);
      do {
        root.crypto.getRandomValues(buffer);
      } while (buffer[0] >= limit);
      return buffer[0] % max;
    }

    return Math.floor(Math.random() * max);
  }

  function shuffle(items, randomIntFn = randomInt) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIntFn(index + 1);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function normalizeTitle(value) {
    return String(value ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+[—–-]\s+(?:BBC(?: News)?|Би-би-си)(?: Русская служба)?$/iu, "")
      .trim();
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value ?? ""));
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function toIsoDate(value, fallbackDate = new Date()) {
    const raw = String(value ?? "").trim();
    const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/u)?.[1];

    if (isoPrefix) {
      const parsedPrefix = new Date(`${isoPrefix}T00:00:00Z`);
      if (!Number.isNaN(parsedPrefix.getTime())) return isoPrefix;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? todayKey(fallbackDate)
      : parsed.toISOString().slice(0, 10);
  }

  function formatDisplayDate(isoDate, locale = "ru-RU") {
    const parsed = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  }

  function normalizeArticles(articles, minHeadlineLength = 35) {
    const unique = [];
    const seen = new Set();

    for (const article of Array.isArray(articles) ? articles : []) {
      const title = normalizeTitle(article?.title);
      const key = title.toLocaleLowerCase("ru-RU");
      if (title.length < minHeadlineLength || seen.has(key)) continue;
      seen.add(key);
      unique.push({
        title,
        pubDate: article?.pubDate ?? "",
        link: safeHttpUrl(article?.link),
        sourceName: normalizeTitle(article?.sourceName) || "BBC News Русская служба",
        isDemo: Boolean(article?.isDemo),
      });
    }

    return unique;
  }

  function buildRealStories(articles, now = new Date()) {
    return articles.map((article) => ({
      headline: article.title,
      summary: DEFAULT_SUMMARY,
      category: article.isDemo ? "Демонстрационный набор" : "Новостная повестка",
      date: toIsoDate(article.pubDate, now),
      answer: "real",
      url: article.link,
      sourceName: article.sourceName,
      explanation: article.isDemo
        ? "Это проверочный заголовок из встроенного демонстрационного набора. Он используется, когда свежая лента временно недоступна."
        : "Этот заголовок получен из ленты BBC News Русская служба. Наличие в ленте подтверждает происхождение заголовка, но важные факты всё равно стоит сверять по нескольким независимым источникам.",
    }));
  }

  function lowerFirst(value) {
    return value.charAt(0).toLocaleLowerCase("ru-RU") + value.slice(1);
  }

  function capitalizeFirst(value) {
    return value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);
  }

  function buildFakeCandidates() {
    const candidates = [];

    FAKE_SUBJECTS.forEach((subject, subjectIndex) => {
      FAKE_ACTIONS.forEach((action, actionIndex) => {
        FAKE_CONTEXTS.forEach((context, contextIndex) => {
          const lead = FAKE_LEADS[(subjectIndex + actionIndex + contextIndex) % FAKE_LEADS.length];
          const tail = FAKE_TAILS[(subjectIndex * 2 + actionIndex + contextIndex) % FAKE_TAILS.length];
          const template = (subjectIndex + actionIndex * 2 + contextIndex) % 4;

          if (template === 0) candidates.push(`${subject} ${action} ${context}`);
          if (template === 1) candidates.push(`${lead}: ${lowerFirst(subject)} ${action} ${context}`);
          if (template === 2) candidates.push(`${subject} ${action} ${context}, ${tail}`);
          if (template === 3) {
            candidates.push(`${capitalizeFirst(context)} ${lowerFirst(subject)} ${action}; ${tail}`);
          }
        });
      });
    });

    return candidates;
  }

  function buildFakeStories(count, { now = new Date(), randomIntFn = randomInt } = {}) {
    const candidates = shuffle(buildFakeCandidates(), randomIntFn);
    if (!Number.isInteger(count) || count < 1 || count > candidates.length) {
      throw new RangeError("Невозможно сформировать запрошенное число фейковых заголовков");
    }

    return candidates.slice(0, count).map((headline) => ({
      headline,
      summary: DEFAULT_SUMMARY,
      category: "Новостная повестка",
      date: todayKey(now),
      answer: "fake",
      url: "",
      sourceName: "",
      explanation:
        "Этот заголовок создан внутри игры из вымышленных деталей и не был взят из новостной ленты. Похожие события всё равно следует проверять отдельно.",
    }));
  }

  function createRoundSet(
    articles,
    {
      roundCount = 10,
      minHeadlineLength = 35,
      now = new Date(),
      randomIntFn = randomInt,
    } = {},
  ) {
    if (!Number.isInteger(roundCount) || roundCount < 2) {
      throw new RangeError("Количество раундов должно быть не меньше двух");
    }

    const normalized = normalizeArticles(articles, minHeadlineLength);
    const realCount = Math.floor(roundCount / 2);
    const fakeCount = roundCount - realCount;

    if (normalized.length < realCount) {
      throw new Error(`Для игры нужно минимум ${realCount} подходящих заголовков`);
    }

    const selectedReal = shuffle(normalized, randomIntFn).slice(0, realCount);
    const realStories = buildRealStories(selectedReal, now);
    const fakeStories = buildFakeStories(fakeCount, { now, randomIntFn });
    return shuffle([...realStories, ...fakeStories], randomIntFn);
  }

  root.FindawayCore = Object.freeze({
    DEFAULT_SUMMARY,
    buildFakeStories,
    createRoundSet,
    formatDisplayDate,
    normalizeArticles,
    normalizeTitle,
    safeHttpUrl,
    shuffle,
    toIsoDate,
    todayKey,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
