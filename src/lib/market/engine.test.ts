import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MarketEngine } from "./engine";
import { buyCost } from "./fees";
import { formatSimTime, nextOpen, sessionStatus, shanghaiEpoch } from "./time";

const flatRng = () => 0.5;

function fresh() {
  return new MarketEngine({ rng: flatRng, backfill: false });
}

describe("session clock", () => {
  it("treats the anchored Monday morning as open", () => {
    const morning = shanghaiEpoch(2026, 9, 12, 10, 16, 0);
    assert.equal(sessionStatus(morning), "open");
  });

  it("jumps lunch to 13:00 and Friday night to the next weekday", () => {
    const lunch = shanghaiEpoch(2026, 9, 12, 12, 0, 0);
    assert.equal(sessionStatus(lunch), "lunch");
    assert.equal(formatSimTime(nextOpen(lunch)).clock, "13:00:00");

    const fridayClose = shanghaiEpoch(2026, 9, 16, 15, 10, 0);
    const opened = formatSimTime(nextOpen(fridayClose));
    assert.equal(opened.date, "2026-10-19");
    assert.equal(opened.clock, "09:30:00");
  });
});

describe("paper trading", () => {
  it("buys at the ask, blocks T+1 sells, then allows them when T+1 is off", () => {
    const engine = fresh();
    const before = engine.getState();
    const ask = before.books["159915"]?.asks[0];
    assert.ok(ask);
    const bought = engine.placeOrder({
      symbol: "159915",
      side: "buy",
      type: "market",
      qty: 100,
    });
    assert.equal(bought.ok, true);
    const holding = engine.getState();
    const position = holding.positions.find((item) => item.symbol === "159915");
    assert.equal(position?.qty, 100);
    assert.equal(position?.available, 0);
    assert.ok(holding.cash < before.cash);
    assert.ok(Math.abs(before.cash - holding.cash - buyCost(100, ask.price)) < 0.02);

    const blocked = engine.placeOrder({
      symbol: "159915",
      side: "sell",
      type: "market",
      qty: 100,
    });
    assert.equal(blocked.ok, false);

    engine.setTPlusOne(false);
    const sold = engine.placeOrder({
      symbol: "159915",
      side: "sell",
      type: "market",
      qty: 100,
    });
    assert.equal(sold.ok, true);
    const flat = engine.getState();
    assert.equal(flat.positions.find((item) => item.symbol === "159915"), undefined);
    assert.ok(flat.cash < before.cash);
  });

  it("reserves cash for a resting limit buy and refunds it on cancel", () => {
    const engine = fresh();
    const cash = engine.getState().cash;
    const placed = engine.placeOrder({
      symbol: "600036",
      side: "buy",
      type: "limit",
      qty: 100,
      limitPrice: 38,
    });
    assert.equal(placed.ok, true);
    const resting = engine.getState();
    assert.equal(resting.orders[0]?.status, "open");
    assert.ok(resting.cash < cash);
    assert.ok(Math.abs(resting.equity - resting.initialCash) < 0.05);
    const orderId = resting.orders[0]?.id;
    assert.ok(orderId);
    const cancelled = engine.cancelOrder(orderId);
    assert.equal(cancelled.ok, true);
    const after = engine.getState();
    assert.equal(after.cash, cash);
    assert.equal(after.orders[0]?.status, "cancelled");
  });

  it("fills a limit buy once the ask crosses the limit", () => {
    const engine = fresh();
    const placed = engine.placeOrder({
      symbol: "518880",
      side: "buy",
      type: "limit",
      qty: 100,
      limitPrice: 5.5,
    });
    assert.equal(placed.ok, true);
    assert.equal(engine.getState().orders[0]?.status, "open");
    engine.debugSetPrice("518880", 5.4);
    const filled = engine.getState();
    assert.equal(filled.orders[0]?.status, "filled");
    assert.equal(filled.positions[0]?.symbol, "518880");
    assert.equal(filled.positions[0]?.qty, 100);
  });

  it("rejects odd lots and clamps prices inside the daily limit", () => {
    const engine = fresh();
    const odd = engine.placeOrder({
      symbol: "600519",
      side: "buy",
      type: "market",
      qty: 50,
    });
    assert.equal(odd.ok, false);

    engine.debugSetPrice("600519", 99999);
    const quote = engine.getState().quotes.find((item) => item.symbol === "600519");
    assert.ok(quote);
    assert.ok(quote.price <= quote.limitUp + 0.001);
    assert.ok(quote.price >= quote.limitDown - 0.001);

    engine.debugSetTime(shanghaiEpoch(2026, 9, 12, 15, 40, 0));
    const closed = engine.placeOrder({
      symbol: "600519",
      side: "buy",
      type: "market",
      qty: 100,
    });
    assert.equal(closed.ok, false);
  });

  it("releases today's shares on the next session", () => {
    const engine = fresh();
    const bought = engine.placeOrder({
      symbol: "600900",
      side: "buy",
      type: "market",
      qty: 100,
    });
    assert.equal(bought.ok, true);
    assert.equal(engine.getState().positions[0]?.available, 0);
    const previous = engine.getState().quotes.find((item) => item.symbol === "600900")?.price;
    engine.debugSetTime(shanghaiEpoch(2026, 9, 12, 15, 10, 0));
    engine.jumpToNextOpen();
    const next = engine.getState();
    assert.equal(next.session, "open");
    assert.equal(formatSimTime(next.simTime).date, "2026-10-13");
    assert.equal(next.positions[0]?.available, 100);
    const rolled = next.quotes.find((item) => item.symbol === "600900");
    assert.equal(rolled?.prevClose, previous);
  });

  it("round-trips through persistence", () => {
    const engine = fresh();
    engine.placeOrder({ symbol: "510300", side: "buy", type: "market", qty: 200 });
    const saved = engine.serialize();
    const restored = MarketEngine.restore(saved, flatRng);
    const left = engine.getState();
    const right = restored.getState();
    assert.equal(right.cash, left.cash);
    assert.equal(right.positions[0]?.qty, 200);
    assert.equal(right.quotes.find((item) => item.symbol === "510300")?.price, left.quotes.find((item) => item.symbol === "510300")?.price);
  });
});
