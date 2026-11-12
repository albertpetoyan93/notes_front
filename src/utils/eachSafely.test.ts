import { describe, expect, it } from "vitest";
import { eachSafely } from "./eachSafely";

describe("eachSafely", () => {
  it("runs every item even when one fails, and returns the failures", async () => {
    const done: number[] = [];
    const failures = await eachSafely([1, 2, 3], async (n) => {
      if (n === 2) throw new Error("409 race");
      done.push(n);
    });
    expect(done).toEqual([1, 3]);
    expect(failures).toEqual([{ item: 2, error: expect.objectContaining({ message: "409 race" }) }]);
  });
});
