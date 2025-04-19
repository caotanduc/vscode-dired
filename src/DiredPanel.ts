import * as vscode from "vscode";
import * as path from "path";
import { FileEntryInfo, getFileEntryInfo } from "./utils/getFileEntryInfo";
import { getNonce } from "./utils/getNonce";
import * as fs from "fs/promises";
import { getSymlinkTarget } from "./utils/getSymlinkTarget";

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
      async (message) => this._handleMessage(message),
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  private async _handleMessage(message: any) {
    const target = path.join(this._cwd, message?.path || "");

    switch (message.command) {
      case "delete":
        await this._deleteFile(target);
        break;
      case "open":
        await this._openFile(target, message);
        break;
      case "reload":
        this._update();
        break;
      case "confirmDelete":
        await this._confirmDelete(message.path);
        break;
      case "requestRename":
        await this._renameFile(message);
        break;
      case "expand":
        await this._expandDirectory(message);
        break;
      case "createNewFile":
        await this._createNewFile(message);
        break;
      case "createNewDir":
        await this._createNewDir(message);
        break;
    }
  }

  private async _deleteFile(target: string) {
    await vscode.workspace.fs.delete(vscode.Uri.file(target), {
      recursive: true,
    });
    this._update();
  }

  private async _openFile(target: string, message: any) {
    const { path: msgPath, cursorIndex } = message;
    if (cursorIndex !== undefined) {
      this._cursorMap[this._cwd] = cursorIndex;
    }

    try {
      const stat = await fs.lstat(target);
      if (stat.isDirectory()) {
        this._cwd = target;
        this._update();
      } else {
        vscode.commands.executeCommand("vscode.open", vscode.Uri.file(target));
      }
    } catch {
      vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(message?.path)
      );
    }
  }

  private async _confirmDelete(filePath: string) {
    const confirmed = await vscode.window.showWarningMessage(
      `Are you sure you want to delete ${filePath}?`,
      { modal: true },
      "Delete"
    );
    if (confirmed === "Delete") {
      await this._deleteFile(path.join(this._cwd, filePath));
    }
  }

  private async _renameFile(message: any) {
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
      this._focusedFile = newPath;
      this._update();
    }
  }

  private async _expandDirectory(message: any) {
    const absPath = path.join(this._cwd, message.path);
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(absPath)
    );

    const detailed = await Promise.all(
      entries.map(([name, _]) => getFileEntryInfo(absPath, name))
    );

    const items = this._generateFileListHtml(message.path, detailed, true);

    this._panel.webview.postMessage({
      command: "renderExpand",
      html: items,
      index: message.index,
    });
  }

  private async _createNewFile(message: any) {
    const { path: relativePath, type } = message;
    const joinPath = path.join(this._cwd, relativePath);
    let basePath =
      type === vscode.FileType.Directory ? joinPath : path.dirname(joinPath);

    const fileName = await vscode.window.showInputBox({
      prompt: `New file in ${basePath}`,
    });

    if (fileName) {
      const newFilePath = path.join(basePath, fileName);
      const uri = vscode.Uri.file(newFilePath);
      if (await this._fileExists(uri)) {
        vscode.window.showErrorMessage(`File "${fileName}" already exists.`);
      } else {
        await vscode.workspace.fs.writeFile(uri, new Uint8Array());
        this._focusedFile = newFilePath;
        this._update();
      }
    }
  }

  private async _createNewDir(message: any) {
    const { path: relativePath, type } = message;

    const joinPath = path.join(this._cwd, relativePath);
    let basePath =
      type === vscode.FileType.Directory ? joinPath : path.dirname(joinPath);

    const dirName = await vscode.window.showInputBox({
      prompt: `New directory in ${basePath}`,
    });

    if (dirName) {
      const newDirPath = path.join(basePath, dirName);
      const uri = vscode.Uri.file(newDirPath);
      if (await this._fileExists(uri)) {
        vscode.window.showErrorMessage(
          `Directory "${dirName}" already exists.`
        );
      } else {
        await vscode.workspace.fs.createDirectory(uri);
        this._focusedFile = newDirPath;
        this._update();
      }
    }
  }

  private async _fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private async _navigateUp() {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
    if (this._cwd !== root) {
      this._cwd = path.dirname(this._cwd);
      this._update();
    }
  }

  private async _update() {
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(this._cwd)
    );

    const withSpecialDirs: [string, vscode.FileType][] = [
      [".", vscode.FileType.Directory],
      ...entries,
    ];

    const detailed = await Promise.all(
      withSpecialDirs.map(([name, _]) => {
        return getFileEntryInfo(this._cwd, name);
      })
    );
    this._panel.webview.html = this._getHtml(detailed);
  }

  private _generateFileListHtml(
    parent: string,
    files: FileEntryInfo[],
    showDecorator: boolean = false
  ): string {
    if (parent.startsWith(this._cwd)) {
      parent = parent.slice(this._cwd.length);
    }
    const indentSpace = parent
      ? Math.max(parent.split("/").length - 1, 0) * 4 + 4
      : 0;
    return files
      .map(
        (
          { name, isFile, isDirectory, isSymbolicLink, mode, size, mtime },
          idx
        ) => {
          let linkPath = "";
          if (isSymbolicLink) {
            linkPath = getSymlinkTarget(path.join(this._cwd, name));
          }

          const display = `${mode.padEnd(4)} ${size} ${mtime}        ${
            showDecorator
              ? (idx === files.length - 1 ? "└── " : "├── ").padStart(
                  indentSpace,
                  " "
                )
              : ""
          }${name}${linkPath ? ` -> ${linkPath}` : ""}`;

          const className = [
            isDirectory ? "directory" : "",
            isSymbolicLink ? "symlink" : "",
          ].join(" ");
          return `<li tabindex="0" data-path="${
            showDecorator ? parent + "/" : ""
          }${name}" data-type="${
            isDirectory ? "directory" : isSymbolicLink ? "symlink" : "file"
          }" data-link="${
            isSymbolicLink ? linkPath : ""
          }" class="${className}">${display}<ul class="nested" style="display: none;"></ul></li>`;
        }
      )
      .join("");
  }

  private _getHtml(files: any[]): string {
    const list = this._generateFileListHtml(this._cwd, files);
    const focusedFileName = this._focusedFile
      ? path.basename(this._focusedFile)
      : null;

    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    );

    const mainStyleUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
    );

    const nonce = getNonce();

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${mainStyleUri}" rel="stylesheet">
      </head>
      <body>
        <h2>${this._cwd}</h2>
        <div id="search-bar" style="display: none; position: sticky; top: 0; padding: 5px;">
          <input
            type="text"
            id="search-input"
            placeholder="Search files..."
            style="width: 100%; padding: 4px; font-size: 14px;"
          />
        </div>
        <ul id="file-list">${list}</ul>
        <script>
          window.initialState = {
            focusedFile: ${JSON.stringify(focusedFileName)},
          };
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `;
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
}
