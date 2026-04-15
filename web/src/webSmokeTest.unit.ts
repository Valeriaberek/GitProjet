import assert from "node:assert/strict";
import test from "node:test";

import { isWebSmokeTestPassing } from "./webSmokeTest";

test("should return true for non-empty string", () => {
  assert.equal(isWebSmokeTestPassing("hello"), true);
});

test("should return false for blank string", () => {
  assert.equal(isWebSmokeTestPassing("   "), false);
});
