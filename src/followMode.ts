// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as _ from "lodash";
import { Disposable, StatusBarAlignment, StatusBarItem, TextEditor, window } from "vscode";
import { explorerNodeManager } from "./explorer/explorerNodeManager";
import { leetCodeExecutor } from "./leetCodeExecutor";
import { globalState } from "./globalState";
import { getNodeIdFromFile } from "./utils/problemUtils";
import * as settingUtils from "./utils/settingUtils";
import { leetCodePreviewProvider } from "./webview/leetCodePreviewProvider";

class FollowMode implements Disposable {
    private statusBarItem: StatusBarItem;
    private editorListener: Disposable | undefined;
    private enabled: boolean = false;

    constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
        this.statusBarItem.command = "leetcode.followMode";
    }

    public initialize(): void {
        this.enabled = globalState.getFollowMode();
        if (this.enabled) {
            this.startListening();
        }
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    public toggle(): void {
        this.enabled = !this.enabled;
        globalState.setFollowMode(this.enabled);
        if (this.enabled) {
            this.startListening();
            this.onActiveEditorChanged(window.activeTextEditor);
        } else {
            this.stopListening();
        }
        this.updateStatusBar();
    }

    public dispose(): void {
        this.stopListening();
        this.statusBarItem.dispose();
    }

    private startListening(): void {
        if (!this.editorListener) {
            this.editorListener = window.onDidChangeActiveTextEditor(
                this.debouncedOnActiveEditorChanged,
            );
        }
    }

    private stopListening(): void {
        if (this.editorListener) {
            this.editorListener.dispose();
            this.editorListener = undefined;
        }
    }

    private updateStatusBar(): void {
        if (this.enabled) {
            this.statusBarItem.text = "$(eye) Follow";
            this.statusBarItem.tooltip = "LeetCode Follow Mode: ON (click to toggle)";
        } else {
            this.statusBarItem.text = "$(eye-closed) Follow";
            this.statusBarItem.tooltip = "LeetCode Follow Mode: OFF (click to toggle)";
        }
    }

    private debouncedOnActiveEditorChanged = _.debounce(
        (editor: TextEditor | undefined) => this.onActiveEditorChanged(editor),
        300,
    );

    private async onActiveEditorChanged(editor: TextEditor | undefined): Promise<void> {
        if (!editor || !editor.document || editor.document.uri.scheme !== "file") {
            return;
        }
        const fsPath = editor.document.uri.fsPath;
        try {
            const id = await getNodeIdFromFile(fsPath);
            if (!id) {
                return;
            }
            if (leetCodePreviewProvider.isShowingProblem(id)) {
                return;
            }
            const node = explorerNodeManager.getNodeById(id);
            if (!node) {
                return;
            }
            const needTranslation = settingUtils.shouldUseEndpointTranslation();
            const descString = await leetCodeExecutor.getDescription(node.id, needTranslation);
            leetCodePreviewProvider.show(descString, node);
        } catch {
            // Not a LeetCode file or failed to resolve — silently ignore
        }
    }
}

export const followMode: FollowMode = new FollowMode();
