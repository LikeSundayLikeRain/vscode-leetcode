// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { ViewColumn } from "vscode";
import { ILeetCodeWebviewOption, LeetCodeWebview } from "./LeetCodeWebview";

class LeetCodeTestInputProvider extends LeetCodeWebview {

    protected readonly viewType: string = "leetcode.testInput";
    private resolve: ((value: string | undefined) => void) | undefined;

    public async getTestInput(): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve, reject) => {
            this.resolve = resolve;
            try {
                this.showWebviewInternal();
            } catch (error) {
                this.resolve = undefined;
                reject(error);
            }
        });
    }

    protected getWebviewOption(): ILeetCodeWebviewOption {
        return {
            title: "Enter Test Cases",
            viewColumn: ViewColumn.Active,
        };
    }

    protected getWebviewContent(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"/>
                <style>
                    body {
                        padding: 16px;
                        font-family: var(--vscode-font-family);
                    }
                    label {
                        display: block;
                        margin-bottom: 8px;
                        font-weight: bold;
                    }
                    textarea {
                        width: 100%;
                        min-height: 200px;
                        padding: 8px;
                        font-family: var(--vscode-editor-font-family, monospace);
                        font-size: var(--vscode-editor-font-size, 14px);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        resize: vertical;
                    }
                    textarea:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                    }
                    .buttons {
                        margin-top: 12px;
                        display: flex;
                        gap: 8px;
                    }
                    button {
                        padding: 6px 16px;
                        border: 0;
                        color: white;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    #submit {
                        background-color: var(--vscode-button-background);
                    }
                    #submit:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    #cancel {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    #cancel:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    .hint {
                        margin-top: 8px;
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <label for="testcases">Test Cases</label>
                <textarea id="testcases" placeholder="Enter test cases, one per line.&#10;&#10;Example:&#10;[1,2,3]&#10;4" autofocus></textarea>
                <p class="hint">Enter each argument on its own line. Separate multiple test cases with a blank line.</p>
                <div class="buttons">
                    <button id="submit">Submit</button>
                    <button id="cancel">Cancel</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('submit').onclick = () => {
                        const value = document.getElementById('testcases').value.trim();
                        if (value) {
                            vscode.postMessage({ command: 'submit', testcases: value });
                        }
                    };
                    document.getElementById('cancel').onclick = () => {
                        vscode.postMessage({ command: 'cancel' });
                    };
                    document.getElementById('testcases').addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            document.getElementById('submit').click();
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command) {
            case "submit":
                if (this.resolve) {
                    const testcases = typeof message.testcases === "string" ? message.testcases : undefined;
                    this.resolve(testcases);
                    this.resolve = undefined;
                }
                this.dispose();
                break;
            case "cancel":
                if (this.resolve) {
                    this.resolve(undefined);
                    this.resolve = undefined;
                }
                this.dispose();
                break;
        }
    }

    protected onDidDisposeWebview(): void {
        super.onDidDisposeWebview();
        if (this.resolve) {
            this.resolve(undefined);
            this.resolve = undefined;
        }
    }
}

export const leetCodeTestInputProvider: LeetCodeTestInputProvider = new LeetCodeTestInputProvider();
