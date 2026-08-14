(function initializeFindawayGame(root) {
  "use strict";

  if (root.FindawayGame?.started) return;

  const Core = root.FindawayCore;
  if (!Core) throw new Error("Игровое ядро не загружено");

  const SAME_ORIGIN_RSS_ENDPOINT = "/api/news";
  const RSS_JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json";
  const ALL_ORIGINS_ENDPOINT = "https://api.allorigins.win/raw";
  const ROUND_COUNT = 10;
  const REQUEST_TIMEOUT_MS = 6500;
  const FAKE_HISTORY_LIMIT = 100;
  const SOURCE_ARTICLE_LIMIT = 12;

  const NEWS_SOURCES = [
    {
      id: "bbc",
      name: "BBC News Русская служба",
      feedUrl: "https://feeds.bbci.co.uk/russian/rss.xml",
      sameOrigin: true,
    },
    {
      id: "tass",
      name: "ТАСС",
      feedUrl: "https://tass.ru/rss/v2.xml",
    },
    {
      id: "interfax",
      name: "Интерфакс",
      feedUrl: "https://www.interfax.ru/rss",
    },
    {
      id: "kommersant",
      name: "Коммерсантъ",
      feedUrl: "https://www.kommersant.ru/rss/news.xml",
    },
    {
      id: "rbc",
      name: "РБК",
      feedUrl: "https://rssexport.rbc.ru/rbcnews/news/30/full.rss",
    },
    {
      id: "un",
      name: "Новости ООН",
      feedUrl: "https://news.un.org/feed/subscribe/ru/news/all/rss.xml",
    },
    {
      id: "dw",
      name: "Deutsche Welle",
      feedUrl: "https://rss.dw.com/rdf/rss-ru-all",
    },
  ];

  const DEMO_ARTICLES = [
    {
      title: "Марсоход NASA Perseverance успешно совершил посадку на поверхность Марса",
      pubDate: "2021-02-18",
      link: "https://science.nasa.gov/mission/mars-2020-perseverance/",
      sourceName: "NASA",
      isDemo: true,
    },
    {
      title: "Космический телескоп James Webb передал первые полноцветные научные изображения",
      pubDate: "2022-07-12",
      link: "https://science.nasa.gov/mission/webb/",
      sourceName: "NASA",
      isDemo: true,
    },
    {
      title: "Индийская станция Chandrayaan-3 выполнила мягкую посадку на поверхности Луны",
      pubDate: "2023-08-23",
      link: "https://www.isro.gov.in/Chandrayaan3.html",
      sourceName: "ISRO",
      isDemo: true,
    },
    {
      title: "ВОЗ прекратила режим глобальной чрезвычайной ситуации в связи с COVID-19",
      pubDate: "2023-05-05",
      link: "https://www.who.int/news/item/05-05-2023-statement-on-the-fifteenth-meeting-of-the-international-health-regulations-(2005)-emergency-committee-regarding-the-coronavirus-disease-(covid-19)-pandemic",
      sourceName: "Всемирная организация здравоохранения",
      isDemo: true,
    },
    {
      title: "Нобелевскую премию мира 2023 года присудили правозащитнице Наргес Мохаммади",
      pubDate: "2023-10-06",
      link: "https://www.nobelprize.org/prizes/peace/2023/press-release/",
      sourceName: "Nobel Prize",
      isDemo: true,
    },
  ];

  let stories = [];
  let current = 0;
  let score = 0;
  let streak = 0;
  let mode = "loading";
  const recentFakeHeadlines = new Set();

  const roundEl = document.querySelector("#round");
  const scoreEl = document.querySelector("#score");
  const streakEl = document.querySelector("#streak");
  const categoryEl = document.querySelector("#category");
  const dateEl = document.querySelector("#date");
  const headlineEl = document.querySelector("#headline");
  const summaryEl = document.querySelector("#summary");
  const feedbackEl = document.querySelector("#feedback");
  const sourceLinkEl = document.querySelector("#source-link");
  const nextBtn = document.querySelector("#next");
  const actionsEl = document.querySelector("#actions");
  const statusEl = document.querySelector("#status");
  const cardEl = document.querySelector(".card");

  const requiredElements = [
    roundEl,
    scoreEl,
    streakEl,
    categoryEl,
    dateEl,
    headlineEl,
    summaryEl,
    feedbackEl,
    sourceLinkEl,
    nextBtn,
    actionsEl,
    statusEl,
    cardEl,
  ];
  if (requiredElements.some((element) => !element)) {
    throw new Error("Не найдены обязательные элементы интерфейса");
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timeout);
    }
  }

  function findChildElement(parent, localNames) {
    const names = new Set(localNames);
    return [...parent.getElementsByTagName("*")].find((element) =>
      names.has(element.localName),
    );
  }

  function articlesFromFeedXml(xmlText, sourceName) {
    const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (documentXml.getElementsByTagName("parsererror").length > 0) {
      throw new Error("лента содержит некорректный XML");
    }

    const entries = [...documentXml.getElementsByTagName("*")].filter((element) =>
      ["item", "entry"].includes(element.localName),
    );

    return entries.map((entry) => {
      const titleElement = findChildElement(entry, ["title"]);
      const dateElement = findChildElement(entry, ["pubDate", "date", "published", "updated"]);
      const linkElement = findChildElement(entry, ["link"]);

      return {
        title: titleElement?.textContent || "",
        pubDate: dateElement?.textContent || "",
        link: linkElement?.getAttribute("href") || linkElement?.textContent || "",
        sourceName,
      };
    });
  }

  async function fetchFromSameOrigin(source) {
    const response = await fetchWithTimeout(`${SAME_ORIGIN_RSS_ENDPOINT}?_=${Date.now()}`);
    if (!response.ok) throw new Error("встроенный RSS-шлюз недоступен");
    return articlesFromFeedXml(await response.text(), source.name);
  }

  async function fetchFromRss2Json(source) {
    const params = new URLSearchParams({ rss_url: source.feedUrl, _: String(Date.now()) });
    const response = await fetchWithTimeout(`${RSS_JSON_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error("rss2json не ответил");
    const data = await response.json();
    if (data.status !== "ok" || !Array.isArray(data.items)) {
      throw new Error("rss2json вернул некорректные данные");
    }
    return data.items.map((item) => ({ ...item, sourceName: source.name }));
  }

  async function fetchFromAllOrigins(source) {
    const params = new URLSearchParams({ url: source.feedUrl, _: String(Date.now()) });
    const response = await fetchWithTimeout(`${ALL_ORIGINS_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error("AllOrigins не ответил");
    return articlesFromFeedXml(await response.text(), source.name);
  }

  async function loadSource(source) {
    const loaders = [];
    if (source.sameOrigin) loaders.push(() => fetchFromSameOrigin(source));
    loaders.push(() => fetchFromRss2Json(source), () => fetchFromAllOrigins(source));

    const errors = [];
    for (const loader of loaders) {
      try {
        const articles = Core.normalizeArticles(await loader()).slice(0, SOURCE_ARTICLE_LIMIT);
        if (articles.length === 0) throw new Error("нет подходящих заголовков");
        return { source, articles };
      } catch (error) {
        errors.push(error);
      }
    }

    throw new AggregateError(errors, `${source.name}: лента недоступна`);
  }

  async function loadRssArticles() {
    const results = await Promise.allSettled(NEWS_SOURCES.map((source) => loadSource(source)));
    const loadedSources = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(`${NEWS_SOURCES[index].name}: лента временно недоступна`, result.reason);
      }
    });

    const liveArticles = loadedSources.flatMap(({ articles }) => articles);
    const needsDemoArticles =
      Core.normalizeArticles(liveArticles).length < ROUND_COUNT / 2;
    const articles = needsDemoArticles
      ? [...liveArticles, ...DEMO_ARTICLES]
      : liveArticles;

    return {
      articles,
      sourceCount: loadedSources.length,
      isDemo: needsDemoArticles,
    };
  }

  function setButtonsDisabled(disabled) {
    actionsEl.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
  }

  function resetFeedback() {
    feedbackEl.className = "feedback hidden";
    feedbackEl.replaceChildren();
    sourceLinkEl.classList.add("hidden");
    sourceLinkEl.removeAttribute("href");
    nextBtn.classList.add("hidden");
  }

  function setLoading() {
    mode = "loading";
    cardEl.setAttribute("aria-busy", "true");
    roundEl.textContent = `— / ${ROUND_COUNT}`;
    scoreEl.textContent = "0";
    streakEl.textContent = "0";
    categoryEl.textContent = "Новостная повестка";
    dateEl.textContent = "—";
    dateEl.removeAttribute("datetime");
    headlineEl.textContent = "Загружаем свежие заголовки…";
    summaryEl.textContent =
      "Если внешние ленты недоступны, игра автоматически включит демонстрационный набор.";
    statusEl.textContent = "Готовим новый выпуск…";
    actionsEl.classList.remove("hidden");
    setButtonsDisabled(true);
    resetFeedback();
  }

  function renderStory({ moveFocus = false } = {}) {
    const story = stories[current];
    mode = "playing";
    cardEl.setAttribute("aria-busy", "false");
    roundEl.textContent = `${current + 1} / ${stories.length}`;
    scoreEl.textContent = String(score);
    streakEl.textContent = String(streak);
    categoryEl.textContent = story.category;
    dateEl.textContent = Core.formatDisplayDate(story.date);
    dateEl.setAttribute("datetime", story.date);
    headlineEl.textContent = story.headline;
    summaryEl.textContent = story.summary;
    resetFeedback();
    actionsEl.classList.remove("hidden");
    setButtonsDisabled(false);
    if (moveFocus) headlineEl.focus();
  }

  function showFeedback(correct, story) {
    const result = document.createElement("strong");
    result.textContent = correct ? "Верно!" : "Промах.";
    feedbackEl.className = `feedback ${correct ? "correct" : "wrong"}`;
    feedbackEl.replaceChildren(result, document.createTextNode(` ${story.explanation}`));

    if (story.answer === "real" && story.url) {
      sourceLinkEl.href = story.url;
      sourceLinkEl.textContent = `Открыть источник: ${story.sourceName}`;
      sourceLinkEl.classList.remove("hidden");
    }

    feedbackEl.focus();
  }

  function checkAnswer(answer) {
    if (mode !== "playing") return;
    const story = stories[current];
    const correct = answer === story.answer;

    if (correct) {
      score += 1;
      streak += 1;
    } else {
      streak = 0;
    }

    scoreEl.textContent = String(score);
    streakEl.textContent = String(streak);
    showFeedback(correct, story);
    setButtonsDisabled(true);
    nextBtn.textContent = current === stories.length - 1 ? "Показать результат" : "Следующий раунд";
    nextBtn.classList.remove("hidden");
  }

  function finishGame() {
    mode = "finished";
    headlineEl.textContent = "Игра окончена!";
    summaryEl.textContent = `Ваш результат: ${score} из ${stories.length}. ${
      score >= 8
        ? "Отличная внимательность — продолжайте проверять первоисточники."
        : "Попробуйте ещё раз и уделяйте больше внимания источнику и формулировкам."
    }`;
    categoryEl.textContent = "Финал";
    dateEl.textContent = "результат";
    dateEl.removeAttribute("datetime");
    actionsEl.classList.add("hidden");
    feedbackEl.classList.add("hidden");
    sourceLinkEl.classList.add("hidden");
    nextBtn.textContent = "Сыграть ещё раз";
    nextBtn.classList.remove("hidden");
    headlineEl.focus();
  }

  function showFatalError(error) {
    mode = "error";
    cardEl.setAttribute("aria-busy", "false");
    statusEl.textContent = `Не удалось подготовить игру: ${error instanceof Error ? error.message : "неизвестная ошибка"}.`;
    headlineEl.textContent = "Игра временно недоступна";
    summaryEl.textContent = "Повторите загрузку. Если ошибка сохранится, проверьте подключение к интернету.";
    actionsEl.classList.add("hidden");
    nextBtn.textContent = "Повторить загрузку";
    nextBtn.classList.remove("hidden");
  }

  function rememberFakeHeadlines(rounds) {
    rounds
      .filter((story) => story.answer === "fake")
      .forEach((story) => recentFakeHeadlines.add(story.headline));

    while (recentFakeHeadlines.size > FAKE_HISTORY_LIMIT) {
      const oldestHeadline = recentFakeHeadlines.values().next().value;
      recentFakeHeadlines.delete(oldestHeadline);
    }
  }

  async function startGame() {
    current = 0;
    score = 0;
    streak = 0;
    stories = [];
    setLoading();

    try {
      const loaded = await loadRssArticles();
      stories = Core.createRoundSet(loaded.articles, {
        roundCount: ROUND_COUNT,
        excludedFakeHeadlines: recentFakeHeadlines,
      });
      rememberFakeHeadlines(stories);
      if (loaded.isDemo && loaded.sourceCount === 0) {
        statusEl.textContent =
          "Новостные ленты временно недоступны: включён демонстрационный выпуск из проверочных примеров.";
      } else if (loaded.isDemo) {
        statusEl.textContent =
          `Получены данные из ${loaded.sourceCount} лент; недостающие заголовки дополнены демонстрационными примерами.`;
      } else {
        statusEl.textContent =
          `Сформировано ${stories.length} раундов из ${loaded.sourceCount} доступных новостных лент.`;
      }
      renderStory();
    } catch (error) {
      showFatalError(error);
    }
  }

  actionsEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-answer]");
    if (button && !button.disabled) checkAnswer(button.dataset.answer);
  });

  nextBtn.addEventListener("click", () => {
    if (mode === "finished" || mode === "error") {
      void startGame();
      return;
    }

    if (mode !== "playing") return;
    if (current === stories.length - 1) {
      finishGame();
      return;
    }

    current += 1;
    renderStory({ moveFocus: true });
  });

  root.FindawayGame = Object.freeze({ started: true, restart: startGame });
  void startGame();
})(typeof globalThis !== "undefined" ? globalThis : window);
