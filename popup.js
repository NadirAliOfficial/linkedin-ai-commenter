document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get({ lca_log: [], lca_extra_rules: "" }, ({ lca_log, lca_extra_rules }) => {
    const gens = lca_log.filter(e => e.kind === "gen");
    const userRetries = lca_log.filter(e => e.kind === "user_retry").length;
    const statsBody = document.getElementById("stats-body");

    // ── Stats ──────────────────────────────────────────────────────────────
    if (gens.length === 0) {
      statsBody.textContent = "No data yet — generate some comments first.";
    } else {
      const filtered = gens.filter(e => e.filterTriggered).length;
      const fixed = gens.filter(e => e.filterFixed).length;
      const pct = (n, d) => d > 0 ? Math.round(n / d * 100) + "%" : "—";

      const tones = {};
      for (const e of gens) {
        if (!tones[e.tone]) tones[e.tone] = { total: 0, filtered: 0 };
        tones[e.tone].total++;
        if (e.filterTriggered) tones[e.tone].filtered++;
      }
      const worstTone = Object.entries(tones)
        .filter(([, v]) => v.total >= 3)
        .sort(([, a], [, b]) => b.filtered / b.total - a.filtered / a.total)[0];

      const rows = [
        ["Total generated", gens.length],
        ["Filter triggered", `${filtered} (${pct(filtered, gens.length)})`],
        ["Filter self-fixed", filtered > 0 ? `${fixed} / ${filtered}` : "—"],
        ["User retries", userRetries],
        ["Worst tone", worstTone ? `${worstTone[0]} — ${pct(worstTone[1].filtered, worstTone[1].total)} fail` : "—"],
      ];

      const table = document.createElement("table");
      table.style.cssText = "width:100%;border-collapse:collapse;";
      for (const [label, val] of rows) {
        const tr = document.createElement("tr");
        const tdL = document.createElement("td");
        tdL.style.cssText = "color:#888;padding:3px 0;font-size:11px;";
        tdL.textContent = label;
        const tdR = document.createElement("td");
        tdR.style.cssText = "text-align:right;font-weight:600;font-size:11px;color:#1d1d1d;";
        tdR.textContent = String(val);
        tr.appendChild(tdL);
        tr.appendChild(tdR);
        table.appendChild(tr);
      }
      statsBody.innerHTML = "";
      statsBody.appendChild(table);

      const failures = gens.filter(e => e.filterTriggered && !e.filterFixed).slice(-3).reverse();
      if (failures.length) {
        const lbl = document.createElement("div");
        lbl.style.cssText = "font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#aaa;margin-top:10px;margin-bottom:4px;";
        lbl.textContent = "Recent filter failures";
        statsBody.appendChild(lbl);
        for (const e of failures) {
          const row = document.createElement("div");
          row.style.cssText = "background:#fff3cd;border-radius:6px;padding:5px 7px;margin-bottom:4px;font-size:10px;color:#555;line-height:1.4;";
          row.innerHTML = `<span style="font-weight:700;color:#b45309;">${e.tone}</span> &nbsp;${e.comment.slice(0, 90)}${e.comment.length > 90 ? "…" : ""}`;
          statsBody.appendChild(row);
        }
      }

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:12px;margin-top:10px;";

      const exportBtn = document.createElement("button");
      exportBtn.textContent = "⬇ Export log";
      exportBtn.style.cssText = "font-size:10px;color:#0a66c2;background:none;border:none;cursor:pointer;padding:0;";
      exportBtn.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), source: "production", entries: lca_log }, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "lca-log.json";
        a.click();
      });

      const clearBtn = document.createElement("button");
      clearBtn.textContent = "Clear log";
      clearBtn.style.cssText = "font-size:10px;color:#bbb;background:none;border:none;cursor:pointer;padding:0;";
      clearBtn.addEventListener("click", () => chrome.storage.local.remove("lca_log", () => location.reload()));

      btnRow.appendChild(exportBtn);
      btnRow.appendChild(clearBtn);
      statsBody.appendChild(btnRow);
    }

    // ── Analyze & Improve ─────────────────────────────────────────────────
    const allFailures = gens.filter(e => e.filterTriggered && !e.filterFixed);
    const analyzeSection = document.getElementById("analyze-section");

    if (allFailures.length >= 3) {
      analyzeSection.style.display = "block";
      const analyzeBtn = document.getElementById("analyze-btn");
      const analyzeResult = document.getElementById("analyze-result");

      analyzeBtn.addEventListener("click", () => {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = "Analyzing…";
        analyzeResult.style.display = "none";

        chrome.runtime.sendMessage(
          { type: "analyze", failures: allFailures.slice(-15) },
          (resp) => {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = "↺ Analyze again";

            if (!resp?.ok) {
              analyzeResult.innerHTML = `<span style="color:#ef4444;font-size:11px;">⚠ ${resp?.error || "Error"}</span>`;
              analyzeResult.style.display = "block";
              return;
            }

            analyzeResult.innerHTML = "";
            analyzeResult.style.display = "block";

            const rulesBox = document.createElement("div");
            rulesBox.style.cssText = "font-size:11px;color:#333;line-height:1.55;white-space:pre-wrap;background:#f5f5f5;border-radius:6px;padding:8px 10px;margin-bottom:8px;";
            rulesBox.textContent = resp.rules;
            analyzeResult.appendChild(rulesBox);

            const btnRow = document.createElement("div");
            btnRow.style.cssText = "display:flex;gap:8px;";

            const applyBtn = document.createElement("button");
            applyBtn.textContent = "Apply improvements";
            applyBtn.style.cssText = "flex:1;background:#0a66c2;color:#fff;border:none;border-radius:12px;padding:5px 10px;font-size:11px;cursor:pointer;font-weight:600;";
            applyBtn.addEventListener("click", () => {
              chrome.storage.local.set({ lca_extra_rules: resp.rules }, () => {
                analyzeResult.innerHTML = `<span style="color:#057642;font-size:11px;font-weight:600;">✓ Applied — reload LinkedIn tab to take effect.</span>`;
              });
            });

            const discardBtn = document.createElement("button");
            discardBtn.textContent = "Discard";
            discardBtn.style.cssText = "background:#eee;color:#666;border:none;border-radius:12px;padding:5px 10px;font-size:11px;cursor:pointer;";
            discardBtn.addEventListener("click", () => {
              analyzeResult.style.display = "none";
              analyzeBtn.textContent = "Analyze failures";
            });

            btnRow.appendChild(applyBtn);
            btnRow.appendChild(discardBtn);
            analyzeResult.appendChild(btnRow);
          }
        );
      });
    }

    // ── Current learned rules ─────────────────────────────────────────────
    const rulesSection = document.getElementById("rules-section");
    if (lca_extra_rules) {
      rulesSection.style.display = "block";
      document.getElementById("rules-body").textContent = lca_extra_rules;
      document.getElementById("clear-rules-btn").addEventListener("click", () => {
        chrome.storage.local.remove("lca_extra_rules", () => location.reload());
      });
    }
  });
});
