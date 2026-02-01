import { describe, expect, test } from "vitest";
import { ColorableMergedView } from "../src";

describe("getGeometryID: ReDoS resistance", () => {
  const view = new ColorableMergedView({});

  /**
   * Generate malicious input designed to cause backtracking in vulnerable regexes.
   * Pattern: "a_" repeated n times, then "X" (non-digit terminator)
   */
  const generateMaliciousInput = (n: number): string => {
    return `${"a_".repeat(n)}X`;
  };

  test(
    "should reject malicious input quickly (1,000 underscores)",
    { timeout: 100 },
    () => {
      const input = generateMaliciousInput(1000);
      expect(() => view.getGeometryID(input)).toThrow();
    },
  );

  test(
    "should reject malicious input quickly (10,000 underscores)",
    { timeout: 100 },
    () => {
      const input = generateMaliciousInput(10000);
      expect(() => view.getGeometryID(input)).toThrow();
    },
  );

  test(
    "should reject malicious input quickly (100,000 underscores)",
    { timeout: 100 },
    () => {
      const input = generateMaliciousInput(100000);
      expect(() => view.getGeometryID(input)).toThrow();
    },
  );

  test("should handle valid input correctly", { timeout: 100 }, () => {
    const input = "prefix_category_123";
    const result = view.getGeometryID(input);
    expect(result).toBe(123);
  });
});
