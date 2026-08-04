import { BOT_USERNAME } from "@/lib/telegram/bot";

/**
 * The way students get in: one tap into the bot, which checks they have joined
 * the channel, asks who they are, and sends back a one-time link. No password
 * to choose, and none to forget.
 */
export function TelegramSignIn({ label }: { label: string }) {
  return (
    <a
      href={`https://t.me/${BOT_USERNAME}?start=login`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2.5 rounded-[10px] bg-[#229ed9] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1b87b9]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M21.94 4.72 18.62 20.4c-.25 1.1-.9 1.38-1.83.86l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.16 9.4-8.49c.41-.36-.09-.56-.63-.2L5.19 13.5.18 11.93c-1.09-.34-1.11-1.09.23-1.61l19.6-7.56c.9-.34 1.7.2 1.4 1.66l.53.3z" />
      </svg>
      {label}
    </a>
  );
}
