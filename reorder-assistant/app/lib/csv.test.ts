import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    expect(toCsv(["a", "b"], [['Tee, "large"', "line\nbreak"]])).toBe(
      'a,b\r\n"Tee, ""large""","line\nbreak"',
    );
  });

  it("writes blanks for missing values", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, 0]])).toBe("a,b,c\r\n,,0");
  });

  it("neutralises spreadsheet formulas in text but not numbers", () => {
    expect(toCsv(["a", "b"], [["=HYPERLINK(1)", -5]])).toBe(
      "a,b\r\n'=HYPERLINK(1),-5",
    );
  });
});
