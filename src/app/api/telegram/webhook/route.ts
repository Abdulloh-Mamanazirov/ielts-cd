import { prisma } from "@/lib/db";
import {
  answerCallback,
  botConfigured,
  hasJoinedChannel,
  issueLoginLink,
  REQUIRED_CHANNEL,
  sendMessage,
} from "@/lib/telegram/bot";

/**
 * The registration conversation.
 *
 * /start -> check the channel -> name -> "do you study with Davronbek?" ->
 * phone (optional) -> account created -> one-time login link.
 *
 * Telegram calls this endpoint. It is protected by the secret token set when
 * the webhook is registered, which Telegram echoes in a header; without that
 * anyone who guessed the path could impersonate the bot's users.
 */

export const dynamic = "force-dynamic";

type Update = {
  message?: {
    chat: { id: number };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number };
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string; last_name?: string };
    data?: string;
    message?: { chat: { id: number } };
  };
};

function ok() {
  // Always 200: a non-2xx makes Telegram retry the same update forever.
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!botConfigured()) return ok();

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return ok();
  }

  const from = update.message?.from ?? update.callback_query?.from;
  const chatId = String(
    update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? from?.id ?? "",
  );
  if (!from || !chatId) return ok();

  const telegramId = String(from.id);
  const username = from.username ?? null;
  const text = update.message?.text?.trim();
  const data = update.callback_query?.data;
  const contact = update.message?.contact;

  // The sign-in button on the site is a deep link, so Telegram delivers
  // "/start login" rather than a bare "/start". Match the command, not the
  // whole message, or the very first thing a student sends falls through to
  // the "press /start" branch.
  const command = (name: string) => new RegExp(`^/${name}(?:@\\w+)?(?:\\s|$)`).test(text ?? "");
  const isStart = command("start");
  const isLogin = command("login");

  // Already registered: hand them a fresh link rather than starting again.
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, fullName: true },
  });

  if (existing && (isStart || isLogin)) {
    const link = await issueLoginLink(existing.id);
    await sendMessage(
      chatId,
      `Welcome back, ${escapeHtml(existing.fullName)}.\n\n<a href="${link}">Open your dashboard</a>\n\nThe link works once and expires in 15 minutes.`,
    );
    return ok();
  }

  /** Asks for the name and opens the registration. */
  const beginRegistration = async () => {
    await prisma.telegramRegistration.upsert({
      where: { telegramId },
      create: { telegramId, step: "NAME", username },
      update: { step: "NAME", username, fullName: null, isStudent: null },
    });

    const suggested = [from.first_name, from.last_name].filter(Boolean).join(" ");
    await sendMessage(
      chatId,
      `Welcome to <b>DN IELTS</b>.\n\nWhat is your full name?${
        suggested ? `\n\nSend it, or tap the suggestion below.` : ""
      }`,
      suggested
        ? { keyboard: [[{ text: suggested }]], resize_keyboard: true, one_time_keyboard: true }
        : undefined,
    );
  };

  /**
   * The join prompt. Two buttons on purpose: one to open the channel, and one
   * to come back and say so — without the second there is nothing to press
   * after joining, and the conversation just stops.
   */
  const askToJoin = async (again = false) =>
    sendMessage(
      chatId,
      again
        ? `You are not in the channel yet. Join it, then tap <b>I've joined</b> again.`
        : `One step first: please join our channel.\n\nOnce you have, tap <b>I've joined</b> below.`,
      {
        inline_keyboard: [
          [{ text: "📣 Open the channel", url: `https://t.me/${REQUIRED_CHANNEL.replace(/^@/, "")}` }],
          [{ text: "✅ I've joined", callback_data: "joined" }],
        ],
      },
    );

  if (isStart) {
    if (!(await hasJoinedChannel(telegramId))) {
      await askToJoin();
      return ok();
    }
    await beginRegistration();
    return ok();
  }

  // "I've joined" — re-check rather than take their word for it.
  if (data === "joined") {
    if (update.callback_query) await answerCallback(update.callback_query.id);
    if (!(await hasJoinedChannel(telegramId))) {
      await askToJoin(true);
      return ok();
    }
    await beginRegistration();
    return ok();
  }

  const registration = await prisma.telegramRegistration.findUnique({ where: { telegramId } });
  if (!registration) {
    await sendMessage(chatId, "Press /start to begin.");
    return ok();
  }

  // Step 1 — the name.
  if (registration.step === "NAME" && text) {
    const fullName = text.slice(0, 120);
    await prisma.telegramRegistration.update({
      where: { telegramId },
      data: { fullName, step: "STUDENT" },
    });

    await sendMessage(chatId, `Thanks, ${escapeHtml(fullName)}. Do you already study with Davronbek?`, {
      inline_keyboard: [
        [
          { text: "Yes, I'm his student", callback_data: "student:yes" },
          { text: "No, not yet", callback_data: "student:no" },
        ],
      ],
    });
    return ok();
  }

  // Step 2 — whether they are one of his students.
  if (registration.step === "STUDENT" && data?.startsWith("student:")) {
    if (update.callback_query) await answerCallback(update.callback_query.id);
    await prisma.telegramRegistration.update({
      where: { telegramId },
      data: { isStudent: data === "student:yes", step: "PHONE" },
    });

    await sendMessage(
      chatId,
      "Last step: share your phone number so your instructor can reach you. This is optional.",
      {
        keyboard: [[{ text: "📱 Share my number", request_contact: true }], [{ text: "Skip" }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    );
    return ok();
  }

  // Step 3 — the phone, or skipping it. Either way the account is created.
  if (registration.step === "PHONE" && (contact || text)) {
    const phone = contact?.phone_number ?? null;

    const user = await prisma.user.create({
      data: {
        fullName: registration.fullName ?? "Student",
        telegramId,
        telegramUsername: username,
        phone,
        isStudent: registration.isStudent ?? false,
        role: "STUDENT",
        plan: "FREE",
      },
      select: { id: true },
    });

    await prisma.telegramRegistration.delete({ where: { telegramId } }).catch(() => {});

    const link = await issueLoginLink(user.id);
    await sendMessage(
      chatId,
      `You're all set.\n\n<a href="${link}">Open your dashboard</a>\n\nThe link works once and expires in 15 minutes. Send /login any time for a new one.`,
      { remove_keyboard: true },
    );
    return ok();
  }

  await sendMessage(chatId, "Press /start to begin, or /login if you already have an account.");
  return ok();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
