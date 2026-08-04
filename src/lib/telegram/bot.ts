import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";

/**
 * The registration bot.
 *
 * Students never type a password: they talk to @dn_ielts_reg_bot, which checks
 * they have joined the channel, asks their name, whether they already study
 * with the instructor and (optionally) their phone number, then sends back a
 * one-time link that turns the chat into a browser session.
 *
 * The token is read from the environment and never appears in the repository.
 * The instructor sets TELEGRAM_BOT_TOKEN in /srv/ielts/.env.
 */

const API = "https://api.telegram.org";

export const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "dn_ielts_reg_bot";
/** The channel a student has to join before they can register. */
export const REQUIRED_CHANNEL = process.env.TELEGRAM_CHANNEL ?? "@DN_IELTS";
/** Where the bot sends its finished link. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dn-ielts.uz";

const LOGIN_TOKEN_TTL_MINUTES = 15;

function token(): string {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return value;
}

export function botConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

async function call<T>(method: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${API}/bot${token()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await response.json()) as { ok: boolean; result?: T };
    return data.ok ? (data.result ?? null) : null;
  } catch {
    return null;
  }
}

type Keyboard = {
  inline_keyboard?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  keyboard?: Array<Array<{ text: string; request_contact?: boolean }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  remove_keyboard?: boolean;
};

export async function sendMessage(chatId: string, text: string, keyboard?: Keyboard) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

/**
 * Whether the user has joined the channel.
 *
 * Deliberately fails open: if the bot has not been made an administrator of the
 * channel the API returns an error, and refusing every sign-up because of a
 * configuration step would be worse than letting people in. The check starts
 * working the moment the bot is promoted.
 */
export async function hasJoinedChannel(telegramId: string): Promise<boolean> {
  const result = await call<{ status: string }>("getChatMember", {
    chat_id: REQUIRED_CHANNEL,
    user_id: Number(telegramId),
  });
  if (!result) return true;
  return ["creator", "administrator", "member", "restricted"].includes(result.status);
}

/** Issues a single-use login link. Only the hash is stored. */
export async function issueLoginLink(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");

  await prisma.loginToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });

  return `${SITE_URL}/auth/telegram?token=${raw}`;
}

/**
 * Consumes a login token and returns the account it belongs to.
 * Single use: a link that has been followed once cannot be replayed.
 */
export async function consumeLoginToken(raw: string): Promise<string | null> {
  const tokenHash = createHash("sha256").update(raw).digest("hex");

  const record = await prisma.loginToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return null;

  await prisma.loginToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });
  return record.userId;
}
