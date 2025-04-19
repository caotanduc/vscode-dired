import * as vscode from "vscode";
import { DiredPanel } from "./DiredPanel";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "vscode-dired.open",
    () => {
      DiredPanel.createOrShow(context.extensionUri);
    }
  );
  context.subscriptions.push(disposable);
}
