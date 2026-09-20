(function initializeFindawayCore(root) {
  "use strict";

  const DEFAULT_SUMMARY =
    "Заголовок показан без подсказок о его происхождении. Оцените формулировку, а после ответа проверьте источник и контекст.";

  // Each family keeps compatible grammar and a distinct subject matter.
  const FAKE_FAMILIES = [
    ["transport", ["В Казани", "В Самаре", "В Перми", "В Омске"], ["начнут продавать единый билет на электрички и автобусы", "продлят работу трамваев по выходным", "запустят ночные автобусы до аэропорта"]],
    ["museum", ["Музеи Екатеринбурга", "Музеи Новосибирска", "Музеи Нижнего Новгорода"], ["введут общий билет на постоянные выставки", "продлят часы работы по пятницам", "откроют бесплатный доступ к цифровым архивам"]],
    ["rail", ["На Урале", "В Поволжье", "В Сибири"], ["добавят остановки пригородным поездам в выходные", "начнут тестировать электронную очередь в железнодорожных кассах", "увеличат число пригородных поездов в утренние часы"]],
    ["library", ["В Туле", "В Вологде", "В Томске"], ["объединят городские библиотеки единым читательским билетом", "откроют читальные залы на железнодорожных вокзалах", "запустят доставку библиотечных книг в отдалённые районы"]],
    ["education", ["Университеты Томска", "Университеты Казани", "Университеты Самары"], ["откроют совместные курсы для преподавателей инженерных дисциплин", "начнут принимать заявки на совместные студенческие лаборатории", "договорились об обмене оборудованием для учебных практикумов"]],
    ["airport", ["В аэропорту Казани", "В аэропорту Самары", "В аэропорту Перми"], ["откроют дополнительную зону досмотра для семей с детьми", "начнут тестировать самостоятельную сдачу багажа", "изменят схему подъезда к пассажирскому терминалу"]],
    ["delivery", ["Региональные службы доставки", "Крупные интернет-магазины", "Операторы пунктов выдачи"], ["начнут тестировать многоразовую упаковку для заказов", "согласовали единый порядок возврата повреждённых посылок", "расширят сеть пунктов выдачи в малых городах"]],
    ["energy", ["В Калужской области", "В Тульской области", "В Ярославской области"], ["школы переведут на автоматическую передачу показаний электросчётчиков", "установят накопители энергии на пригородных станциях", "оборудуют муниципальные здания датчиками теплопотерь"]],
    ["parks", ["В Красноярске", "В Ижевске", "В Барнауле"], ["откроют новый маршрут вдоль городской набережной", "начнут восстанавливать исторические садовые павильоны", "обновят систему навигации в городских парках"]],
    ["industry", ["Производители сельхозтехники", "Производители дорожной техники", "Производители складского оборудования"], ["расширят сеть центров восстановления запчастей", "договорились о совместной подготовке сервисных инженеров", "начнут публиковать каталоги совместимых комплектующих"]],
    ["tourism", ["В Карелии", "В Алтайском крае", "В Псковской области"], ["разработают единый билет для посещения природных парков", "откроют новые стоянки для автомобильных туристов", "запустят систему бронирования мест на экологических тропах"]],
    ["sport", ["В Пензе", "В Кирове", "В Кургане"], ["откроют школьные стадионы для вечерних тренировок жителей", "введут единый абонемент в муниципальные бассейны", "запустят бесплатные занятия по спортивному ориентированию"]],
    ["archive", ["В Великом Новгороде", "В Костроме", "В Смоленске"], ["оцифруют коллекцию дореволюционных городских карт", "создадут открытый каталог исторических фотографий", "опубликуют архив старых транспортных схем"]],
    ["science", ["Российские материаловеды", "Исследователи из Томска", "Учёные из Новосибирска"], ["представили покрытие для защиты дорожных датчиков от обледенения", "испытали способ переработки отходов стекловолокна", "разработали датчик влажности для музейных хранилищ"]],
    ["agriculture", ["В Тамбовской области", "В Липецкой области", "В Орловской области"], ["откроют лабораторию проверки семян для небольших хозяйств", "создадут сеть метеостанций для сельхозпредприятий", "запустят совместную аренду оборудования для фермеров"]],
    ["cinema", ["Кинотеатры Перми", "Кинотеатры Тюмени", "Кинотеатры Омска"], ["запустят регулярные показы архивных документальных фильмов", "введут утренние сеансы с субтитрами", "договорились о совместном фестивале короткометражного кино"]],
    ["housing", ["В Рязани", "В Брянске", "В Иванове"], ["запустят запись на вывоз крупногабаритных отходов через городской портал", "начнут публиковать графики ремонта дворов на интерактивной карте", "откроют дополнительные пункты приёма старой бытовой техники"]],
    ["telecom", ["Операторы связи на Урале", "Операторы связи в Сибири", "Операторы связи в Поволжье"], ["расширят покрытие вдоль пригородных железнодорожных линий", "начнут совместно использовать опоры вдоль региональных трасс", "подключат дополнительные резервные линии к районным центрам"]],
    ["work", ["Предприятия Череповца", "Предприятия Тольятти", "Предприятия Магнитогорска"], ["откроют совместный центр обучения промышленной робототехнике", "запустят оплачиваемые стажировки для преподавателей колледжей", "согласовали программу подготовки мастеров производственного обучения"]],
    ["water", ["В Оренбурге", "В Саратове", "В Астрахани"], ["установят автоматические станции контроля уровня воды", "обновят оборудование для поиска утечек в водопроводных сетях", "начнут публиковать результаты измерений качества речной воды"]],
  ];

  const REVERSALS = [
    ["вырос", "снизился"], ["выросла", "снизилась"], ["выросли", "снизились"],
    ["увеличился", "сократился"], ["увеличилась", "сократилась"],
    ["увеличились", "сократились"], ["подорожал", "подешевел"],
    ["подорожала", "подешевела"], ["подорожали", "подешевели"],
    ["одобрил", "отклонил"], ["одобрила", "отклонила"],
    ["одобрили", "отклонили"], ["разрешил", "запретил"],
    ["разрешила", "запретила"], ["разрешили", "запретили"],
  ];

  function headlineKey(value) {
    return normalizeTitle(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  }

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
        sourceName: normalizeTitle(article?.sourceName) || "Новостная лента",
        isDemo: Boolean(article?.isDemo),
      });
    }

    return unique;
  }

  function selectBalancedArticles(articles, count, randomIntFn = randomInt) {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError("Количество заголовков должно быть положительным целым числом");
    }
    if (!Array.isArray(articles) || articles.length < count) {
      throw new Error(`Для выборки нужно минимум ${count} заголовков`);
    }

    const groups = new Map();
    articles.forEach((article) => {
      const sourceName = normalizeTitle(article?.sourceName) || "Новостная лента";
      if (!groups.has(sourceName)) groups.set(sourceName, []);
      groups.get(sourceName).push(article);
    });

    const queues = shuffle(
      [...groups.values()].map((group) => shuffle(group, randomIntFn)),
      randomIntFn,
    );
    const selected = [];

    while (selected.length < count) {
      let added = false;
      for (const queue of queues) {
        const article = queue.shift();
        if (!article) continue;
        selected.push(article);
        added = true;
        if (selected.length === count) break;
      }
      if (!added) break;
    }

    return selected;
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
        : `Этот заголовок получен из ленты «${article.sourceName}». Наличие в ленте подтверждает происхождение заголовка, но важные факты всё равно стоит сверять по нескольким независимым источникам.`,
    }));
  }

  function buildFakeCandidates(articles, now) {
    const candidates = [];
    for (const article of articles) {
      const original = article.title;
      const base = {
        scenarioKey: "article:" + headlineKey(original),
        originalHeadline: original,
        url: article.link,
        sourceName: article.sourceName,
        date: toIsoDate(article.pubDate, now),
        category: article.isDemo ? "Демонстрационный набор" : "Новостная повестка",
      };
      // Replace whole words only; leave quoted speech and negation untouched.
      if (/[«»“”"]/u.test(original) || /(?:^|\s)не\s/iu.test(original)) continue;
      for (const pair of REVERSALS) {
        for (const [from, to] of [pair, [...pair].reverse()]) {
          const pattern = new RegExp("(?<![а-яё])" + from + "(?![а-яё])", "iu");
          const match = original.match(pattern);
          if (!match) continue;
          const replacement = match[0][0] === match[0][0].toUpperCase()
            ? to[0].toUpperCase() + to.slice(1) : to;
          candidates.push({ ...base, headline: original.replace(pattern, replacement),
            change: "Подменено направление или решение: «" + match[0] + "» → «" + replacement + "»." });
        }
      }
      const percent = /(?<![\d.,−-])(\d{1,2}(?:[.,]\d)?)\s*%/gu;
      for (const match of original.matchAll(percent)) {
        const oldValue = Number(match[1].replace(",", "."));
        if (!(oldValue > 0 && oldValue < 95)) continue;
        for (const factor of [0.7, 1.3, 1.6]) {
          const value = Math.round(oldValue * factor * 10) / 10;
          if (value <= 0 || value >= 100 || value === oldValue) continue;
          const replacement = String(value).replace(".", ",") + "%";
          candidates.push({ ...base,
            headline: original.slice(0, match.index) + replacement + original.slice(match.index + match[0].length),
            change: "Подменено число: «" + match[0] + "» → «" + replacement + "»." });
        }
      }
    }
    return candidates;
  }

  function buildFakeStories(count, {
    now = new Date(), randomIntFn = randomInt, excludedHeadlines = [],
    recentScenarioKeys = [], articles = [], referenceArticles = articles,
  } = {}) {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError("Невозможно сформировать запрошенное число фейковых заголовков");
    }
    const excluded = new Set(Array.from(excludedHeadlines, headlineKey));
    const realTitles = new Set(referenceArticles.map(article => headlineKey(article.title)));
    const recent = new Set(recentScenarioKeys);
    const altered = shuffle(buildFakeCandidates(articles, now), randomIntFn);
    const fallback = shuffle(FAKE_FAMILIES.flatMap(([id, subjects, actions]) =>
      subjects.flatMap(subject => actions.map(action => ({
        headline: subject + " " + action, scenarioKey: "scenario:" + id,
      })))), randomIntFn);
    // Prefer fresh source-based edits, then fresh families, then older families.
    const candidates = [
      ...altered.filter(item => !recent.has(item.scenarioKey)),
      ...fallback.filter(item => !recent.has(item.scenarioKey)),
      ...altered.filter(item => recent.has(item.scenarioKey)),
      ...fallback.filter(item => recent.has(item.scenarioKey)),
    ];
    const selected = [];
    const families = new Set();
    const seen = new Set(realTitles);
    for (const candidate of candidates) {
      const key = headlineKey(candidate.headline);
      if (excluded.has(key) || seen.has(key) || families.has(candidate.scenarioKey)) continue;
      selected.push(candidate);
      seen.add(key);
      families.add(candidate.scenarioKey);
      if (selected.length === count) break;
    }
    if (selected.length < count) {
      throw new RangeError("Недостаточно новых заголовков для этого выпуска");
    }
    return selected.map(candidate => {
      const reference = referenceArticles.length
        ? referenceArticles[randomIntFn(referenceArticles.length)] : null;
      return {
        ...candidate,
        summary: DEFAULT_SUMMARY,
        category: candidate.category || (reference?.isDemo ? "Демонстрационный набор" : "Новостная повестка"),
        date: candidate.date || toIsoDate(reference?.pubDate, now),
        answer: "fake",
        url: candidate.url || "",
        sourceName: candidate.sourceName || "",
        explanation: candidate.originalHeadline
          ? "Это изменённый игрой заголовок. " + candidate.change + " Оригинал: «" + candidate.originalHeadline + "». Это учебная подмена, а не отдельная публикация источника."
          : "Этот заголовок собран игрой из совместимых деталей учебного сценария. Он не взят из ленты; совпадение с реальным событием возможно и требует отдельной проверки.",
      };
    });
  }

  function createRoundSet(
    articles,
    {
      roundCount = 10,
      minHeadlineLength = 35,
      now = new Date(),
      randomIntFn = randomInt,
      excludedFakeHeadlines = [],
      recentScenarioKeys = [],
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

    const selectedReal = selectBalancedArticles(normalized, realCount, randomIntFn);
    const realStories = buildRealStories(selectedReal, now);
    const fakeStories = buildFakeStories(fakeCount, {
      now,
      randomIntFn,
      excludedHeadlines: excludedFakeHeadlines,
      recentScenarioKeys,
      articles: normalized.filter(article => !selectedReal.includes(article)),
      referenceArticles: normalized,
    });
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
    selectBalancedArticles,
    shuffle,
    toIsoDate,
    todayKey,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
