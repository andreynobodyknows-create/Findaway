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
      (story) => story.headline.length >= 80 && story.headline.split(/\s+/u).length >= 10,
    ),
    true,
  );
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
