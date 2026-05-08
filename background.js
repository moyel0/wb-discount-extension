chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const root = document.getElementById("wb-discount-calc-root");
        if (!root) return;
        const collapsed = root.classList.toggle("wb-dc-collapsed");
        try {
          if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ wbDiscountCalcCollapsed: collapsed });
          }
        } catch (_) {
          /* no-op */
        }
      },
    });
  } catch (err) {
    /* no-op: action click is best-effort */
  }
});
