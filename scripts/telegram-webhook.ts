import "dotenv/config";

/**
 * Points the bot at this server, or shows where it currently points.
 *
 *   npm run telegram:webhook -- --set
 *   npm run telegram:webhook -- --info
 *   npm run telegram:webhook -- --delete
 *
 * Reads TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_SITE_URL and TELEGRAM_WEBHOOK_SECRET
 * from the environment — the token is never passed on the command line, where
 * it would land in shell history.
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const site = process.env.NEXT_PUBLIC_SITE_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set. Add it to .env first.");
  process.exit(1);
}

const mode = process.argv.includes("--delete")
  ? "delete"
  : process.argv.includes("--info")
    ? "info"
    : "set";

async function api(method: string, body?: unknown) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

async function main() {
  if (mode === "info") {
    const info = await api("getWebhookInfo");
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (mode === "delete") {
    console.log(JSON.stringify(await api("deleteWebhook", {}), null, 2));
    return;
  }

  if (!site) {
    console.error("NEXT_PUBLIC_SITE_URL is not set.");
    process.exit(1);
  }
  if (!secret) {
    console.error(
      "TELEGRAM_WEBHOOK_SECRET is not set. Generate one with `openssl rand -hex 24`\n" +
        "and add it to .env — without it anyone who guesses the URL can post updates.",
    );
    process.exit(1);
  }

  const result = await api("setWebhook", {
    url: `${site}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  console.log(JSON.stringify(result, null, 2));
  console.log(`\nWebhook -> ${site}/api/telegram/webhook`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
