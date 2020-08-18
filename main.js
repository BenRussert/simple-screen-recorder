const { app, BrowserWindow, ipcMain, screen, shell } = require("electron");
let sharedDisplay;
let onSharedDisplay = true;
app.on("ready", () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  sharedDisplay =
    screen.getAllDisplays().find((disp) => disp.id !== primaryDisplay.id) ||
    primaryDisplay;
  // mainWindow.webContents.openDevTools({ mode: "right" });

  const queryParams = {
    query: {
      displayCount: screen.getAllDisplays().length,
      sharedDisplayId: sharedDisplay.id,
      primaryDisplayId: primaryDisplay.id,
    },
  };
  const { x, y } = primaryDisplay.bounds;
  const mainWindow = new BrowserWindow({
    x,
    y,
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: true,
    },
  });
  mainWindow.center();
  mainWindow.loadFile("index.html", queryParams);

  if (screen.getAllDisplays().length > 1) {
    mainWindow.on("move", () => {
      const display = screen.getDisplayMatching(mainWindow.getBounds());
      if (display.id !== sharedDisplay.id) {
        onSharedDisplay = false;
      } else {
        onSharedDisplay = true;
      }
      mainWindow.webContents.send("off-screen", onSharedDisplay);
    });
  }

  ipcMain.on("open-recording", (event, fileBaseName) => {
    const path = require("path");

    shell.openItem(path.join(__dirname, fileBaseName));
  });
});

app.on("window-all-closed", function () {
  app.quit();
});
