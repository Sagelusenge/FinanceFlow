interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pendingPrompt: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pendingPrompt = event as InstallPromptEvent;
    window.dispatchEvent(new Event("financeflow:installable"));
  });
  window.addEventListener("appinstalled", () => {
    pendingPrompt = null;
    window.dispatchEvent(new Event("financeflow:installable"));
  });
}

export const canPromptInstall = () => pendingPrompt !== null;
export const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
export async function installApp() {
  if (!pendingPrompt) return false;
  const prompt = pendingPrompt;
  pendingPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  window.dispatchEvent(new Event("financeflow:installable"));
  return choice.outcome === "accepted";
}
