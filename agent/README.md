# SnapUp Store Presence Agent

A small program that runs on one always-on machine inside the shop. Every thirty seconds it
tells SnapUp "this shop's network is up", and SnapUp records the address that message
arrived from.

That address is how SnapUp knows a customer is really in the shop: their phone's requests
leave by the same route, and SnapUp compares the two.

## Why it exists

Before this, somebody had to type the shop's public IP address into the SnapUp console. ISPs
change that address without warning — after a router reboot, or on their own schedule — and
when it changed, every customer was refused at the door until a person noticed and retyped
it. Nobody notices at 9am on a Saturday.

The agent removes that job. When the address changes, the next heartbeat carries the new one
and customers keep shopping.

## What it does and does not do

- It sends: the agent's id, the shop's id, the time, and its version.
- It receives: how long to wait before the next heartbeat.
- It never sees customer data, basket contents, prices or payments.
- It does not open any port, and nothing connects *to* it. It only makes outbound HTTPS
  requests, so it works behind the shop's existing firewall with no changes.

## Requirements

- A machine inside the shop that stays on: the back-office PC, a mini PC, or a Raspberry Pi.
- Node.js 18 or newer.
- Outbound HTTPS to the SnapUp host. Nothing else.

The machine must be on the **same internet connection the customer Wi-Fi uses**. If the shop
has a separate line for the tills, the agent must not be on it, or SnapUp will learn the
wrong address and refuse every customer.

## Install

**1. Register the agent in the SnapUp console.**

Stores → the shop → *Network presence & agent* → **Register a presence agent**.

The screen shows three values **once**. Copy them now; SnapUp keeps only a hash of the
secret and cannot show it again. If you lose it, register another agent and revoke the old
one.

**2. Put the files on the shop machine.**

Copy `snapup-presence-agent.mjs` to, say, `C:\SnapUp\` or `/opt/snapup/`.

**3. Run it once by hand to check it works.**

Linux or macOS:

```sh
SNAPUP_API_BASE=https://snapup-monorepo-production.up.railway.app \
SNAPUP_AGENT_ID=spa_xxxxxxxx \
SNAPUP_STORE_ID=store_1 \
SNAPUP_AGENT_SECRET=xxxxxxxx \
node snapup-presence-agent.mjs
```

Windows PowerShell:

```powershell
$env:SNAPUP_API_BASE="https://snapup-monorepo-production.up.railway.app"
$env:SNAPUP_AGENT_ID="spa_xxxxxxxx"
$env:SNAPUP_STORE_ID="store_1"
$env:SNAPUP_AGENT_SECRET="xxxxxxxx"
node snapup-presence-agent.mjs
```

You should see, every thirty seconds:

```
[agent] ok · store store_1 · seen from 203.0.113.10 · 142ms
```

The console should now show the store as **ONLINE**. Check that the address under "Seen
from" is the shop's, not a VPN's.

**4. Make it start with the machine.**

*Linux (systemd)* — `/etc/systemd/system/snapup-presence.service`:

```ini
[Unit]
Description=SnapUp Store Presence Agent
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/node /opt/snapup/snapup-presence-agent.mjs
Environment=SNAPUP_API_BASE=https://snapup-monorepo-production.up.railway.app
Environment=SNAPUP_AGENT_ID=spa_xxxxxxxx
Environment=SNAPUP_STORE_ID=store_1
Environment=SNAPUP_AGENT_SECRET=xxxxxxxx
Restart=always
RestartSec=10
User=snapup

[Install]
WantedBy=multi-user.target
```

```sh
sudo chmod 600 /etc/systemd/system/snapup-presence.service   # the secret is in this file
sudo systemctl enable --now snapup-presence
sudo systemctl status snapup-presence
```

*Windows* — use Task Scheduler: *Create Task*, "Run whether user is logged on or not", trigger
*At startup*, action `node.exe` with argument `C:\SnapUp\snapup-presence-agent.mjs`, and set
the four variables in the task's environment or a wrapper `.cmd` file. Restrict that file so
only administrators can read it.

## What the states mean

| Console says | Means | Customers |
| --- | --- | --- |
| ONLINE | Heartbeat seen in the last 30s | Can start shopping |
| STALE | Last heartbeat 30–90s ago | Unaffected; still admitted |
| OFFLINE | No heartbeat for over 90s | **Cannot start** new sessions |
| REVOKED | The agent was revoked in the console | **Cannot start** new sessions |
| UNKNOWN | No agent installed for this shop | Falls back to the typed-in address |

Customers **already shopping** are not thrown out when a shop goes OFFLINE. Their session is
tied to the address they entered on, and they keep that until it expires normally. Only new
entries are blocked.

## When something is wrong

**Store shows OFFLINE.**
Check the machine is on and the agent is running (`systemctl status snapup-presence`, or
Task Scheduler). Check the shop has internet. The agent retries for ever and recovers by
itself once the line is back — no action needed beyond fixing the line.

**Customers are refused but the store shows ONLINE.**
Compare "Seen from" in the console against what the shop's phones actually use. If the agent
is on a different connection from the customer Wi-Fi, move it.

**The secret was lost or may have leaked.**
Register a new agent, install it, confirm ONLINE, then revoke the old one. Do it in that
order: revoking first blocks entry until the replacement is up.

**Replacing the machine.**
Register a new agent on the new machine first and confirm it is ONLINE — two agents can run
at once and either keeps the shop open. Then revoke the old one.

## Rotating the secret

There is no in-place rotation; it is register-new, verify, revoke-old. That is deliberate:
it means there is no window where a shop has a credential nobody has yet proved works.
