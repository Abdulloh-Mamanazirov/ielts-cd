# Putting the platform on a server

Written 2026-07-31, for a fresh **Ubuntu 24.04 LTS** VPS. Run every command in
order. Anything in `CAPITALS` is a placeholder you replace:

| Placeholder | Means |
| --- | --- |
| `SERVER_IP` | the IPv4 address Contabo gave you |
| `example.com` | your domain |
| `abdulloh` | your own login on the server — use whatever name you like |

There are two accounts on the server by the end: **you**, who can `sudo`, and
**`ielts`**, which owns the app, runs it, and can restart nothing but itself.
That separation is why a mistake in the app cannot become a mistake in the
operating system.

Budget about an hour, most of it waiting for `apt` and for DNS.

---

## Before you start

- The domain, with access to wherever its DNS is managed.
- An SSH key on your Windows machine. Check with `ls ~/.ssh/*.pub`; if there is
  none:

  ```powershell
  ssh-keygen -t ed25519 -C "abdulloh@windows"
  ```

  Press Enter at every prompt except the passphrase, which is worth setting.
  The public key is the `.pub` file — that is the one that goes on servers. The
  other file never leaves your machine.
- Contabo's panel open, so you can paste that public key into the server's SSH
  key field while it is being set up. If the server is already provisioned with
  a root password instead, use Contabo's web console (VNC) to add the key by
  hand in step 1.

---

## 1. First login, and a user that is not root

```bash
ssh root@SERVER_IP
```

Make yourself an account and give it your key:

```bash
adduser --disabled-password --gecos "" abdulloh
usermod -aG sudo abdulloh
mkdir -p /home/abdulloh/.ssh
cp /root/.ssh/authorized_keys /home/abdulloh/.ssh/authorized_keys
chown -R abdulloh:abdulloh /home/abdulloh/.ssh
chmod 700 /home/abdulloh/.ssh
chmod 600 /home/abdulloh/.ssh/authorized_keys
```

If that `cp` says the file does not exist, the server was built with a root
password rather than a key. Create the file and paste your public key — the
contents of `id_ed25519.pub` from your own machine, one line — into it:

```bash
nano /home/abdulloh/.ssh/authorized_keys
```

then re-run the three ownership and permission commands above.

`--disabled-password` means the account has no password to guess; it can only be
reached with the key you just copied across. Since it has no password, `sudo`
must not ask for one:

```bash
echo 'abdulloh ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/abdulloh
chmod 440 /etc/sudoers.d/abdulloh
visudo -c
```

**Open a second terminal now** and check you can get in before you close the
first one:

```bash
ssh abdulloh@SERVER_IP
```

If that works, leave the root session open anyway until the end of step 2. It is
your way back in if the SSH config change goes wrong.

## 2. Lock SSH down

```bash
sudo tee /etc/ssh/sshd_config.d/00-hardening.conf >/dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
```

The filename starts with `00` on purpose. `sshd` takes the **first** value it
finds for each setting, and Ubuntu's cloud image ships
`/etc/ssh/sshd_config.d/50-cloud-init.conf` containing
`PasswordAuthentication yes`. A file named `99-` would be read after it and
lose. Never assume — check what the daemon actually resolved:

```bash
sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication'
```

You want `permitrootlogin no` and `passwordauthentication no`. Then:

```bash
sudo systemctl reload ssh
```

Open a third terminal and confirm `ssh abdulloh@SERVER_IP` still works. Now you
can close the root session.

## 3. Firewall, fail2ban, swap

```bash
sudo apt update && sudo apt upgrade -y
```

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

