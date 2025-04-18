import * as vscode from "vscode";
import * as path from "path";
import { getFileEntryInfo } from "./utils/getFileEntryInfo";

export class DiredPanel {
  public static currentPanel: DiredPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _cwd: string;
  private _cursorMap: Record<string, number> = {};
  private _focusedFile: string | null = null;

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.One;

    let activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    let cwd = activeFilePath
      ? path.dirname(activeFilePath)
      : vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";

    if (DiredPanel.currentPanel) {
      DiredPanel.currentPanel._cwd = cwd;
      DiredPanel.currentPanel._focusedFile = activeFilePath ?? null;
      DiredPanel.currentPanel._update();
      DiredPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dired",
      "Dired Explorer",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
        retainContextWhenHidden: true,
      }
    );

    const diredPanel = new DiredPanel(panel, extensionUri, cwd);
    // diredPanel._cwd = cwd;
    diredPanel._focusedFile = activeFilePath ?? null;
    DiredPanel.currentPanel = diredPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    cwd: string = ""
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._cwd = cwd || vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";

    this._update();

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        const target = path.join(this._cwd, message?.path || "");

        switch (message.command) {
          case "delete":
            await vscode.workspace.fs.delete(vscode.Uri.file(target));
            this._update();
            break;
          case "open": {
            const { path: msgPath, cursorIndex } = message;
            if (cursorIndex !== undefined) {
              this._cursorMap[this._cwd] = cursorIndex;
            }

            if (msgPath === "..") {
              const root =
                vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
              if (this._cwd !== root) {
                this._cwd = path.dirname(this._cwd);
                this._update();
              }
              return;
            }
            const stat = await vscode.workspace.fs.stat(
              vscode.Uri.file(target)
            );
            if (stat.type === vscode.FileType.Directory) {
              this._cwd = target;
              this._update();
            } else {
              vscode.commands.executeCommand(
                "vscode.open",
                vscode.Uri.file(target)
              );
            }
            break;
          }
          case "reload": {
            this._update();
            break;
          }
          case "confirmDelete": {
            const confirmed = await vscode.window.showWarningMessage(
              `Are you sure you want to delete ${message.path}?`,
              { modal: true },
              "Delete"
            );
            if (confirmed === "Delete") {
              const target = path.join(this._cwd, message.path);
              await vscode.workspace.fs.delete(vscode.Uri.file(target));
              this._update();
            }
            break;
          }
          case "requestRename": {
            const newName = await vscode.window.showInputBox({
              prompt: `Rename ${message.path} to:`,
              value: message.path,
            });
            if (newName && newName !== message.path) {
              const oldPath = path.join(this._cwd, message.path);
              const newPath = path.join(this._cwd, newName);
              await vscode.workspace.fs.rename(
                vscode.Uri.file(oldPath),
                vscode.Uri.file(newPath)
              );
              this._update();
            }
            break;
          }
          case "expand": {
            const absPath = path.join(this._cwd, message.path);
            const entries = await vscode.workspace.fs.readDirectory(
              vscode.Uri.file(absPath)
            );

            const detailed = await Promise.all(
              entries.map(([name, type]) =>
                getFileEntryInfo(absPath, [name, type])
              )
            );

            const items = detailed
              .map(({ name, type, mode, size, mtime }, index) => {
                const typeChar = type === vscode.FileType.Directory ? "d" : "-";
                const display = `${typeChar}${mode.padEnd(
                  4
                )} ${size} ${mtime}          ${
                  index === detailed.length - 1 ? "└──" : "├──"
                } ${name}`;
                const isHidden = name.startsWith(".");
                const className = [
                  isHidden ? "hidden-file" : "",
                  type === vscode.FileType.Directory ? "directory" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return `<li tabindex="0" class="${className}" data-path="${message.path}/${name}" data-type="${type}" style="padding-left: 0;">${display}</li>`;
              })
              .join("");

            this._panel.webview.postMessage({
              command: "renderExpand",
              html: items,
              index: message.index,
            });

            break;
          }
          case "createNewFile": {
            const { path: relativePath, type } = message;
            let basePath: string;

            if (type === vscode.FileType.Directory) {
              basePath = path.join(this._cwd, relativePath);
            } else {
              basePath = this._cwd;
            }

            const fileName = await vscode.window.showInputBox({
              prompt: `New file in ${basePath}`,
            });

            if (fileName) {
              const newFilePath = path.join(basePath, fileName);
              const uri = vscode.Uri.file(newFilePath);

              let exists = false;
              try {
                await vscode.workspace.fs.stat(uri);
                exists = true;
              } catch {
                exists = false;
              }

              if (!exists) {
                await vscode.workspace.fs.writeFile(uri, new Uint8Array());
                this._update();
              } else {
                vscode.window.showErrorMessage(
                  `File "${fileName}" already exists.`
                );
              }
            }

            break;
          }
          case "createNewDir": {
            const { path: relativePath, type } = message;
            let basePath: string;

            if (type === vscode.FileType.Directory) {
              basePath = path.join(this._cwd, relativePath);
            } else {
              basePath = this._cwd;
            }

            const dirName = await vscode.window.showInputBox({
              prompt: `New directory in ${basePath}`,
            });

            if (dirName) {
              const newDirPath = path.join(basePath, dirName);
              const uri = vscode.Uri.file(newDirPath);

              let exists = false;
              try {
                await vscode.workspace.fs.stat(uri);
                exists = true;
              } catch {
                exists = false;
              }

              if (!exists) {
                await vscode.workspace.fs.createDirectory(uri);
                this._update();
              } else {
                vscode.window.showErrorMessage(
                  `Directory "${dirName}" already exists.`
                );
              }
            }

            break;
          }
        }
      },
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose() {
    DiredPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  private async _update() {
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(this._cwd)
    );
    const detailed = await Promise.all(
      entries.map(([name, type]) => getFileEntryInfo(this._cwd, [name, type]))
    );

    const html = this._getHtml(detailed, this._cwd);
    this._panel.webview.html = html;
  }

  private _getHtml(
    files: {
      name: string;
      type: vscode.FileType;
      mode: string;
      size: string;
      mtime: string;
    }[],
    cwd: string
  ): string {
    const list = files
      .map(({ name, type, mode, size, mtime }) => {
        const typeChar = type === vscode.FileType.Directory ? "d" : "-";
        const display = `${typeChar}${mode.padEnd(
          4
        )} ${size} ${mtime}          ${name}`;
        const isHidden = name.startsWith(".");
        const className = [
          isHidden ? "hidden-file" : "",
          type === vscode.FileType.Directory ? "directory" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `<li tabindex="0" data-path="${name}" data-type="${type}" class="${className}">${display}<ul class="nested" style="display: none;"></ul></li>`;
      })
      .join("");

    const focusedFileName = this._focusedFile
      ? path.basename(this._focusedFile)
      : null;

    const savedIndex = this._cursorMap[cwd] ?? 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: monospace; padding: 10px; }
    li:focus { outline: none; background: #ddd; }
    ul { list-style: none; padding: 0; }
    li { padding: 2px 4px; cursor: pointer; white-space: pre; color: black; font-weight: normal; }
    li.active { background: #ddd; }
    .nested {}
    .hidden-file { color: green; }
    .directory { color: blue; font-weight: 700; }
  </style>
</head>
<body>
  <h2>${cwd}</h2>
  <ul id="file-list">${list}</ul>
  <script>
    window.addEventListener('message', (event) => {
      const { command, html, index } = event.data;
      if (command === 'renderExpand') {
        const li = list[index];
        const nested = li.querySelector('.nested');
        if (nested) {
          nested.innerHTML = html;
          nested.style.display = 'block';
        }
      }
    });

    const vscode = acquireVsCodeApi();
    const list = document.querySelectorAll('#file-list li');
    let index = ${savedIndex} || 0;

    const focusedFile = ${JSON.stringify(focusedFileName)};
    if (focusedFile) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].dataset.path === focusedFile) {
          index = i;
          break;
        }
      }
    }

    function focusItem(i) {
      list.forEach((el) => el.classList.remove('active'));
      if (list[i]) {
        list[i].focus();
        list[i].classList.add('active');
        index = i;
      }
    }

    function openPath(path, index) {
      vscode.postMessage({ command: 'open', path, cursorIndex: index });
    }

    focusItem(index);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'j') {
        index = (index + 1) % list.length;
        focusItem(index);
      } else if (e.key === 'k') {
        index = (index - 1 + list.length) % list.length;
        focusItem(index);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const path = list[index].dataset.path;
        vscode.postMessage({ command: 'confirmDelete', path });
      } else if (e.key === 'r') {
        const oldPath = list[index].dataset.path;
        vscode.postMessage({ command: 'requestRename', path: oldPath });
      } else if (e.key === 'Enter') {
        const path = list[index].dataset.path;
        openPath(path, index);
      } else if (e.key === 'g') {
        vscode.postMessage({ command: 'reload' });
      } else if (e.key === '-') {
        openPath('..', index);
      } else if (e.key === '+') {
        const active = list[index];
        const type = parseInt(active.dataset.type, 10);
        const path = active.dataset.path;
        vscode.postMessage({ command: 'createNewFile', path, type });
      } else if (e.key === ' ') {
        const li = list[index];
        const path = li.dataset.path;
        const type = li.dataset.type;
        if (type === String(2)) {
          vscode.postMessage({ command: 'expand', path, index });
        }
      } else if (e.key === 'd') {
        const active = list[index];
        const type = parseInt(active.dataset.type, 10);
        const path = active.dataset.path;
        vscode.postMessage({ command: 'createNewDir', path, type });
      }
    });
  </script>
</body>
</html>`;
  }
}
