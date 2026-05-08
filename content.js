(function () {
  "use strict";

  const ROOT_ID = "wb-discount-calc-root";
  const STORAGE_KEYS = {
    collapsed: "wbDiscountCalcCollapsed",
    sale: "wbDiscountCalcSale",
    desired: "wbDiscountCalcDesired",
  };

  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const storage =
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
      ? chrome.storage.local
      : null;

  function getState(callback) {
    if (storage) {
      storage.get(
        [STORAGE_KEYS.collapsed, STORAGE_KEYS.sale, STORAGE_KEYS.desired],
        (result) => {
          callback({
            collapsed: result[STORAGE_KEYS.collapsed] === true,
            sale: result[STORAGE_KEYS.sale] || "",
            desired: result[STORAGE_KEYS.desired] || "",
          });
        }
      );
      return;
    }
    callback({
      collapsed: localStorage.getItem(STORAGE_KEYS.collapsed) === "true",
      sale: localStorage.getItem(STORAGE_KEYS.sale) || "",
      desired: localStorage.getItem(STORAGE_KEYS.desired) || "",
    });
  }

  function setState(patch) {
    if (storage) {
      const obj = {};
      if (patch.collapsed !== undefined) obj[STORAGE_KEYS.collapsed] = patch.collapsed;
      if (patch.sale !== undefined) obj[STORAGE_KEYS.sale] = patch.sale;
      if (patch.desired !== undefined) obj[STORAGE_KEYS.desired] = patch.desired;
      storage.set(obj);
      return;
    }
    if (patch.collapsed !== undefined)
      localStorage.setItem(STORAGE_KEYS.collapsed, String(patch.collapsed));
    if (patch.sale !== undefined) localStorage.setItem(STORAGE_KEYS.sale, patch.sale);
    if (patch.desired !== undefined)
      localStorage.setItem(STORAGE_KEYS.desired, patch.desired);
  }

  function parseAmount(value) {
    if (typeof value !== "string") return NaN;
    const cleaned = value
      .replace(/\u00A0/g, "")
      .replace(/\s+/g, "")
      .replace(",", ".")
      .replace(/[^\d.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") {
      return NaN;
    }
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
  }

  function formatPercent(value) {
    const rounded = Math.round(value * 100) / 100;
    let text = rounded.toFixed(2);
    text = text.replace(/\.?0+$/, "");
    if (text === "" || text === "-") text = "0";
    return text + "%";
  }

  function formatMoney(value) {
    const rounded = Math.round(value * 100) / 100;
    const fixed = rounded.toFixed(2).replace(/\.?0+$/, "");
    return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " \u20BD";
  }

  function calculate(saleStr, desiredStr) {
    const sale = parseAmount(saleStr);
    const desired = parseAmount(desiredStr);

    if (!Number.isFinite(sale) && !Number.isFinite(desired)) {
      return { kind: "idle" };
    }
    if (!Number.isFinite(sale) || !Number.isFinite(desired)) {
      return { kind: "incomplete" };
    }
    if (sale <= 0) {
      return { kind: "error", message: "Сумма продажи должна быть больше нуля" };
    }
    if (desired < 0) {
      return { kind: "error", message: "Желаемая сумма не может быть отрицательной" };
    }
    if (desired > sale) {
      const percent = ((desired - sale) / sale) * 100;
      return {
        kind: "markup",
        percent,
        diff: desired - sale,
        message: "Желаемая сумма больше продажи — нужна наценка",
      };
    }

    const diff = sale - desired;
    const percent = (diff / sale) * 100;
    return { kind: "ok", percent, diff };
  }

  function buildPanel(initial) {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "wb-dc-root";
    if (initial.collapsed) root.classList.add("wb-dc-collapsed");

    root.innerHTML = `
      <button type="button" class="wb-dc-toggle" aria-label="Показать калькулятор" title="WB Discount Calculator">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M7 17L17 7M8.5 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm10 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
        </svg>
      </button>
      <section class="wb-dc-panel" role="dialog" aria-label="Калькулятор скидки Wildberries">
        <header class="wb-dc-header">
          <div class="wb-dc-title">
            <span class="wb-dc-badge">WB</span>
            <span>Калькулятор скидки</span>
          </div>
          <button type="button" class="wb-dc-hide" aria-label="Скрыть панель" title="Скрыть">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M9 6l6 6-6 6" transform="rotate(0 12 12)"/>
            </svg>
          </button>
        </header>

        <div class="wb-dc-body">
          <label class="wb-dc-field">
            <span class="wb-dc-label">Сумма продажи, ₽</span>
            <input type="text" inputmode="decimal" class="wb-dc-input" data-field="sale" placeholder="например, 1500" autocomplete="off" />
          </label>

          <label class="wb-dc-field">
            <span class="wb-dc-label">Желаемая сумма, ₽</span>
            <input type="text" inputmode="decimal" class="wb-dc-input" data-field="desired" placeholder="например, 1200" autocomplete="off" />
          </label>

          <div class="wb-dc-result" data-state="idle">
            <div class="wb-dc-result-percent">—</div>
            <div class="wb-dc-result-caption">Введите обе суммы</div>
            <div class="wb-dc-result-diff"></div>
          </div>

          <button type="button" class="wb-dc-reset" title="Сбросить значения">Сбросить</button>
        </div>
      </section>
    `;

    return root;
  }

  function attach() {
    getState((initial) => {
      const root = buildPanel(initial);
      document.documentElement.appendChild(root);

      const panel = root.querySelector(".wb-dc-panel");
      const toggleBtn = root.querySelector(".wb-dc-toggle");
      const hideBtn = root.querySelector(".wb-dc-hide");
      const saleInput = root.querySelector('input[data-field="sale"]');
      const desiredInput = root.querySelector('input[data-field="desired"]');
      const resultBox = root.querySelector(".wb-dc-result");
      const percentEl = root.querySelector(".wb-dc-result-percent");
      const captionEl = root.querySelector(".wb-dc-result-caption");
      const diffEl = root.querySelector(".wb-dc-result-diff");
      const resetBtn = root.querySelector(".wb-dc-reset");

      saleInput.value = initial.sale;
      desiredInput.value = initial.desired;

      function setCollapsed(collapsed) {
        root.classList.toggle("wb-dc-collapsed", collapsed);
        setState({ collapsed });
      }

      function render() {
        const result = calculate(saleInput.value, desiredInput.value);

        if (result.kind === "idle") {
          resultBox.dataset.state = "idle";
          percentEl.textContent = "—";
          captionEl.textContent = "Введите обе суммы";
          diffEl.textContent = "";
          return;
        }
        if (result.kind === "incomplete") {
          resultBox.dataset.state = "idle";
          percentEl.textContent = "—";
          captionEl.textContent = "Введите обе суммы";
          diffEl.textContent = "";
          return;
        }
        if (result.kind === "error") {
          resultBox.dataset.state = "error";
          percentEl.textContent = "—";
          captionEl.textContent = result.message;
          diffEl.textContent = "";
          return;
        }
        if (result.kind === "markup") {
          resultBox.dataset.state = "markup";
          percentEl.textContent = "+" + formatPercent(result.percent);
          captionEl.textContent = result.message;
          diffEl.textContent = "Разница: " + formatMoney(result.diff);
          return;
        }

        resultBox.dataset.state = "ok";
        percentEl.textContent = "−" + formatPercent(result.percent);
        captionEl.textContent = "Отнимите от цены продажи";
        diffEl.textContent = "Скидка: " + formatMoney(result.diff);
      }

      saleInput.addEventListener("input", () => {
        setState({ sale: saleInput.value });
        render();
      });
      desiredInput.addEventListener("input", () => {
        setState({ desired: desiredInput.value });
        render();
      });

      toggleBtn.addEventListener("click", () => setCollapsed(false));
      hideBtn.addEventListener("click", () => setCollapsed(true));

      resetBtn.addEventListener("click", () => {
        saleInput.value = "";
        desiredInput.value = "";
        setState({ sale: "", desired: "" });
        render();
        saleInput.focus();
      });

      panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          setCollapsed(true);
        }
      });

      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }
})();