Nothing but SSH, HTTP and HTTPS is reachable from outside after this. Postgres
on 5432 and the app on 3000 are loopback-only, which is deliberate — the app is
reached through nginx and nothing else.

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.local >/dev/null <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
EOF
sudo systemctl restart fail2ban
```

Contabo images often have no swap, and `next build` is the heaviest thing this
server ever does. Two gigabytes costs nothing and turns "the build was killed"
into "the build was slow":

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Optional, but it makes every log and every seeded date read correctly:

```bash
sudo timedatectl set-timezone Asia/Tashkent
```

## 4. Node, PostgreSQL, nginx

Ubuntu's own Node is too old for Next 16, so take it from NodeSource. Node 22
LTS is what CI uses too — `.nvmrc` in the repo is the single source of truth for
that number.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

```bash
sudo apt install -y postgresql nginx certbot python3-certbot-nginx
```

Check all three:

```bash
node -v && psql --version && nginx -v
```

Node should be `v22.x`, Postgres `16.x`.

## 5. The app user, the database, the media directory

```bash
sudo adduser --disabled-password --gecos "" ielts
sudo mkdir -p /srv/ielts /var/lib/ielts/media
sudo chown -R ielts:ielts /srv/ielts /var/lib/ielts
```

The database password is generated here and pasted straight into `.env` in the
next step. Keep this terminal open until then — `$DB_PASSWORD` lives only in
this shell:

```bash
DB_PASSWORD="$(openssl rand -hex 24)"
sudo -u postgres psql -c "CREATE USER ielts WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE ielts OWNER ielts;"
```

Hex, not base64, because this password goes inside a URL and `+` and `/` would
have to be percent-encoded.

Now the permissions that make `X-Accel-Redirect` work. nginx runs as `www-data`
and has to be able to read files the app wrote as `ielts`:

```bash
sudo chgrp -R www-data /var/lib/ielts/media
sudo chmod 2750 /var/lib/ielts/media
```

The `2` is setgid: every file the app writes into that directory inherits the
`www-data` group, so nginx can read new uploads without anyone remembering to
fix permissions. Getting this wrong produces a listening test that authenticates
fine and then plays nothing, with a 404 from nginx in the log and nothing at all
in the app's.

## 6. The code and the `.env`

The server needs to read the repository. Give it its own read-only key rather
than your personal one:

```bash
sudo -u ielts ssh-keygen -t ed25519 -N "" -f /home/ielts/.ssh/id_ed25519 -C "ielts-server"
sudo cat /home/ielts/.ssh/id_ed25519.pub
```

Copy that line into GitHub → the repo → **Settings → Deploy keys → Add deploy
key**. Leave "Allow write access" unchecked. Then:

```bash
sudo -u ielts git clone git@github.com:Abdulloh-Mamanazirov/ielts-cd.git /srv/ielts
```

Say `yes` to the host key prompt.

Now the environment. Run this as **one block**, in the same terminal as step 5,
so `$DB_PASSWORD` is still set:

```bash
sudo -u ielts tee /srv/ielts/.env >/dev/null <<EOF
DATABASE_URL="postgresql://ielts:$DB_PASSWORD@localhost:5432/ielts?schema=public"
SESSION_SECRET="$(openssl rand -base64 32)"
MEDIA_STORAGE_DIR="/var/lib/ielts/media"
MEDIA_INTERNAL_PREFIX="protected-media"
NEXT_PUBLIC_SITE_URL="https://example.com"
EOF
sudo chmod 600 /srv/ielts/.env
```

Three things about that file:

- **`NEXT_PUBLIC_SITE_URL` must already say `https://example.com`**, before the
  certificate exists. Anything prefixed `NEXT_PUBLIC_` is compiled into the
  JavaScript the browser downloads, not read at run time, so changing it later
  means rebuilding. Write the address you will end up at.
- **`MEDIA_INTERNAL_PREFIX` is what turns the nginx handoff on.** Empty means
  Node reads and streams every byte itself. `protected-media` must match the
  `location` block in `deploy/nginx.conf`.
- **There is no `SEED_ADMIN_PASSWORD` line**, on purpose. It is read once, by
  the seed, in step 10 — there is no reason for an admin password to sit in a
  file on disk forever.

Check it back, and confirm the placeholder is gone:

```bash
sudo cat /srv/ielts/.env
```

