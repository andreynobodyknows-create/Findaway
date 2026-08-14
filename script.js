(function initializeFindawayGame(root) {
  "use strict";

  if (root.FindawayGame?.started) return;

  const Core = root.FindawayCore;
  if (!Core) throw new Error("Игровое ядро не загружено");

  const SAME_ORIGIN_RSS_ENDPOINT = "/api/news";
  const RSS_JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json";
  const ALL_ORIGINS_ENDPOINT = "https://api.allorigins.win/raw";
  const WORLD_RSS_FEED = "https://feeds.bbci.co.uk/russian/rss.xml";
  const ROUND_COUNT = 10;
  const REQUEST_TIMEOUT_MS = 6500;

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

  function articlesFromRssXml(xmlText) {
    const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (documentXml.querySelector("parsererror")) throw new Error("RSS содержит некорректный XML");

    return [...documentXml.querySelectorAll("item")].map((item) => ({
      title: item.querySelector("title")?.textContent || "",
      pubDate: item.querySelector("pubDate")?.textContent || "",
      link: item.querySelector("link")?.textContent || "",
      sourceName: "BBC News Русская служба",
    }));
  }

  async function fetchFromSameOrigin() {
    const response = await fetchWithTimeout(`${SAME_ORIGIN_RSS_ENDPOINT}?_=${Date.now()}`);
    if (!response.ok) throw new Error("встроенный RSS-шлюз недоступен");
    return articlesFromRssXml(await response.text());
  }

  async function fetchFromRss2Json() {
    const params = new URLSearchParams({ rss_url: WORLD_RSS_FEED, _: String(Date.now()) });
    const response = await fetchWithTimeout(`${RSS_JSON_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error("rss2json не ответил");
    const data = await response.json();
    if (data.status !== "ok" || !Array.isArray(data.items)) {
      throw new Error("rss2json вернул некорректные данные");
    }
    return data.items.map((item) => ({ ...item, sourceName: "BBC News Русская служба" }));
  }

  async function fetchFromAllOrigins() {
    const params = new URLSearchParams({ url: WORLD_RSS_FEED, _: String(Date.now()) });
    const response = await fetchWithTimeout(`${ALL_ORIGINS_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error("AllOrigins не ответил");
    return articlesFromRssXml(await response.text());
  }

  async function loadViable(loader, sourceLabel) {
    const articles = await loader();
    if (Core.normalizeArticles(articles).length < ROUND_COUNT / 2) {
      throw new Error(`${sourceLabel} вернул недостаточно заголовков`);
    }
    return { articles, sourceLabel, isDemo: false };
  }

  async function loadRssArticles() {
    try {
      return await loadViable(fetchFromSameOrigin, "BBC RSS");
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
    }

    try {
      return await Promise.any([
        loadViable(fetchFromRss2Json, "BBC RSS через rss2json"),
        loadViable(fetchFromAllOrigins, "BBC RSS через AllOrigins"),
      ]);
    } catch (error) {
      console.warn("Свежая RSS-лента недоступна, используется демонстрационный набор", error);
      return { articles: DEMO_ARTICLES, sourceLabel: "демонстрационный набор", isDemo: true };
    }
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
    summaryEl.textContent = "Если внешняя лента недоступна, игра автоматически включит демонстрационный набор.";
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

  async function startGame() {
    current = 0;
    score = 0;
    streak = 0;
    stories = [];
    setLoading();

    try {
      const loaded = await loadRssArticles();
      stories = Core.createRoundSet(loaded.articles, { roundCount: ROUND_COUNT });
      statusEl.textContent = loaded.isDemo
        ? "Свежая лента временно недоступна: включён демонстрационный выпуск из проверочных примеров."
        : `Сформировано ${stories.length} раундов. Источник заголовков: ${loaded.sourceLabel}.`;
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
