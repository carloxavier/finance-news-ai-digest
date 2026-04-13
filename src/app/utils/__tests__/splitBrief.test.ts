import { splitBriefIntoPoints } from "../splitBrief";

describe("splitBriefIntoPoints", () => {
  it("splits simple sentences", () => {
    expect(splitBriefIntoPoints("First sentence. Second sentence.")).toEqual([
      "First sentence.",
      "Second sentence.",
    ]);
  });

  it("handles exclamation and question marks", () => {
    expect(splitBriefIntoPoints("Really? Yes! Okay.")).toEqual([
      "Really?",
      "Yes!",
      "Okay.",
    ]);
  });

  it("keeps citation markers attached to their sentence", () => {
    expect(
      splitBriefIntoPoints("Revenue grew 10%.[1] Margins fell.[2][3]")
    ).toEqual(["Revenue grew 10%.[1]", "Margins fell.[2][3]"]);
  });

  it("keeps citations with spaces attached", () => {
    expect(
      splitBriefIntoPoints("Revenue grew 10%. [1] Margins fell. [2]")
    ).toEqual(["Revenue grew 10%. [1]", "Margins fell. [2]"]);
  });

  it("returns the full text as one item when there is no punctuation", () => {
    expect(splitBriefIntoPoints("No punctuation here")).toEqual([
      "No punctuation here",
    ]);
  });

  it("handles a single sentence with trailing period", () => {
    expect(splitBriefIntoPoints("Just one sentence.")).toEqual([
      "Just one sentence.",
    ]);
  });

  it("filters out empty strings from extra whitespace", () => {
    expect(splitBriefIntoPoints("A.  B.")).toEqual(["A.", "B."]);
  });
});
