"use client";

import { useEveAgent } from "eve/react";
import type { EveMessage } from "eve/react";
import {
  AlertTriangleIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  HelpCircleIcon,
  InfoIcon,
  RotateCcwIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tweet } from "react-tweet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  type Verdict,
  type VerdictEvidence,
  type VerdictLabel,
  verdictSchema,
} from "@/lib/verdict";

const EXAMPLES = [
  "The Great Wall of China is visible from space",
  "Drinking coffee stunts your growth",
  "https://x.com/jack/status/20",
] as const;

export function IsThisTrue() {
  const agent = useEveAgent();
  const [input, setInput] = useState("");
  const [claim, setClaim] = useState("");
  const [tweetId, setTweetId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea to fit its content (CSS max-height caps it, then it scrolls).
  // Runs on every `input` change, so typing and programmatic updates both resize.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  // The structured verdict arrives on the latest `result.completed` stream event.
  const verdict = useMemo<Verdict | undefined>(() => {
    let result: Verdict | undefined;
    for (const event of agent.events) {
      if (event.type === "result.completed") {
        result = event.data.result as Verdict;
      }
    }
    return result;
  }, [agent.events]);

  // Surface what the agent is doing right now (which X tools it is calling).
  const activity = useMemo(() => latestActivity(agent.data.messages), [agent.data.messages]);

  const runCheck = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    setInput(trimmed);
    setClaim(trimmed);
    setTweetId(extractTweetId(trimmed));
    agent.reset();
    await agent.send<Verdict>({ message: trimmed, outputSchema: verdictSchema });
  };

  const hasRun = isBusy || verdict !== undefined || Boolean(agent.error);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-10 sm:py-16">
      <header className={cn("flex flex-col items-center text-center", hasRun ? "gap-2" : "gap-3")}>
        <h1
          className={cn(
            "font-semibold tracking-tighter transition-all",
            hasRun ? "text-3xl" : "text-5xl sm:text-6xl",
          )}
        >
          is this true?
        </h1>
        {hasRun ? null : (
          <p className="text-balance text-muted-foreground">
            Paste a tweet or type a claim. We&apos;ll check it against what&apos;s actually being
            said on X.
          </p>
        )}
      </header>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void runCheck(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
          <textarea
            ref={textareaRef}
            aria-label="Claim or tweet link"
            className="max-h-[60vh] min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void runCheck(input);
              }
            }}
            placeholder="eve, is this true?"
            rows={1}
            value={input}
          />
          <Button
            aria-label="Check"
            className="rounded-xl"
            disabled={isBusy || input.trim().length === 0}
            size="icon"
            type="submit"
          >
            {isBusy ? <Spinner /> : <ArrowUpIcon />}
          </Button>
        </div>
      </form>

      {!hasRun ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button
              className="rounded-full border bg-card px-3 py-1.5 text-left text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              key={example}
              onClick={() => void runCheck(example)}
              type="button"
            >
              {truncate(example, 48)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-8 flex-1 space-y-4">
        {tweetId ? <TweetEmbed id={tweetId} /> : null}
        {agent.error ? (
          <ErrorCard message={agent.error.message} onRetry={() => void runCheck(claim)} />
        ) : verdict ? (
          <VerdictCard onReset={reset(agent, setInput, setClaim, setTweetId)} verdict={verdict} />
        ) : isBusy ? (
          <Investigating activity={activity} claim={claim} isTweet={tweetId !== null} />
        ) : null}
      </div>

      {hasRun ? (
        <p className="mt-8 text-balance text-center text-muted-foreground text-xs">
          Automated AI fact-check based on posts found on X. It can be wrong — verify anything that
          matters.
        </p>
      ) : null}
    </main>
  );
}

function Investigating({
  activity,
  claim,
  isTweet,
}: {
  activity: string | null;
  claim: string;
  isTweet: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <ProgressBar />
      <div className="p-5">
        <p className="text-muted-foreground text-sm">
          {isTweet ? "Checking this tweet against X…" : "Checking this claim:"}
        </p>
        {isTweet ? null : <p className="mt-1 font-medium">{claim}</p>}
        <div className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
          <SearchIcon className="size-4 shrink-0 animate-pulse" />
          <span>{activity ?? "Searching X…"}</span>
        </div>
      </div>
    </div>
  );
}

function ProgressBar() {
  return (
    <div className="h-0.5 w-full overflow-hidden bg-muted" role="progressbar" aria-label="Working">
      <div className="h-full w-1/3 animate-[indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-foreground/70" />
    </div>
  );
}

