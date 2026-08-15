(function initializeFindawayCore(root) {
  "use strict";

  const DEFAULT_SUMMARY =
    "Заголовок показан без подсказок о его происхождении. Оцените формулировку, а после ответа проверьте источник и контекст.";

  const FACT_SWAP_RULES = [
    ["погибли", "пострадали", "исход события"],
    ["погиб", "пострадал", "исход события"],
    ["погибла", "пострадала", "исход события"],
    ["ранены", "погибли", "исход события"],
    ["нашли мертвым", "нашли живым", "исход события"],
    ["нашли мертвой", "нашли живой", "исход события"],
    ["завоевали бронзу", "завоевали серебро", "результат соревнования"],
    ["золото", "серебро", "результат соревнования"],
    ["выиграл", "проиграл", "результат соревнования"],
    ["сохранил лидерство", "потерял лидерство", "результат соревнования"],
    ["побил мировой рекорд", "не смог побить мировой рекорд", "результат соревнования"],
    ["вышла в третий круг", "не прошла во второй круг", "результат соревнования"],
    ["вышел в третий круг", "не прошел во второй круг", "результат соревнования"],
    ["повысил", "снизил", "направление изменения"],
    ["повысила", "снизила", "направление изменения"],
    ["повысили", "снизили", "направление изменения"],
    ["увеличил", "сократил", "направление изменения"],
    ["увеличила", "сократила", "направление изменения"],
    ["вырос", "снизился", "направление изменения"],
    ["выросла", "снизилась", "направление изменения"],
    [
      "опустился до нового рекордного минимума",
      "поднялся до нового рекордного максимума",
      "направление изменения",
    ],
    ["превысило", "не достигло", "числовой порог"],
    ["одобрил", "отклонил", "решение"],
    ["одобрила", "отклонила", "решение"],
    ["разрешил", "запретил", "решение"],
    ["разрешила", "запретила", "решение"],
    ["открыл", "закрыл", "статус объекта"],
    ["открыла", "закрыла", "статус объекта"],
    ["возобновилось", "приостановлено", "статус сообщения"],
    ["усилят", "ослабят", "характер меры"],
    ["продлевает", "сокращает", "срок"],
    ["опроверг", "подтвердил", "позиция участника"],
    ["опровергла", "подтвердила", "позиция участника"],
    ["отверг", "подтвердил", "позиция участника"],
    ["отвергла", "подтвердила", "позиция участника"],
    ["признал незаконным", "признал законным", "правовая оценка"],
    ["признала незаконным", "признала законным", "правовая оценка"],
    ["отразили атаку", "не смогли отразить атаку", "исход события"],
    ["сбили", "обнаружили", "характер события"],
    ["проведет переговоры", "отменил переговоры", "дипломатическое решение"],
    ["игнорировала звонки", "передала записи звонков", "действие ведомства"],
    ["наращивает", "сокращает", "масштаб мер"],
    ["зафиксировала более", "зафиксировала менее", "числовой порог"],
    ["лишились возможности получить", "смогли продолжить получать", "исход события"],
    ["рассылает предостережения", "отзывает предостережения", "действие ведомства"],
    ["запрет", "разрешение", "правовая мера"],
    ["временно", "бессрочно", "срок"],
    ["до конца года", "в начале следующего года", "срок"],
    ["в ближайшие дни", "не раньше следующего месяца", "срок"],
    ["сильного землетрясения", "сильного наводнения", "тип события"],
    ["землетрясения", "наводнения", "тип события"],
    ["эболы", "лихорадки Марбург", "тип заболевания", "literal"],
    ["нефти", "топлива", "тип вещества"],
    ["в Белгородской области", "в Курской области", "география события"],
    ["под Белгородом", "под Курском", "география события"],
    ["в Москве", "в Санкт-Петербурге", "география события"],
    ["в Петербурге", "в Москве", "география события"],
    ["в Индонезии", "на Филиппинах", "география события"],
    ["в Колумбии", "в Эквадоре", "география события"],
    ["в Афганистане", "в Пакистане", "география события"],
    ["в Турции", "в Греции", "география события"],
    ["Турция", "Сербия", "география события"],
    ["Турции", "Сербии", "география события"],
    ["в Иране", "в Ираке", "география события"],
    ["Ирана", "Ирака", "география события"],
    ["Катар", "Оман", "география события"],
    ["Катара", "Омана", "география события"],
    ["Катаром", "Оманом", "география события"],
    ["в Украине", "в Молдове", "география события"],
    ["Украина", "Молдова", "география события"],
    ["в России", "в Беларуси", "география события"],
    ["России", "Беларуси", "география события"],
    ["Франции", "Испании", "география события"],
    ["Южный Судан", "Сомали", "география события"],
    ["Западной Азии", "Северной Африке", "география события"],
    ["Рейн", "Дунай", "география события"],
    ["Краснодар", "Зенит", "участник события"],
    ["Ахмат", "Рубин", "участник события"],
    ["Роскосмоса", "Росатома", "организация"],
    ["Marvel", "Disney", "организация"],
    ["Евросоюз", "НАТО", "организация"],
    ["чемпионате Европы", "чемпионате мира", "соревнование"],
    ["ЧЕ", "ЧМ", "соревнование"],
  ];

  const FALLBACK_FAKE_HEADLINES = [
    "Центробанк допустил снижение ключевой ставки до {rate}% на заседании в сентябре",
    "В Казани временно закрыли аэропорт после сообщения о неизвестном беспилотнике",
    "Сборная Сербии впервые вышла в полуфинал чемпионата Европы по волейболу",
    "Минтруд предложил перенести индексацию социальных выплат на начало {nextYear} года",
    "Крупнейшие банки снизили ставки по вкладам после публикации данных об инфляции",
    "У берегов Греции обнаружили грузовое судно, пропавшее более {days} дней назад",
    "Всемирная организация здравоохранения подтвердила новую вспышку лихорадки Марбург",
    "Еврокомиссия одобрила временные ограничения на импорт отдельных видов топлива",
    "Стоимость золота впервые с января превысила {price} долларов за тройскую унцию",
    "Авиакомпании предупредили о задержках рейсов из-за сбоя системы бронирования",
    "Ученые зафиксировали рекордное снижение уровня воды в одной из крупнейших рек Европы",
    "Правительство Японии продлило срок эксплуатации двух атомных электростанций",
    "Власти Испании отменили ограничения на движение поездов после сильного наводнения",
    "Клуб из Санкт-Петербурга проиграл третий матч подряд в национальном чемпионате",
    "Суд признал законным запрет на использование соцсетей для детей младше {age} лет",
    "Оман подтвердил задержание трех иностранных пилотов после посадки военного самолета",
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

  function capitalizeFirst(value) {
    return value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);
  }

  function headlineKey(value) {
    return normalizeTitle(value).toLocaleLowerCase("ru-RU");
  }

  function isLetterOrNumber(value) {
    return Boolean(value && /[\p{L}\p{N}]/u.test(value));
  }

  function findTermIndex(value, term) {
    const text = String(value);
    const normalizedText = text.toLocaleLowerCase("ru-RU");
    const normalizedTerm = term.toLocaleLowerCase("ru-RU");
    let index = normalizedText.indexOf(normalizedTerm);

    while (index >= 0) {
      const before = text[index - 1];
      const after = text[index + term.length];
      if (!isLetterOrNumber(before) && !isLetterOrNumber(after)) return index;
      index = normalizedText.indexOf(normalizedTerm, index + 1);
    }

    return -1;
  }

  function replacementWithMatchingCase(replacement, matched) {
    const letters = matched.replace(/[^\p{L}]/gu, "");
    if (letters && letters === letters.toLocaleUpperCase("ru-RU")) {
      return replacement.toLocaleUpperCase("ru-RU");
    }
    if (matched.charAt(0) === matched.charAt(0).toLocaleUpperCase("ru-RU")) {
      return capitalizeFirst(replacement);
    }
    return replacement;
  }

  function replaceTerm(value, from, to, caseMode = "match") {
    const index = findTermIndex(value, from);
    if (index < 0) return "";
    const matched = value.slice(index, index + from.length);
    const replacement = caseMode === "literal" ? to : replacementWithMatchingCase(to, matched);
    return `${value.slice(0, index)}${replacement}${value.slice(index + from.length)}`;
  }

  function buildTermMutations(headline) {
    const mutations = [];

    FACT_SWAP_RULES.forEach(([left, right, detail, caseMode], ruleIndex) => {
      const leftIndex = findTermIndex(headline, left);
      const rightIndex = findTermIndex(headline, right);
      if (leftIndex < 0 && rightIndex < 0) return;

      const useRight = rightIndex >= 0 && (leftIndex < 0 || right.length > left.length);
      const from = useRight ? right : left;
      const to = useRight ? left : right;
      mutations.push({
        key: `term-${ruleIndex}`,
        detail,
        apply: (value) => replaceTerm(value, from, to, caseMode),
      });
    });

    return mutations;
  }

  function russianCountCategory(value) {
    const absolute = Math.abs(Math.trunc(value));
    const lastTwo = absolute % 100;
    const last = absolute % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return "many";
    if (last === 1) return "one";
    if (last >= 2 && last <= 4) return "few";
    return "many";
  }

  function preserveCountCategory(original, alternative) {
    const category = russianCountCategory(original);
    const direction = alternative >= original ? 1 : -1;
    let candidate = Math.max(1, Math.round(alternative));

    for (let attempt = 0; attempt < 25; attempt += 1) {
      if (russianCountCategory(candidate) === category) return candidate;
      candidate = Math.max(1, candidate + direction);
    }

    return Math.max(1, Math.round(alternative));
  }

  function numericAlternatives(rawValue, now = new Date(), preserveCountForm = false) {
    const decimalSeparator = rawValue.includes(",") ? "," : ".";
    const decimalPlaces = rawValue.includes(",") || rawValue.includes(".")
      ? rawValue.split(/[.,]/u)[1].length
      : 0;
    const value = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(value)) return [];

    let alternatives;
    if (Number.isInteger(value) && value >= 1900 && value <= now.getFullYear() + 5) {
      alternatives = value >= now.getFullYear()
        ? [value - 1, value - 2]
        : [value - 1, Math.min(now.getFullYear(), value + 1)];
    } else if (decimalPlaces > 0) {
      const step = Math.max(0.5, value * 0.25);
      alternatives = [value + step, Math.max(0.1, value - step)];
    } else if (value <= 5) {
      alternatives = [value + 1, value + 2];
    } else if (value <= 20) {
      alternatives = [value + 3, Math.max(1, value - 2)];
    } else if (value <= 100) {
      alternatives = [value + 7, Math.max(1, value - 6)];
    } else {
      alternatives = [Math.round(value * 1.2), Math.max(1, Math.round(value * 0.8))];
    }

    if (preserveCountForm && decimalPlaces === 0 && value < 1900) {
      alternatives = alternatives.map((alternative) =>
        preserveCountCategory(value, alternative),
      );
    }

    return [...new Set(alternatives)]
      .filter((alternative) => alternative !== value)
      .map((alternative) => {
        if (decimalPlaces === 0) return String(Math.round(alternative));
        return alternative.toFixed(decimalPlaces).replace(".", decimalSeparator);
      });
  }

  function replaceNumberOccurrence(value, rawValue, occurrenceIndex, replacement) {
    const matches = [...value.matchAll(/\d+(?:[.,]\d+)?/gu)].filter(
      (match) => match[0] === rawValue,
    );
    const match = matches[occurrenceIndex];
    if (!match || match.index === undefined) return "";
    return `${value.slice(0, match.index)}${replacement}${value.slice(match.index + rawValue.length)}`;
  }

  function buildNumberMutations(headline, now = new Date()) {
    const matches = [...headline.matchAll(/\d+(?:[.,]\d+)?/gu)];
    const occurrenceCounts = new Map();
    const mutations = [];

    matches.slice(0, 4).forEach((match, numberIndex) => {
      const rawValue = match[0];
      const numericValue = Number(rawValue.replace(",", "."));
      const occurrenceIndex = occurrenceCounts.get(rawValue) || 0;
      occurrenceCounts.set(rawValue, occurrenceIndex + 1);
      const prefix = headline.slice(Math.max(0, (match.index || 0) - 3), match.index || 0);
      const suffix = headline.slice(
        (match.index || 0) + rawValue.length,
        (match.index || 0) + rawValue.length + 12,
      );
      const looksLikeModelNumber = numericValue < 1900 && /[\p{L}]-$/u.test(prefix);
      if (looksLikeModelNumber) return;
      const hasOrdinalSuffix = /^-(?:го|ей|му|ое|ую|ая|ий|ой|ый|ые|ую|ю|я|е|й)/iu.test(suffix);
      const preserveCountForm = !hasOrdinalSuffix && /^\s+\p{L}/u.test(suffix);

      numericAlternatives(rawValue, now, preserveCountForm).forEach((replacement, alternativeIndex) => {
        mutations.push({
          key: `number-${numberIndex}-${alternativeIndex}`,
          detail: "числовые данные",
          apply: (value) =>
            replaceNumberOccurrence(value, rawValue, occurrenceIndex, replacement),
        });
      });
    });

    return mutations;
  }

  function isStyleCompatible(headline, referenceHeadline) {
    const normalized = normalizeTitle(headline);
    if (normalized.length < 35 || normalized === normalizeTitle(referenceHeadline)) return false;
    const lengthRatio = normalized.length / referenceHeadline.length;
    return lengthRatio >= 0.68 && lengthRatio <= 1.32;
  }

  function buildArticleFakeCandidates(article, now = new Date()) {
    const referenceHeadline = normalizeTitle(article?.title);
    if (!referenceHeadline) return [];
    const referenceKey = headlineKey(referenceHeadline);
    const date = toIsoDate(article?.pubDate, now);
    const mutations = [
      ...buildTermMutations(referenceHeadline),
      ...buildNumberMutations(referenceHeadline, now),
    ];
    const candidates = [];
    const seen = new Set([referenceKey]);

    const addCandidate = (headline, usedMutations) => {
      const normalized = normalizeTitle(headline);
      const key = headlineKey(normalized);
      if (!key || seen.has(key) || !isStyleCompatible(normalized, referenceHeadline)) return;
      seen.add(key);
      candidates.push({
        headline: normalized,
        date,
        referenceKey,
        mutationCount: usedMutations.length,
        details: [...new Set(usedMutations.map((mutation) => mutation.detail))],
      });
    };

    for (let firstIndex = 0; firstIndex < mutations.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < mutations.length; secondIndex += 1) {
        const first = mutations[firstIndex];
        const second = mutations[secondIndex];
        if (first.detail === second.detail) continue;
        const afterFirst = first.apply(referenceHeadline);
        const afterSecond = afterFirst ? second.apply(afterFirst) : "";
        if (afterSecond) addCandidate(afterSecond, [first, second]);
      }
    }

    mutations.forEach((mutation) => {
      const headline = mutation.apply(referenceHeadline);
      if (headline) addCandidate(headline, [mutation]);
    });

    return candidates;
  }

  function buildReferenceFakeCandidates(referenceArticles, now = new Date()) {
    return normalizeArticles(referenceArticles).flatMap((article) =>
      buildArticleFakeCandidates(article, now),
    );
  }

  function buildFallbackFakeCandidates(now = new Date()) {
    const candidates = [];
    const replacements = Array.from({ length: 4 }, (_, variant) => ({
      age: String(13 + variant),
      days: String(9 + variant * 4),
      nextYear: String(now.getFullYear() + 1 + (variant % 2)),
      price: String(2450 + variant * 175),
      rate: String(12 + variant * 2),
    }));

    FALLBACK_FAKE_HEADLINES.forEach((template, templateIndex) => {
      const hasPlaceholder = /\{\w+\}/u.test(template);
      replacements.slice(0, hasPlaceholder ? replacements.length : 1).forEach((values, variant) => {
        const headline = template.replace(/\{(\w+)\}/gu, (_, key) => values[key] || "");
        candidates.push({
          headline,
          date: todayKey(now),
          referenceKey: `fallback-${templateIndex}-${variant}`,
          mutationCount: 2,
          details: ["событие", "обстоятельства"],
        });
      });
    });

    return candidates;
  }

  function buildFakeStories(
    count,
    {
      now = new Date(),
      randomIntFn = randomInt,
      excludedHeadlines = [],
      referenceArticles = [],
      knownRealHeadlines = [],
    } = {},
  ) {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError("Количество фейковых заголовков должно быть положительным целым числом");
    }

    const excluded = new Set(
      Array.from(excludedHeadlines, (headline) => headlineKey(headline)),
    );
    const realHeadlineKeys = new Set(
      [
        ...normalizeArticles(referenceArticles).map((article) => article.title),
        ...knownRealHeadlines,
      ].map((headline) => headlineKey(headline)),
    );
    const referenceCandidates = buildReferenceFakeCandidates(referenceArticles, now).filter(
      ({ headline }) => !excluded.has(headlineKey(headline)) && !realHeadlineKeys.has(headlineKey(headline)),
    );
    const candidates = [
      ...shuffle(
        referenceCandidates.filter(({ mutationCount }) => mutationCount >= 2),
        randomIntFn,
      ),
      ...shuffle(
        referenceCandidates.filter(({ mutationCount }) => mutationCount === 1),
        randomIntFn,
      ),
      ...shuffle(buildFallbackFakeCandidates(now), randomIntFn).filter(
        ({ headline }) => !excluded.has(headlineKey(headline)) && !realHeadlineKeys.has(headlineKey(headline)),
      ),
    ];
    const selected = [];
    const selectedHeadlines = new Set();
    const selectedReferences = new Set();

    for (const candidate of candidates) {
      const key = headlineKey(candidate.headline);
      if (selectedHeadlines.has(key) || selectedReferences.has(candidate.referenceKey)) continue;
      selected.push(candidate);
      selectedHeadlines.add(key);
      selectedReferences.add(candidate.referenceKey);
      if (selected.length === count) break;
    }

    if (selected.length < count) {
      for (const candidate of candidates) {
        const key = headlineKey(candidate.headline);
        if (selectedHeadlines.has(key)) continue;
        selected.push(candidate);
        selectedHeadlines.add(key);
        if (selected.length === count) break;
      }
    }

    if (selected.length < count) {
      throw new RangeError("Невозможно сформировать запрошенное число фейковых заголовков");
    }

    return selected.map(({ headline, date, details }) => ({
      headline,
      summary: DEFAULT_SUMMARY,
      category: "Новостная повестка",
      date,
      answer: "fake",
      url: "",
      sourceName: "",
      explanation:
        `Этот заголовок создан внутри игры в стилистике текущей новостной ленты. В нём намеренно изменены ключевые фактические детали (${details.join(", ")}), поэтому в доступных лентах такого заголовка нет.`,
    }));
  }

  function createRoundSet(
    articles,
    {
      roundCount = 10,
      minHeadlineLength = 35,
      now = new Date(),
      randomIntFn = randomInt,
      excludedFakeHeadlines = [],
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
    const selectedRealKeys = new Set(selectedReal.map((article) => headlineKey(article.title)));
    const unusedArticles = normalized.filter(
      (article) => !selectedRealKeys.has(headlineKey(article.title)),
    );
    const referenceArticles = unusedArticles.length >= fakeCount ? unusedArticles : normalized;
    const fakeStories = buildFakeStories(fakeCount, {
      now,
      randomIntFn,
      excludedHeadlines: excludedFakeHeadlines,
      referenceArticles,
      knownRealHeadlines: normalized.map((article) => article.title),
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
