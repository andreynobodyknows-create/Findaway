import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../game-core.js", import.meta.url), "utf8");
const markup = await readFile(new URL("../index.html", import.meta.url), "utf8");
const runtimeSource = await readFile(new URL("../script.js", import.meta.url), "utf8");
const context = vm.createContext({ URL, Intl, Date, console });
vm.runInContext(source, context, { filename: "game-core.js" });
const Core = context.FindawayCore;

const articles = [
  "Первый проверочный заголовок содержит достаточно символов для игрового раунда",
  "Второй проверочный заголовок содержит достаточно символов для игрового раунда",
  "Третий проверочный заголовок содержит достаточно символов для игрового раунда",
  "Четвёртый проверочный заголовок содержит достаточно символов для игрового раунда",
  "Пятый проверочный заголовок содержит достаточно символов для игрового раунда",
].map((title, index) => ({
  title,
  pubDate: `2026-08-0${index + 1}`,
  link: `https://example.com/story-${index + 1}`,
}));

test("пустые значения и RSS-даты обрабатываются безопасно", () => {
  assert.equal(Core.normalizeTitle(undefined), "");
  assert.equal(Core.toIsoDate("Thu, 13 Aug 2026 12:00:00 GMT"), "2026-08-13");
});

test("небезопасные URL отбрасываются", () => {
  assert.equal(Core.safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(Core.safeHttpUrl("https://example.com/a"), "https://example.com/a");
});

test("кнопки подписаны как правда и фейк", () => {
  assert.match(markup, /data-answer="real" disabled>\s*правда\s*<\/button>/u);
  assert.match(markup, /data-answer="fake" disabled>\s*фейк\s*<\/button>/u);
});

test("подключены все семь новостных лент", () => {
  const feedUrls = [
    "https://feeds.bbci.co.uk/russian/rss.xml",
    "https://tass.ru/rss/v2.xml",
    "https://www.interfax.ru/rss",
    "https://www.kommersant.ru/rss/news.xml",
    "https://rssexport.rbc.ru/rbcnews/news/30/full.rss",
    "https://news.un.org/feed/subscribe/ru/news/all/rss.xml",
    "https://rss.dw.com/rdf/rss-ru-all",
  ];

  feedUrls.forEach((feedUrl) => assert.equal(runtimeSource.includes(feedUrl), true));
  assert.match(runtimeSource, /Promise\.allSettled\(NEWS_SOURCES/u);
});

test("реальные раунды распределяются между доступными источниками", () => {
  const multiSourceArticles = Array.from({ length: 5 }, (_, sourceIndex) =>
    Array.from({ length: 2 }, (_, articleIndex) => ({
      title:
        `Проверочный заголовок ${sourceIndex + 1}-${articleIndex + 1} содержит достаточно слов для отбора в игру`,
      pubDate: "2026-08-14",
      link: `https://example.com/${sourceIndex + 1}/${articleIndex + 1}`,
      sourceName: `Источник ${sourceIndex + 1}`,
    })),
  ).flat();
  const stories = Core.createRoundSet(multiSourceArticles, {
    roundCount: 10,
    randomIntFn: () => 0,
  });
  const realSources = new Set(
    stories.filter((story) => story.answer === "real").map((story) => story.sourceName),
  );

  assert.equal(realSources.size, 5);
});

test("каждая новая игра получает свежие реалистичные фейковые заголовки", () => {
  const options = {
    now: new Date("2026-08-14T12:00:00Z"),
    randomIntFn: () => 0,
  };
  const firstGame = Core.buildFakeStories(5, options);
  const secondGame = Core.buildFakeStories(5, {
    ...options,
    excludedHeadlines: firstGame.map((story) => story.headline),
  });
  const firstHeadlines = new Set(firstGame.map((story) => story.headline));

  assert.equal(
    secondGame.some((story) => firstHeadlines.has(story.headline)),
    false,
  );
  assert.equal(
    [...firstGame, ...secondGame].every(
      (story) => story.headline.length >= 35 && story.headline.length < 180,
    ),
    true,
  );
});

test("фейки меняют деталь исходной новости и объясняют подмену", () => {
  const inputs = [
    { title: "Парламент одобрил проект нового транспортного соглашения", link: "https://example.com/original", sourceName: "Тест", pubDate: "2026-09-18" },
    { title: "Продажи новых автомобилей выросли на 12% за прошедший месяц", link: "https://example.com/sales", pubDate: "2026-09-19" },
  ];
  const result = Core.buildFakeStories(2, { articles: inputs, randomIntFn: () => 0 });
  assert.equal(new Set(result.map(item => item.scenarioKey)).size, 2);
  for (const item of result) {
    assert.ok(item.originalHeadline);
    assert.notEqual(item.headline, item.originalHeadline);
    assert.ok(item.explanation.includes(item.originalHeadline));
    assert.ok(item.explanation.includes(item.change));
    assert.ok(item.url.startsWith("https://example.com/"));
    assert.notEqual(item.date, Core.todayKey());
  }
});

test("фейки не совпадают с лентой, а их оригиналы не выдают ответ в той же игре", () => {
  const inputs = Array.from({length: 15}, (_, i) => ({
    title: `Продажи автомобилей в регионе ${i} выросли за прошедший месяц`,
    sourceName: `Редакция ${i % 5}`, link: `https://example.com/${i}`,
  }));
  inputs.push({title: "Продажи автомобилей в регионе 0 снизились за прошедший месяц"});
  const rounds = Core.createRoundSet(inputs, {randomIntFn: () => 0});
  const real = new Set(rounds.filter(item => item.answer === "real").map(item => item.headline));
  for (const item of rounds.filter(item => item.answer === "fake")) {
    assert.ok(!inputs.some(input => input.title === item.headline));
    assert.ok(!real.has(item.originalHeadline));
  }
});

test("сценарии не повторяются в соседних играх и запас не иссякает после ста игр", () => {
  let history = [], scenarios = [];
  for (let game = 0; game < 100; game++) {
    const result = Core.buildFakeStories(5, {
      excludedHeadlines: history, recentScenarioKeys: scenarios, randomIntFn: () => 0,
    });
    assert.equal(new Set(result.map(item => item.scenarioKey)).size, 5);
    for (const item of result) {
      assert.ok(!history.includes(item.headline));
      assert.ok(!scenarios.includes(item.scenarioKey));
    }
    history = [...history, ...result.map(item => item.headline)].slice(-100);
    scenarios = [...scenarios, ...result.map(item => item.scenarioKey)].slice(-10);
  }
});

test("цитаты и отрицания не превращаются в механически изменённые утверждения", () => {
  const inputs = [
    { title: "Парламент не одобрил проект нового транспортного соглашения" },
    { title: "Министр: «Экспорт вырос на 12% за прошедший месяц»" },
  ];
  assert.ok(Core.buildFakeStories(2, {articles: inputs}).every(item => !item.originalHeadline));
});

test("набор строится из RSS-объектов с полем title", () => {
  const stories = Core.createRoundSet(articles, {
    roundCount: 10,
    now: new Date("2026-08-13T12:00:00Z"),
    randomIntFn: () => 0,
  });

  assert.equal(stories.length, 10);
  assert.equal(stories.filter((story) => story.answer === "real").length, 5);
  assert.equal(stories.filter((story) => story.answer === "fake").length, 5);
  assert.equal(new Set(stories.map((story) => story.headline)).size, 10);
});

test("для десяти раундов нужны пять заголовков из ленты", () => {
  assert.throws(() => Core.createRoundSet(articles.slice(0, 4)), /минимум 5/u);
});

async function launchPage(localStorage) {
  const nodes = new Map();
  const node = () => ({
    textContent: "", classList: {add() {}, remove() {}},
    setAttribute() {}, removeAttribute() {}, replaceChildren() {},
    addEventListener() {}, querySelectorAll: () => [], focus() {},
  });
  const browser = vm.createContext({
    URL, URLSearchParams, Intl, Date, console, AbortController, setTimeout, clearTimeout,
    localStorage,
    document: {querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, node());
      return nodes.get(selector);
    }},
    fetch: async url => url.startsWith("/api/") ? {ok: false} : {
      ok: true, json: async () => ({status: "ok", items: articles}),
    },
  });
  vm.runInContext(source, browser);
  vm.runInContext(runtimeSource, browser);
  for (let tick = 0; tick < 30 && nodes.get("#round").textContent !== "1 / 10"; tick++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(nodes.get("#round").textContent, "1 / 10", nodes.get("#status").textContent);
  return nodes;
}

test("история переживает перезагрузку страницы", async () => {
  const saved = new Map();
  const storage = {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value)};
  await launchPage(storage);
  const first = JSON.parse([...saved.values()][0]);
  assert.equal(first.headlines.length, 5);
  await launchPage(storage);
  const second = JSON.parse([...saved.values()][0]);
  assert.equal(second.headlines.length, 10);
  assert.equal(new Set(second.headlines).size, 10);
  assert.equal(new Set(second.scenarios).size, 10);
});

test("повреждённая или недоступная история не мешает начать игру", async () => {
  await launchPage({getItem: () => "{broken", setItem() {}});
  await launchPage({getItem() {throw new Error("denied");}, setItem() {throw new Error("denied");}});
});