function TweetEmbed({ id }: { id: string }) {
  return (
    <div className="flex justify-center [&_.react-tweet-theme]:my-0">
      <Tweet id={id} />
    </div>
  );
}

function VerdictCard({ onReset, verdict }: { onReset: () => void; verdict: Verdict }) {
  const style = VERDICT_STYLES[verdict.verdict];
  const Icon = style.icon;

  return (
    <article className={cn("rounded-2xl border p-5", style.card)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon className={cn("size-7", style.text)} />
          <div>
            <p className={cn("font-semibold text-xl leading-none", style.text)}>{style.label}</p>
            <p className="mt-1 text-muted-foreground text-xs">
              {confidenceLabel(verdict.confidence)} confidence
            </p>
          </div>
        </div>
        <Button onClick={onReset} size="sm" variant="ghost">
          <RotateCcwIcon />
          New check
        </Button>
      </div>

      <p className="mt-4 font-medium text-foreground">{verdict.claim}</p>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{verdict.summary}</p>

      {verdict.evidence.length > 0 ? (
        <div className="mt-5">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Evidence from X
          </p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {verdict.evidence.map((item, index) => (
              <EvidenceRow item={item} key={`${item.url ?? item.quote}-${index}`} />
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function EvidenceRow({ item }: { item: VerdictEvidence }) {
  const stance = STANCE_STYLES[item.stance];
  const StanceIcon = stance.icon;

  return (
    <li className="rounded-xl border bg-background/60 p-3">
      <div className="flex items-start gap-2.5">
        <StanceIcon className={cn("mt-0.5 size-4 shrink-0", stance.text)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed">{item.quote}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
            {item.author ? <span className="font-medium">{item.author}</span> : null}
            <Badge className="px-1.5 py-0 font-normal" variant="outline">
              {stance.label}
            </Badge>
            {item.url ? (
              <a
                className="text-primary underline-offset-2 hover:underline"
                href={item.url}
                rel="noreferrer"
                target="_blank"
              >
                View on X
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="font-medium">Couldn&apos;t finish the check</p>
        <p className="mt-1 text-muted-foreground text-sm">{message}</p>
        <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}

const VERDICT_STYLES: Record<
  VerdictLabel,
  { label: string; icon: typeof CheckCircle2Icon; text: string; card: string }
> = {
  true: {
    label: "Looks true",
    icon: CheckCircle2Icon,
    text: "text-emerald-600 dark:text-emerald-400",
    card: "border-emerald-500/30 bg-emerald-500/5",
  },
  false: {
    label: "Looks false",
    icon: XCircleIcon,
    text: "text-red-600 dark:text-red-400",
    card: "border-red-500/30 bg-red-500/5",
  },
  misleading: {
    label: "Misleading",
    icon: AlertTriangleIcon,
    text: "text-amber-600 dark:text-amber-400",
    card: "border-amber-500/30 bg-amber-500/5",
  },
  unverifiable: {
    label: "Unverifiable",
    icon: HelpCircleIcon,
    text: "text-muted-foreground",
    card: "border-border bg-muted/30",
  },
};

const STANCE_STYLES: Record<
  VerdictEvidence["stance"],
  { label: string; icon: typeof CheckCircle2Icon; text: string }
> = {
  supports: {
    label: "Supports",
    icon: CheckCircle2Icon,
    text: "text-emerald-600 dark:text-emerald-400",
  },
  refutes: { label: "Refutes", icon: XCircleIcon, text: "text-red-600 dark:text-red-400" },
  context: { label: "Context", icon: InfoIcon, text: "text-muted-foreground" },
};

function confidenceLabel(confidence: Verdict["confidence"]): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function latestActivity(messages: readonly EveMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    for (let j = message.parts.length - 1; j >= 0; j--) {
      const part = message.parts[j];
      if (part.type === "dynamic-tool") {
        return describeTool(part.toolName);
      }
    }
  }
  return null;
}

function describeTool(toolName: string): string {
  if (toolName === "connection_search") return "Finding the right X tools…";
  if (toolName.startsWith("x__")) {
    const action = toolName.slice(3).replace(/_/g, " ");
    return `Querying X: ${action}…`;
  }
  return `Running ${toolName.replace(/_/g, " ")}…`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function extractTweetId(input: string): string | null {
  const match = input.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  return match ? match[1] : null;
}

function reset(
  agent: ReturnType<typeof useEveAgent>,
  setInput: (value: string) => void,
  setClaim: (value: string) => void,
  setTweetId: (value: string | null) => void,
) {
  return () => {
    agent.reset();
    setInput("");
    setClaim("");
    setTweetId(null);
  };
}
