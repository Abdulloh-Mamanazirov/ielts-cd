import Link from "next/link";
import { notFound } from "next/navigation";

import { StartEventSitting } from "@/components/app/StartEventSitting";
import { LogoMark } from "@/components/marketing/Brand";
import { SkillIcon } from "@/components/SkillIcon";
import { getSessionUser } from "@/lib/auth/session";
import { eventForJoin, joinRefusal } from "@/lib/events/service";
import { BOT_USERNAME } from "@/lib/telegram/bot";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The page behind an event's private link.
 *
 * Deliberately not the app shell: the people arriving here have never seen
 * the site, and the only thing they need is a name for what they are about to
 * sit and one button. Signed-out visitors get the Telegram button here rather
 * than a redirect to /login, so the bot can bring them straight back.
 */
export default async function JoinEventPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(token)) notFound();

  const user = await getSessionUser();
  const event = await eventForJoin(token, user?.id ?? null);
  if (!event) notFound();

  const sitting = event.participant?.fullMock ?? null;
  const refusal = sitting
    ? null
    : joinRefusal({
        status: event.status,
        closesAt: event.closesAt,
        maxParticipants: event.maxParticipants,
        participantCount: event._count.participants,
        alreadyIn: Boolean(event.participant),
      });

  const sections = [
    { skill: "listening", title: event.listeningTest.title, minutes: event.listeningTest.durationSeconds / 60 },
    { skill: "reading", title: event.readingTest.title, minutes: event.readingTest.durationSeconds / 60 },
    { skill: "writing", title: event.writingTest.title, minutes: event.writingTest.durationSeconds / 60 },
  ];

  return (
    <main className="min-h-dvh bg-surface-alt">
      <div className="mx-auto max-w-2xl px-5 py-10 lg:py-16">
        <Link href="/" className="inline-flex items-center gap-3">
          <LogoMark size={28} />
          <span className="font-display text-[13px] text-ink">DN IELTS</span>
        </Link>

        <section className="mt-8 rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(11,17,32,.08)] lg:p-9">
          <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red">MOCK TEST</p>
          <h1 className="mt-2 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-[1] tracking-[-0.03em] text-ink">
            {event.title}
          </h1>
          {event.description && (
            <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-ink-muted text-pretty">
              {event.description}
            </p>
          )}

          <ol className="mt-7 space-y-px bg-rule">
            {sections.map((section, index) => {
              const attempt = sitting?.attempts[index];
              const done = attempt?.status === "SUBMITTED";
              return (
                <li
                  key={section.skill}
                  className="flex items-center gap-4 bg-surface-alt px-4 py-3.5"
                >
                  <SkillIcon
                    skill={section.skill}
                    size={18}
                    className={cn("flex-none", done ? "text-ok" : "text-brand-blue")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold capitalize text-ink">{section.skill}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {Math.round(section.minutes)} minutes
                    </p>
                  </div>
                  {done && (
                    <span className="text-[11px] font-bold tracking-[0.08em] text-ok">
                      {attempt.band !== null
                        ? attempt.band.toFixed(1)
                        : section.skill === "writing"
                          ? "AWAITING MARKING"
                          : "SUBMITTED"}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <p className="mt-5 text-[13px] leading-relaxed text-ink-muted">
            Sections run in exam order and each one is timed on its own — the clock starts when
            you open that section, so you can take a break between them. Listening and reading are
            marked the moment you finish. Your essays are marked by the instructor, and your
            overall band appears once that is done.
          </p>

          <div className="mt-7">
            {refusal && !sitting ? (
              // Said before the sign-up step: nobody should create an account
              // for an event that will then turn them away.
              <Refusal reason={refusal} />
            ) : !user ? (
              <>
                <a
                  href={`https://t.me/${BOT_USERNAME}?start=join_${token}`}
                  className="flex items-center justify-center gap-2.5 rounded-[10px] bg-[#229ed9] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1b87b9]"
                >
                  <TelegramGlyph />
                  Continue with Telegram
                </a>
                <p className="mt-2.5 text-center text-xs text-ink-subtle">
                  One tap creates your account, or signs you in, and brings you back here.
                </p>
              </>
            ) : sitting ? (
              sitting.status === "COMPLETED" ? (
                <Result overallBand={sitting.overallBand} />
              ) : (
                <StartEventSitting eventId={event.id} mode="continue" />
              )
            ) : (
              <StartEventSitting eventId={event.id} mode="start" />
            )}
          </div>
        </section>

        {user && (
          <p className="mt-5 text-center text-xs text-ink-subtle">
            Signed in as <span className="font-semibold text-ink-muted">{user.fullName}</span> ·{" "}
            <Link href="/dashboard" className="font-semibold text-brand-blue hover:underline">
              Dashboard
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

function Result({ overallBand }: { overallBand: number | null }) {
  return (
    <div className="rounded-[10px] bg-ink px-5 py-4 text-white">
      <p className="text-[10px] font-bold tracking-[0.22em] text-white/60">YOUR RESULT</p>
      <p className="mt-1.5 font-display text-3xl leading-none text-brand-red">
        {overallBand !== null ? overallBand.toFixed(1) : "—"}
      </p>
      <p className="mt-2 text-xs text-white/70">
        {overallBand !== null
          ? "Overall band. Open your dashboard for each section."
          : "Your essays are with the instructor. The overall band appears here once they are marked."}
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-block rounded-lg bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white hover:text-ink"
      >
        Open dashboard →
      </Link>
    </div>
  );
}

function Refusal({ reason }: { reason: "not_found" | "not_open" | "closed" | "full" }) {
  const text = {
    not_found: "This link is not valid.",
    not_open: "This mock test has not opened yet. Check back later.",
    closed: "This mock test has closed and is no longer accepting entries.",
    full: "This mock test is full.",
  }[reason];
  return (
    <p className="rounded-[10px] bg-surface-alt px-4 py-3.5 text-sm font-semibold text-ink-muted">
      {text}
    </p>
  );
}

function TelegramGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.72 18.62 20.4c-.25 1.1-.9 1.38-1.83.86l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.16 9.4-8.49c.41-.36-.09-.56-.63-.2L5.19 13.5.18 11.93c-1.09-.34-1.11-1.09.23-1.61l19.6-7.56c.9-.34 1.7.2 1.4 1.66l.53.3z" />
    </svg>
  );
}
