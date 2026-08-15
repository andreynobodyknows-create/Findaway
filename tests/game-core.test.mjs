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
  "Число погибших в результате землетрясения в Индонезии превысило 40 человек",
  "Конституционный совет Франции признал незаконным запрет на соцсети для детей до 15 лет",
  "Российские пловцы завоевали бронзу в смешанной эстафете на чемпионате Европы",
  "Авиасообщение возобновилось в аэропорту Бендер-Аббаса на юге Ирана",
  "Уровень воды в реке Рейн опустился до нового рекордного минимума",
  "Катар опроверг заявление Ирана о пленении трех пилотов Су-24",
  "Испания продлевает срок эксплуатации одной из основных АЭС",
  "С 2021 года более 2,6 миллиона девочек в Афганистане лишились возможности получить образование",
  "Краснодар обыграл Ахмат и сохранил лидерство в национальном чемпионате",
  "Власти России усилят контроль за поездками граждан за границу",
].map((title, index) => ({
  title,
  pubDate: `2026-08-${String(index + 1).padStart(2, "0")}`,
  link: `https://example.com/story-${index + 1}`,
  sourceName: `Источник ${(index % 5) + 1}`,
}));

function normalizedKey(value) {
  return value.toLocaleLowerCase("ru-RU").replace(/\s+/gu, " ").trim();
}

function wordOverlap(left, right) {
  const leftWords = new Set(left.toLocaleLowerCase("ru-RU").match(/\p{L}{3,}/gu) || []);
  const rightWords = new Set(right.toLocaleLowerCase("ru-RU").match(/\p{L}{3,}/gu) || []);
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.max(1, Math.min(leftWords.size, rightWords.size));
}

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

test("фейки наследуют форму текущей ленты и меняют фактические детали", () => {
  const options = {
    now: new Date("2026-08-14T12:00:00Z"),
    randomIntFn: () => 0,
    referenceArticles: articles,
    knownRealHeadlines: articles.map((article) => article.title),
  };
  const firstGame = Core.buildFakeStories(5, options);
  const realKeys = new Set(articles.map((article) => normalizedKey(article.title)));
  const realAverageLength =
    articles.reduce((sum, article) => sum + article.title.length, 0) / articles.length;
  const fakeAverageLength =
    firstGame.reduce((sum, story) => sum + story.headline.length, 0) / firstGame.length;

  assert.equal(firstGame.every((story) => !realKeys.has(normalizedKey(story.headline))), true);
  assert.equal(
    firstGame.every((story) =>
      articles.some((article) => Core.toIsoDate(article.pubDate) === story.date),
    ),
    true,
  );
  assert.equal(fakeAverageLength >= realAverageLength * 0.75, true);
  assert.equal(fakeAverageLength <= realAverageLength * 1.25, true);
  assert.equal(
    firstGame.every((story) =>
      articles.some((article) => wordOverlap(story.headline, article.title) >= 0.6),
    ),
    true,
  );
  assert.equal(
    firstGame.some((story) => /Межрегиональный центр|пилотного этапа/iu.test(story.headline)),
    false,
  );
});

test("каждая новая игра получает свежие фейковые заголовки", () => {
  const options = {
    now: new Date("2026-08-14T12:00:00Z"),
    randomIntFn: () => 0,
    referenceArticles: articles,
    knownRealHeadlines: articles.map((article) => article.title),
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
    [...firstGame, ...secondGame].every((story) => story.headline.length >= 35),
    true,
  );
});

test("составные подмены не создают тавтологию и внутренние противоречия", () => {
  const referenceArticles = [articles[4], articles[7]];
  const stories = Core.buildFakeStories(2, {
    now: new Date("2026-08-14T12:00:00Z"),
    randomIntFn: () => 0,
    referenceArticles,
    knownRealHeadlines: referenceArticles.map((article) => article.title),
  });

  stories.forEach((story) => {
    assert.doesNotMatch(story.headline, /получили возможность получить/iu);
    assert.doesNotMatch(story.headline, /поднялся[^.]*минимума/iu);
    assert.doesNotMatch(story.headline, /опустился[^.]*максимума/iu);
  });
});

test("генератор не превращает текущий год в очевидно будущий спортивный сезон", () => {
  const referenceArticles = [{
    title: "Гимнастка Мельникова довела до четырех число своих медалей на ЧЕ-2026",
    pubDate: "2026-08-15",
  }];
  const [story] = Core.buildFakeStories(1, {
    now: new Date("2026-08-15T12:00:00Z"),
    randomIntFn: () => 0,
    referenceArticles,
    knownRealHeadlines: referenceArticles.map((article) => article.title),
  });

  assert.doesNotMatch(story.headline, /2027/u);
});

test("изменённые числа сохраняют согласование с существительным", () => {
  const referenceArticles = [{
    title: "С утра субботы российские военные сбили над регионами 180 дронов ВСУ",
    pubDate: "2026-08-15",
  }];
  const [story] = Core.buildFakeStories(1, {
    now: new Date("2026-08-15T12:00:00Z"),
    randomIntFn: () => 0,
    referenceArticles,
    knownRealHeadlines: referenceArticles.map((article) => article.title),
  });
  const value = Number(story.headline.match(/(\d+) дронов/u)?.[1]);
  const lastTwo = value % 100;
  const last = value % 10;

  assert.equal(Number.isFinite(value), true);
  assert.equal((lastTwo >= 11 && lastTwo <= 14) || last === 0 || last >= 5, true);
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
