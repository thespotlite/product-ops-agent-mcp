import assert from "node:assert/strict";
import test from "node:test";
import { LIMIT_ERROR, validateSql } from "../src/validation";

function rejected(sql: string, rule: string) {
  const result = validateSql(sql);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.rejectedBy, rule);
}

test("statement-type rule rejects a non-query", () => {
  rejected("DROP TABLE x", "statement_type");
});

test("semicolon rule rejects a trailing or embedded statement separator", () => {
  rejected("SELECT 1; SELECT 2", "semicolon");
});

test("comment rule rejects SQL comments", () => {
  rejected("SELECT * FROM table -- comment LIMIT 1", "comment");
  rejected("SELECT /* comment */ * FROM table LIMIT 1", "comment");
});

test("length rule rejects normalized SQL longer than 8000 characters", () => {
  rejected(`SELECT '${"x".repeat(8001)}' FROM table LIMIT 1`, "length");
});

test("keyword rule rejects a mutation that begins with WITH", () => {
  rejected("WITH t AS (SELECT 1) DELETE FROM table LIMIT 1", "forbidden_keyword");
});

test("keyword rule ignores words inside single-quoted literals", () => {
  const sql = `SELECT * FROM table WHERE "Other Info" LIKE '%INTO%' LIMIT 10`;
  assert.equal(validateSql(sql).ok, true);
});

test("REPLACE scalar function is allowed", () => {
  assert.equal(validateSql("SELECT REPLACE(cusname,'Inc','') FROM table LIMIT 10").ok, true);
});

test("limit rule rejects a missing LIMIT", () => {
  const result = validateSql("SELECT * FROM table");
  assert.deepEqual(result, { ok: false, message: LIMIT_ERROR, rejectedBy: "limit" });
});

test("limit rule rejects LIMIT above 5000", () => {
  rejected("SELECT * FROM table LIMIT 5001", "limit");
});

test("limit boundary accepts 5000 and preserves original SQL whitespace", () => {
  const sql = "  SELECT  'two   spaces'\nFROM table LIMIT 5000  ";
  const result = validateSql(sql);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.limit, 5000);
    assert.equal(result.sql, sql);
  }
});
