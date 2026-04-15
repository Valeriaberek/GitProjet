import assert from "node:assert/strict";
import test from "node:test";

import { testWebFunction } from "./test";

test("should return formatted message", () => {
  assert.equal(testWebFunction("hello"), "Web test OK: hello");
});

test("should trim spaces before returning message", () => {
  assert.equal(testWebFunction("  hello  "), "Web test OK: hello");
});
