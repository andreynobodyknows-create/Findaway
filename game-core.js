(function initializeFindawayCore(root) {
  "use strict";

  const DEFAULT_SUMMARY =
    "Заголовок показан без подсказок о его происхождении. Оцените формулировку, а после ответа проверьте источник и контекст.";

  const FAKE_SCENARIOS = [
    {
      subjects: [
        "Межрегиональный центр прикладных городских исследований",
        "Институт транспортных технологий",
      ],
      action:
        "представил методику оценки загруженности районов по обезличенным транспортным данным",
      contexts: [
        "по итогам исследования в нескольких пилотных регионах",
        "после шестимесячного тестирования",
        "для городов с населением свыше 500 тысяч человек",
      ],
    },
    {
      subjects: [
        "Научно-аналитический центр энергосбережения",
        "Комитет по устойчивому развитию городов",
      ],
      action:
        "запустил пилотный проект автоматического учёта энергопотребления в общественных зданиях",
      contexts: [
        "на первом этапе в четырёх крупных городах",
        "после испытаний системы в муниципальных учреждениях",
        "в рамках программы на {nextYear} год",
      ],
    },
    {
      subjects: [
        "Институт транспортных технологий",
        "Альянс операторов общественных сервисов",
      ],
      action:
        "предложил единый стандарт возврата билетов при длительных задержках межрегиональных рейсов",
      contexts: [
        "по запросу региональных перевозчиков",
        "перед общественным обсуждением инициативы",
        "после анализа обращений пассажиров за последние два года",
      ],
    },
    {
      subjects: [
        "Совет по развитию цифровой инфраструктуры",
        "Альянс операторов общественных сервисов",
      ],
      action:
        "опубликовал рекомендации по резервному оповещению жителей при сбоях мобильной связи",
      contexts: [
        "после консультаций с региональными операторами",
        "с возможностью подключения частных сервисов",
        "перед началом пилотного этапа в нескольких регионах",
      ],
    },
    {
      subjects: [
        "Комитет по устойчивому развитию городов",
        "Совет по развитию цифровой инфраструктуры",
      ],
      action:
        "начал испытания платформы для согласования дорожных работ между коммунальными службами",
      contexts: [
        "на первом этапе в четырёх крупных городах",
        "после шестимесячной подготовки проекта",
        "в рамках программы на {nextYear} год",
      ],
    },
    {
      subjects: [
        "Фонд технологических инициатив регионов",
        "Альянс операторов общественных сервисов",
      ],
      action:
        "подготовил проект маркировки товаров с указанием среднего срока доставки",
      contexts: [
        "по итогам консультаций с интернет-магазинами",
        "перед общественным обсуждением инициативы",
        "после анализа обращений покупателей",
      ],
    },
    {
      subjects: [
        "Межрегиональный центр прикладных городских исследований",
        "Комитет по устойчивому развитию городов",
      ],
      action:
        "объявил о создании открытого реестра доступности городской инфраструктуры",
      contexts: [
        "на первом этапе в четырёх крупных городах",
        "после консультаций с общественными организациями",
        "для городов с населением свыше 500 тысяч человек",
      ],
    },
    {
      subjects: [
        "Научно-аналитический центр энергосбережения",
        "Комитет по устойчивому развитию городов",
      ],
      action:
        "согласовал параметры эксперимента по адаптивному освещению пешеходных переходов",
      contexts: [
        "после испытаний оборудования в лабораторных условиях",
        "на первом этапе в четырёх крупных городах",
        "в рамках программы на {nextYear} год",
      ],
    },
    {
      subjects: [
        "Межрегиональный центр прикладных городских исследований",
        "Консорциум региональных университетов",
      ],
      action:
        "разработал систему контроля качества воздуха с помощью датчиков общественного транспорта",
      contexts: [
        "по итогам исследования в нескольких пилотных регионах",
        "после шестимесячного тестирования",
        "с публикацией обезличенных результатов в открытом доступе",
      ],
    },
    {
      subjects: [
        "Совет по развитию цифровой инфраструктуры",
        "Альянс операторов общественных сервисов",
      ],
      action:
        "предложил использовать цифровые квитанции для подтверждения гарантийного срока техники",
      contexts: [
        "по итогам консультаций с торговыми сетями",
        "после шестимесячного тестирования",
        "перед общественным обсуждением инициативы",
      ],
    },
    {
      subjects: [
        "Институт транспортных технологий",
        "Альянс операторов общественных сервисов",
      ],
      action:
        "начал тестирование единого формата уведомлений об изменениях маршрутов",
      contexts: [
        "по запросу региональных перевозчиков",
        "на первом этапе в четырёх крупных городах",
        "с возможностью подключения частных транспортных компаний",
      ],
    },
    {
      subjects: [
        "Комитет по устойчивому развитию городов",
        "Консорциум региональных университетов",
      ],
      action:
        "представил рекомендации по учёту доступности общественных пространств при ремонте улиц",
      contexts: [
        "после консультаций с общественными организациями",
        "для городов с населением свыше 500 тысяч человек",
        "перед общественным обсуждением инициативы",
      ],
    },
  ];

  const FAKE_LEADS = [
    "По данным предварительного отчёта",
    "По итогам пилотного этапа",
    "Как следует из проекта рекомендаций",
    "Согласно опубликованной концепции",
    "В опубликованной концепции говорится",
    "Авторы инициативы сообщили",
  ];

  const FAKE_TAILS = [
    "первые результаты представят до конца года",
    "решение планируют обсудить с региональными операторами",
    "методику опубликуют после завершения пилота",
    "подключение новых участников начнётся на втором этапе",
    "итоги эксперимента станут основой для окончательного регламента",
    "участие в проекте на первом этапе будет добровольным",
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

  function lowerFirst(value) {
    return value.charAt(0).toLocaleLowerCase("ru-RU") + value.slice(1);
  }

  function capitalizeFirst(value) {
    return value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);
  }

  function buildFakeCandidates(now = new Date()) {
    const candidates = [];
    const nextYear = String(now.getFullYear() + 1);
    const addCandidate = (headline, scenarioKey) => {
      candidates.push({ headline, scenarioKey });
    };

    FAKE_SCENARIOS.forEach((scenario, scenarioIndex) => {
      scenario.subjects.forEach((subject, subjectIndex) => {
        scenario.contexts.forEach((rawContext, contextIndex) => {
          const context = rawContext.replace("{nextYear}", nextYear);

          for (let template = 0; template < 4; template += 1) {
            const lead =
              FAKE_LEADS[
                (scenarioIndex + subjectIndex + contextIndex + template) % FAKE_LEADS.length
              ];
            const tail =
              FAKE_TAILS[
                (scenarioIndex * 2 + subjectIndex + contextIndex + template) % FAKE_TAILS.length
              ];

            if (template === 0) {
              addCandidate(`${subject} ${scenario.action} ${context}`, scenarioIndex);
            }
            if (template === 1) {
              addCandidate(
                `${lead}: ${lowerFirst(subject)} ${scenario.action} ${context}`,
                scenarioIndex,
              );
            }
            if (template === 2) {
              addCandidate(
                `${subject} ${scenario.action} ${context}; ${tail}`,
                scenarioIndex,
              );
            }
            if (template === 3) {
              addCandidate(
                `${capitalizeFirst(context)} ${lowerFirst(subject)} ${scenario.action}`,
                scenarioIndex,
              );
            }
          }
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
    } = {},
  ) {
    const excluded = new Set(
      Array.from(excludedHeadlines, (headline) =>
        normalizeTitle(headline).toLocaleLowerCase("ru-RU"),
      ),
    );
    const candidates = shuffle(buildFakeCandidates(now), randomIntFn).filter(
      ({ headline }) => !excluded.has(headline.toLocaleLowerCase("ru-RU")),
    );
    const selected = [];
    const selectedScenarios = new Set();

    for (const candidate of candidates) {
      if (selectedScenarios.has(candidate.scenarioKey)) continue;
      selected.push(candidate);
      selectedScenarios.add(candidate.scenarioKey);
      if (selected.length === count) break;
    }

    if (!Number.isInteger(count) || count < 1 || selected.length < count) {
      throw new RangeError("Невозможно сформировать запрошенное число фейковых заголовков");
    }

    return selected.map(({ headline }) => ({
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

    const selectedReal = shuffle(normalized, randomIntFn).slice(0, realCount);
    const realStories = buildRealStories(selectedReal, now);
    const fakeStories = buildFakeStories(fakeCount, {
      now,
      randomIntFn,
      excludedHeadlines: excludedFakeHeadlines,
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
    shuffle,
    toIsoDate,
    todayKey,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
