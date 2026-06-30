import { z } from "zod";

/**
 * The structured result the agent must return for every "is this true?" run.
 *
 * This schema is shared by both sides of the app:
 * - The browser passes it to `agent.send({ outputSchema: verdictSchema })`, so
 *   the model is forced to satisfy it before the turn settles.
 * - The verdict card reads `Verdict` to render the result.
 *
 * Keep it small and presentational — it is the contract between the model and
 * the UI.
 */
export const verdictSchema = z.object({
  /** The claim the agent actually evaluated, normalized into a single sentence. */
  claim: z.string().describe("The claim being fact-checked, restated in one clear sentence."),
  /** The overall call. */
  verdict: z
    .enum(["true", "false", "misleading", "unverifiable"])
    .describe(
      "Overall judgment based on evidence found on X. Use 'misleading' for claims that are technically true but missing crucial context, and 'unverifiable' when X does not have enough evidence either way.",
    ),
  /** How sure the agent is, given the evidence it found on X. */
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("How strongly the evidence found on X supports the verdict."),
  /** Short, plain-language explanation of the verdict. */
  summary: z
    .string()
    .describe("Two to four sentences explaining the verdict in plain language."),
  /** The posts / sources on X that informed the verdict. */
  evidence: z
    .array(
      z.object({
        quote: z
          .string()
          .describe("A short quote or paraphrase of what the X post or source says."),
        author: z
          .string()
          .optional()
          .describe("The X handle or display name of the source, if known (e.g. @nasa)."),
        url: z
          .string()
          .optional()
          .describe("Direct link to the X post or source, if available."),
        stance: z
          .enum(["supports", "refutes", "context"])
          .describe("Whether this source supports, refutes, or merely adds context to the claim."),
      }),
    )
    .describe("The X posts and sources the verdict is based on. Include 2-5 when possible."),
});

export type Verdict = z.infer<typeof verdictSchema>;

export type VerdictLabel = Verdict["verdict"];
export type VerdictConfidence = Verdict["confidence"];
export type VerdictEvidence = Verdict["evidence"][number];