## 7. First build

```bash
sudo -u ielts bash -c 'cd /srv/ielts && npm ci --no-audit --no-fund'
sudo -u ielts bash -c 'cd /srv/ielts && npx prisma generate'
sudo -u ielts bash -c 'cd /srv/ielts && npx prisma migrate deploy'
sudo -u ielts bash -c 'cd /srv/ielts && npm run build'
```

Migrations run before the build because the build is not passive: it prerenders
the home page and `/results`, both of which query the database. Against an empty
database it fails.

The build takes a few minutes. It should end with a route table listing `/`,
`/admin/showcase`, `/attempt/[id]` and the rest.

## 8. The service

```bash
sudo cp /srv/ielts/deploy/ielts.service /etc/systemd/system/ielts.service
sudo systemctl daemon-reload
sudo systemctl enable --now ielts
sudo systemctl status ielts --no-pager
```

It should say `active (running)`. Prove it is really serving:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

`200`. If not:

```bash
sudo journalctl -u ielts -n 50 --no-pager
```

Then let the deploy script restart it without a password, and nothing else:

```bash
echo 'ielts ALL=(root) NOPASSWD: /usr/bin/systemctl restart ielts' | sudo tee /etc/sudoers.d/ielts
sudo chmod 440 /etc/sudoers.d/ielts
sudo visudo -c
```

That one line is the whole privilege the deploy pipeline has on this machine.

## 9. nginx and TLS

Point the domain at the server first — an **A record** for `example.com` and
another for `www`, both to `SERVER_IP`. Certbot proves you control the domain by
being answered at it, so it cannot run until this has propagated. Check from
your own machine:

```bash
nslookup example.com
```

When that returns `SERVER_IP`:

```bash
sudo cp /srv/ielts/deploy/nginx.conf /etc/nginx/sites-available/ielts
sudo sed -i 's/example\.com/YOUR_REAL_DOMAIN/g' /etc/nginx/sites-available/ielts
sudo ln -sf /etc/nginx/sites-available/ielts /etc/nginx/sites-enabled/ielts
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

`http://example.com` should now show the home page. Then:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot asks for an email address and asks you to agree to Let's Encrypt's
terms — read them and answer yourself. Choose the redirect option when it offers
one. It rewrites `/etc/nginx/sites-available/ielts` in place, adding the TLS
block and turning the plain one into a redirect. Renewal installs itself as a
timer; confirm with:

```bash
sudo certbot renew --dry-run
```

Once `https://example.com` loads in a real browser, uncomment the
`Strict-Transport-Security` line in `/etc/nginx/sites-available/ielts` and
reload. Not before — browsers cache that header for a year and will refuse to
fall back to HTTP if something is wrong with the certificate.

## 10. The admin account, and the audio

The seed creates the first admin. Pass the password inline so it never lands in
`.env` — and **start the line with a space**, which keeps it out of your shell
history:

```bash
 sudo -u ielts bash -c 'cd /srv/ielts && SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="the-one-you-chose" SEED_ADMIN_NAME="Davronbek Nabiev" npm run db:seed'
```

Pick it in a password manager. Do not reuse `ChangeMe123!` from development — it
went through a URL during the tunnel work and should be considered public.

The seed also loads all nine tests and, because the database is empty, the
placeholder home page results and reviews. Those are placeholders with a stock
certificate image: replace them with real students in `/admin/showcase` before
you tell anyone the address.

Listening tests stay in draft until they have audio. All three can fetch their
own:

```bash
sudo -u ielts bash -c 'cd /srv/ielts && npm run audio:upload -- --list'
```

```bash
sudo -u ielts bash -c 'cd /srv/ielts && npm run audio:upload -- --test cambridge-21-listening-test-4 --from-source --publish'
```

```bash
sudo -u ielts bash -c 'cd /srv/ielts && npm run audio:upload -- --test cd-ielts-listening-volume-9-test-2 --from-source --publish'
```

