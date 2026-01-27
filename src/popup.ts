// Popup script - Settings UI for API key management

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
  const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
  const status = document.getElementById("status") as HTMLDivElement;

  // Load existing key
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_API_KEY" });
    if (response?.success && response.apiKey) {
      apiKeyInput.value = response.apiKey;
    }
  } catch (err) {
    console.error("Failed to load API key:", err);
  }

  // Save key on button click
  saveBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();

    try {
      const result = await chrome.runtime.sendMessage({
        type: "SET_API_KEY",
        apiKey,
      });

      if (result?.success) {
        status.textContent = apiKey ? "API key saved!" : "API key cleared";
        status.className = "status success";
      } else {
        status.textContent = "Failed to save";
        status.className = "status error";
      }
    } catch (err) {
      status.textContent = "Failed to save";
      status.className = "status error";
    }

    setTimeout(() => {
      status.textContent = "";
      status.className = "status";
    }, 3000);
  });

  // Save on Enter key
  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    }
  });
});
