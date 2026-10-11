// Desktop shell for Fairway Manager. The game loads from its GitHub Pages site, so every
// update that reaches main is in the .exe the next time it opens, with no rebuild.
const { app, BrowserWindow, shell } = require("electron");

const GAME_URL = "https://schmitty4321-dot.github.io/golfrpg/";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    title: "Fairway Manager",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL(GAME_URL);
  // Links to other sites open in the user's browser, not inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(GAME_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