```bash
sudo -u ielts bash -c 'cd /srv/ielts && npm run audio:upload -- --test ielts-cdi-listening-mock --from-source --publish'
```

`--from-source` downloads from the URL the converter recorded — archive.org for
two of them, catbox for the third. Those are other people's servers and one of
them will eventually go away. If a download fails, send the file from your own
machine instead, from PowerShell in the project directory:

```powershell
scp "_source-tests/Listening Mock.mp3" abdulloh@SERVER_IP:/tmp/listening-mock.mp3
```

then on the server:

```bash
sudo -u ielts bash -c 'cd /srv/ielts && npm run audio:upload -- --test ielts-cdi-listening-mock --file /tmp/listening-mock.mp3 --publish'
```

Re-running the uploader is safe: the storage key ends in a hash of the file, so
the same audio lands in the same place and a replaced file has its predecessor
cleaned up.

## 11. Smoke tests

Run these from your own machine. Each one checks something that has never been
exercised on real infrastructure before.

**TLS, and the redirect:**

```bash
curl -sSI http://example.com | head -1
```

301 or 308, to the `https://` address.

**The security headers:**

```bash
curl -sSI https://example.com | grep -Ei 'x-frame|referrer|strict-transport'
```

**Audio is refused without a session** — this is the check that matters most,
because the media directory is outside the web root precisely so that nobody can
reach it directly:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://example.com/api/tests/SOME_ID/audio
```

401 or 403. Never 200.

**The internal location cannot be reached from outside:**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://example.com/protected-media/audio/anything.mp3
```

404. `internal` in nginx means only an upstream redirect can reach that path; a
browser asking for it directly is refused whether the file exists or not.

**The X-Accel handoff, and range requests.** This one needs a signed-in session,
so do it in a browser: sign in, open a listening test, and in devtools →
Network, watch the request to `/api/tests/…/audio`. You want **206 Partial
Content** with a `Content-Range` header, and `Content-Type: audio/mpeg` (or
`audio/mp4` for the mock, which is really an M4A). Seek in the audio bar — each
seek should produce another 206.

If instead you get a 404, the alias in the nginx config and `MEDIA_STORAGE_DIR`
disagree, or the permissions from step 5 did not take:

```bash
sudo tail -20 /var/log/nginx/error.log
sudo -u www-data ls -l /var/lib/ielts/media/audio/
```

The second command is the direct test: if `www-data` cannot list that directory,
nginx cannot read the files.

**Then sit a test end to end.** Sign up as a student, take the 13-question
reading practice, submit it, and check the band appears and the review marks
correctly. That exercises the database, sessions, autosave, grading and the
timer in one go.

## 12. Turning on CI/CD

`.github/workflows/deploy.yml` runs typecheck, lint, tests and a real build
against a throwaway Postgres on every push and pull request. A push to `master`
that passes all of it then deploys.

Make a key for GitHub to log in with. It is a **second** key, separate from the
read-only one the server uses for cloning:

```bash
sudo -u ielts ssh-keygen -t ed25519 -N "" -f /home/ielts/.ssh/ci_key -C "github-actions"
sudo -u ielts bash -c 'cat /home/ielts/.ssh/ci_key.pub >> /home/ielts/.ssh/authorized_keys'
sudo -u ielts chmod 600 /home/ielts/.ssh/authorized_keys
sudo cat /home/ielts/.ssh/ci_key
```

That last command prints the private key. Copy the whole thing, `BEGIN` and
`END` lines included.

On your own machine, get the server's host key so CI can recognise it:

```bash
ssh-keyscan -t ed25519 example.com
```

