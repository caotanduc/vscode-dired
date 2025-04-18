import * as vscode from "vscode";
import { DiredPanel } from "./DiredPanel";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "vscode-dired-mode.open",
    () => {
      DiredPanel.createOrShow(context.extensionUri);
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
