/**
 * Compiles captured NDC[X] RQ/RS pairs into per-case certification evidence bundles.
 *
 * Input: the raw `*NDCX-<SalesPoint>-<Service>-RQ|RS.xml` files that ndcxLogger writes to
 * `<api-aerial>/use cases/NDCX/`. For each case in the manifest it takes every call whose
 * write time falls inside the case's window, groups RQ+RS back into one call, names the
 * steps from the manifest, and writes:
 *
 *   <out>/<case-id>/<nn-label>/<raw RQ + RS>     (unmodified copies)
 *   <out>/<case-id>/README.md                    (order, PNR, amount, tickets, outcome, steps)
 *   <out>/<case-id>.zip
 *   <out>/INDEX.md                               (summary table + checklist mapping)
 *
 * Usage:
 *   node ndcx_package_cert_runs.js --manifest cert-runs.2026-10-18.json \
 *        [--logs <api-aerial>/use cases/NDCX] [--out <logs>/cert-runs/cases]
 *
 * The manifest is the only per-run input — see `cert-runs.2026-10-18.json` for the shape.
 * The XML files are copied as-is (PAN/CVV were already masked at capture time by the logger).
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : fallback;
}
function flag(name) {
  return process.argv.includes("--" + name);
}

const SRC_GUESS = path.resolve(__dirname, "..", "..", "..", "..", "api-aerial", "src");
const AERIAL_SRC = arg("src") || process.env.NDCX_AERIAL_SRC || (fs.existsSync(SRC_GUESS) ? SRC_GUESS : null);
const LOGS_DIR = path.resolve(
  arg("logs", AERIAL_SRC ? path.resolve(AERIAL_SRC, "..", "use cases", "NDCX") : path.resolve(__dirname, "..", "..")),
);
const OUT_DIR = path.resolve(arg("out", path.join(LOGS_DIR, "cert-runs", "cases")));
const MANIFEST_PATH = arg("manifest", path.join(__dirname, "cert-runs.2026-10-18.json"));

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`Manifest not found: ${MANIFEST_PATH}\nPass --manifest <file>.`);
  process.exit(2);
}
if (!fs.existsSync(LOGS_DIR)) {
  console.error(`Capture folder not found: ${LOGS_DIR}\nPass --logs <dir>.`);
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

/** Every logged call whose write time falls in `window`, grouped by (service, write instant). */
function listCalls(window) {
  const [from, to] = window.map((w) => new Date(w).getTime());
  const files = fs
    .readdirSync(LOGS_DIR)
    .filter((f) => f.includes("NDCX") && f.endsWith(".xml"))
    .map((f) => ({ f, st: fs.statSync(path.join(LOGS_DIR, f)) }))
    .filter((x) => x.st.mtimeMs >= from && x.st.mtimeMs <= to);

  const calls = new Map();
  for (const x of files) {
    const parts = x.f.replace(/\.xml$/, "").split("-");
    const svc = String(parts[3] || "").replace(/Async$/, "");
    const kind = parts.slice(4).find((p) => p === "RQ" || p === "RS" || p.startsWith("RS_")) || "?";
    const key = `${svc}|${new Date(x.st.mtimeMs).toISOString().slice(0, 19)}`;
    if (!calls.has(key)) calls.set(key, { svc, at: new Date(x.st.mtimeMs), rq: [], rs: [] });
    const call = calls.get(key);
    if (kind === "RQ") call.rq.push(x.f);
    else call.rs.push(x.f);
  }
  return [...calls.values()].sort((a, b) => a.at - b.at);
}

function zip(dir, zipPath) {
  fs.rmSync(zipPath, { force: true });
  try {
    if (process.platform === "win32") {
      execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${dir}\\*' -DestinationPath '${zipPath}' -Force`,
      ]);
    } else {
      execFileSync("zip", ["-qr", zipPath, "."], { cwd: dir });
    }
  } catch (e) {
    console.warn(`  (zip failed for ${path.basename(dir)}: ${e.message})`);
  }
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const indexLines = [
    `# ${manifest.title || "NDC[X] certification runs"}`,
    "",
    manifest.intro ||
      "Live runs executed with `ndcx_cert_runner.js` (same builders/mappers as the product; raw XML written by the capture logger). Each case folder holds the calls in order, RQ+RS per step, copied unmodified from the capture folder.",
    "",
    "| Case | OrderID | Amadeus PNR | Amount | Payment | Tickets | Outcome | Folder |",
    "|---|---|---|---|---|---|---|---|",
  ];

  for (const c of manifest.cases || []) {
    const calls = listCalls(c.window);
    if (calls.length !== (c.labels || []).length) {
      console.warn(`!! ${c.id}: ${calls.length} captured calls vs ${(c.labels || []).length} manifest labels`);
    }
    const dir = path.join(OUT_DIR, c.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    const rows = [];
    calls.forEach((call, i) => {
      const label = (c.labels || [])[i] || `${String(i + 1).padStart(2, "0")}-${call.svc}`;
      const stepDir = path.join(dir, label);
      fs.mkdirSync(stepDir, { recursive: true });
      for (const f of [...call.rq, ...call.rs]) {
        fs.copyFileSync(path.join(LOGS_DIR, f), path.join(stepDir, f));
      }
      rows.push(
        `| ${label} | ${call.svc} | ${call.at.toISOString().replace("T", " ").slice(0, 19)} UTC | ${[...call.rq, ...call.rs].join(", ")} |`,
      );
    });

    const s = c.summary || {};
    const readme = [
      `# ${c.title || c.id}`,
      "",
      `- Order: **${s.order}** — Amadeus PNR **${s.pnr}**`,
      `- Amount: **${s.amount}** — ${s.payment}`,
      `- Tickets: **${s.tickets}**`,
      `- Outcome: **${s.outcome}**`,
      `- Captured: ${c.window[0].replace("T", " ")} → ${c.window[1].replace("T", " ")} (local capture window${manifest.host ? `; ${manifest.host}` : ""})`,
      "",
      "| Step | Service | Timestamp (UTC) | Files |",
      "|---|---|---|---|",
      ...rows,
      "",
      "Notes",
      ...(c.notes || ["- Raw SOAP envelopes, unmodified. PAN/CVV were masked at capture time by the logger."]).map((n) =>
        n.startsWith("-") ? n : `- ${n}`,
      ),
      "",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "README.md"), readme, "utf8");

    zip(dir, path.join(OUT_DIR, `${c.id}.zip`));

    indexLines.push(
      `| ${c.id} | ${s.order || ""} | ${s.pnr || ""} | ${s.amount || ""} | ${s.payment || ""} | ${s.tickets || ""} | ${s.outcome || ""} | \`${c.id}/\` |`,
    );
    console.log(`packaged ${c.id}: ${calls.length} calls -> ${dir}`);
  }

  if (manifest.checklistMapping?.length) {
    indexLines.push("", "Checklist mapping", ...manifest.checklistMapping.map((m) => (m.startsWith("-") ? m : `- ${m}`)), "");
  }
  fs.writeFileSync(path.join(OUT_DIR, "INDEX.md"), indexLines.join("\n"), "utf8");
  console.log(`INDEX written: ${path.join(OUT_DIR, "INDEX.md")}${flag("quiet") ? "" : ""}`);
}

main();