Now in GitHub → the repo → **Settings → Secrets and variables → Actions**, add
four repository secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_KEY` | the private key printed above, in full |
| `DEPLOY_KNOWN_HOSTS` | the `ssh-keyscan` output line |
| `DEPLOY_HOST` | `example.com` |
| `DEPLOY_USER` | `ielts` |

`DEPLOY_KNOWN_HOSTS` is not optional padding. Without it the workflow would have
to accept whatever host key it is offered, which means a deploy could hand your
key to something that is not your server.

Then switch deploying on. In the same settings screen, on the **Variables** tab
(not Secrets), add a repository variable `DEPLOY_ENABLED` with the value `true`.
Until that exists the deploy job is skipped, so pushes made before the server
was ready ran the checks and stopped there rather than failing.

Once the secrets are in, delete the private key from the server — GitHub has it
now and a copy sitting in `/home/ielts` is a copy that can be stolen:

```bash
sudo rm /home/ielts/.ssh/ci_key
```

Push anything to `master` and watch the Actions tab. To require your approval
before a deploy, go to **Settings → Environments → production** and add yourself
as a required reviewer; the workflow already names that environment.

## 13. Backups

```bash
sudo chmod +x /srv/ielts/deploy/backup.sh
sudo bash /srv/ielts/deploy/backup.sh
```

Then nightly at 03:30:

```bash
echo '30 3 * * * root bash /srv/ielts/deploy/backup.sh >> /var/log/ielts-backup.log 2>&1' | sudo tee /etc/cron.d/ielts-backup
```

It dumps the database, the private media directory, and `public/test-media` —
that last one because admin image uploads (test charts, student certificates)
are written into the checkout as untracked files. Git will not bring them back
and a fresh clone will not have them.

Backups on the same disk protect against a bad migration, not against losing the
server. Copy them off now and then:

```powershell
scp abdulloh@SERVER_IP:/var/backups/ielts/db-*.dump .
```

Restoring:

```bash
sudo -u ielts pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" db-2026-07-31.dump
```

## 14. Day to day

**Deploy**: push to `master`, or run the workflow by hand from the Actions tab.
On the server it is the same thing:

```bash
sudo -u ielts bash -c 'cd /srv/ielts && git fetch --prune origin && git reset --hard origin/master && bash scripts/deploy.sh'
```

**Roll back** to a known-good commit:

```bash
sudo -u ielts bash -c 'cd /srv/ielts && git reset --hard COMMIT_SHA && bash scripts/deploy.sh'
```

A rollback rebuilds; it does not reverse a migration. Prisma migrations here are
additive, so an old build against a newer schema generally works, but check the
migration before relying on that.

**Logs**:

```bash
sudo journalctl -u ielts -f
```

**Restart**:

```bash
sudo systemctl restart ielts
```

### The one thing to know about deploys

`scripts/deploy.sh` builds in place, in the directory the running app is serving
from. It builds before it restarts, so a build that fails leaves the old app
running — but while `next build` is replacing `.next`, the live site can throw
errors for a minute or two. With one instructor and a class of students that is
a non-issue; deploy when nobody is mid-test. If it ever matters, the fix is two
service units and an nginx upstream swap, not a bigger script.

## 15. What this does not cover, and what to check by hand

- **The speaking recorder has never run against a real microphone.** Everything
  around it is tested — the briefing, the permission-denied path, upload,
  re-recording, playback with ranges — but the tooling used during development
  blocks device capture, so `MediaRecorder` itself has never executed. Sit one
  speaking test in a real browser on the live site. This is the largest untested
  path in the app. "Skip this question" is unexercised for the same reason.
- **Contact details** in `src/content/site.ts` came from a mockup image. Confirm
  the phone number and Telegram handle are real before anyone can see them.
- **The placeholder showcase rows** are still there after seeding. Real students
  go in `/admin/showcase`, and the privacy warning on that screen is not
  decorative — a Test Report Form carries a full name, date of birth, candidate
  number and nationality, and it is going on a public page.
- **`ielts-speaking-part-1-practice` is published with topic headings**
  ("Work", "Study", "Hometown") where its questions should be. It has no content
  file, so the seed does not touch it. A student can sit it today. Archive it in
  `/admin/tests` or write the questions before launch.
- **Uzbek and Russian** are unwired on purpose — see `docs/ROADMAP.md`.
