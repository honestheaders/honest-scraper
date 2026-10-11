import assert from "node:assert/strict";
import { toTSV, toCSV, toJSON, uniqueNames, fileName, noFormula } from "../lib/format.js";

assert.equal(toTSV(["a", "b"], [["1", "x y"]]), "a\tb\n1\tx y");
assert.equal(toTSV(["a"], [["l1\nl2"]]), 'a\n"l1\nl2"');
assert.equal(toTSV(["a"], [['say "hi"']]), 'a\n"say ""hi"""');
assert.equal(toCSV(["a", "b"], [["x,y", "ok"]]), 'a,b\r\n"x,y",ok\r\n');
assert.equal(noFormula("=SUM(A1)"), "'=SUM(A1)");
assert.equal(noFormula("@x"), "'@x");
assert.equal(noFormula("-12.5"), "-12.5");
assert.equal(noFormula("- item"), "- item".replace(/^/, "'"));
assert.equal(noFormula("$1,200"), "$1,200");
assert.deepEqual(uniqueNames(["a", "a", ""]), ["a", "a (2)", "Column 3"]);
assert.deepEqual(JSON.parse(toJSON(["n", "n"], [["1", "2"]])), [{ n: "1", "n (2)": "2" }]);
assert.equal(fileName('My: "page"/1', "csv"), "My page 1.csv");
assert.equal(fileName("", "tsv"), "scrape.tsv");
console.log("format tests ok");
