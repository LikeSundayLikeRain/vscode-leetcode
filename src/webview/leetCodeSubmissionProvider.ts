// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { ViewColumn } from "vscode";
import { getWebviewViewColumn } from "../utils/settingUtils";
import { openKeybindingsEditor, promptHintMessage } from "../utils/uiUtils";
import { ILeetCodeWebviewOption, LeetCodeWebview } from "./LeetCodeWebview";
import { markdownEngine } from "./markdownEngine";

class LeetCodeSubmissionProvider extends LeetCodeWebview {

    protected readonly viewType: string = "leetcode.submission";
    private result: IResult;
    private structuredResult: ISubmissionResult | undefined;

    public show(resultString: string): void {
        this.result = this.parseResult(resultString);
        this.structuredResult = this.parseStructuredResult(resultString);
        this.showWebviewInternal();
        this.showKeybindingsHint();
    }

    protected getWebviewOption(): ILeetCodeWebviewOption {
        const { viewColumn } = getWebviewViewColumn();
        return {
            title: "Submission",
            viewColumn: viewColumn === ViewColumn.One ? ViewColumn.One : ViewColumn.Two,
        };
    }

    protected getWebviewContent(): string {
        const styles: string = markdownEngine.getStyles();

        if (this.structuredResult && this.structuredResult.testCases.length > 0) {
            const body: string = this.getAccordionContent(this.structuredResult);
            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src vscode-resource: 'unsafe-inline';"/>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    ${styles}
                    ${this.getAccordionStyles()}
                </head>
                <body class="vscode-body 'scrollBeyondLastLine' 'wordWrap' 'showEditorSelection'" style="tab-size:4">
                    ${body}
                </body>
                </html>
            `;
        }

        // Fallback: legacy flat rendering
        const title: string = `## ${this.result.messages[0]}`;
        const messages: string[] = this.result.messages.slice(1).map((m: string) => `* ${m}`);
        const sections: string[] = Object.keys(this.result)
            .filter((key: string) => key !== "messages")
            .map((key: string) => [
                `### ${key}`,
                "```",
                this.result[key].join("\n"),
                "```",
            ].join("\n"));
        const body: string = markdownEngine.render([
            title,
            ...messages,
            ...sections,
        ].join("\n"));
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; script-src vscode-resource:; style-src vscode-resource:;"/>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${styles}
            </head>
            <body class="vscode-body 'scrollBeyondLastLine' 'wordWrap' 'showEditorSelection'" style="tab-size:4">
                ${body}
            </body>
            </html>
        `;
    }

    protected onDidDisposeWebview(): void {
        super.onDidDisposeWebview();
    }

    private async showKeybindingsHint(): Promise<void> {
        await promptHintMessage(
            "hint.commandShortcut",
            'You can customize shortcut key bindings in File > Preferences > Keyboard Shortcuts with query "leetcode".',
            "Open Keybindings",
            (): Promise<any> => openKeybindingsEditor("leetcode solution"),
        );
    }

    private parseResult(raw: string): IResult {
        raw = raw.concat("  √ "); // Append a dummy sentinel to the end of raw string
        const regSplit: RegExp = /  [√×✔✘vx] ([^]+?)\n(?=  [√×✔✘vx] )/g;
        const regKeyVal: RegExp = /(.+?): ([^]*)/;
        const result: IResult = { messages: [] };
        let entry: RegExpExecArray | null;
        do {
            entry = regSplit.exec(raw);
            if (!entry) {
                continue;
            }
            const kvMatch: RegExpExecArray | null = regKeyVal.exec(entry[1]);
            if (kvMatch) {
                const [key, value] = kvMatch.slice(1);
                if (value) { // Do not show empty string
                    if (!result[key]) {
                        result[key] = [];
                    }
                    result[key].push(value);
                }
            } else {
                result.messages.push(entry[1]);
            }
        } while (entry);
        return result;
    }

    private findResultKey(result: IResult, ...patterns: string[]): string | undefined {
        const keys = Object.keys(result);
        for (const pattern of patterns) {
            const lower = pattern.toLowerCase();
            const found = keys.find((k) => k.toLowerCase().startsWith(lower));
            if (found) { return found; }
        }
        return undefined;
    }

    private parseStructuredResult(raw: string): ISubmissionResult | undefined {
        const result = this.parseResult(raw);

        const outputKey = this.findResultKey(result, "Output", "Your output", "Your Output");
        const expectedKey = this.findResultKey(result, "Expected", "Expected answer", "Expected Answer");

        if (!outputKey || !expectedKey) {
            return undefined;
        }

        const inputKey = this.findResultKey(result, "Input", "Your input", "Your Input");
        const stdoutKey = this.findResultKey(result, "Stdout");

        const rawInputs = inputKey ? result[inputKey] : [];
        const outputs = result[outputKey];
        const expected = result[expectedKey];
        const stdouts = stdoutKey ? result[stdoutKey] : [];

        const caseCount = Math.max(outputs.length, expected.length);
        if (caseCount === 0) {
            return undefined;
        }

        // Distribute input lines evenly across test cases.
        // The CLI may put all inputs under one key as a single multi-line string
        // (e.g. 6 lines for 3 cases with 2 params each).
        let inputsPerCase: string[][] = [];
        if (rawInputs.length === 1 && caseCount > 1) {
            const allLines = rawInputs[0].split("\n").filter((l) => l.trim());
            const linesPerCase = Math.floor(allLines.length / caseCount);
            if (linesPerCase > 0) {
                for (let i = 0; i < caseCount; i++) {
                    inputsPerCase.push(allLines.slice(i * linesPerCase, (i + 1) * linesPerCase));
                }
            } else {
                inputsPerCase.push(allLines);
                for (let i = 1; i < caseCount; i++) { inputsPerCase.push([]); }
            }
        } else {
            inputsPerCase = rawInputs.map((inp) => inp ? [inp] : []);
            while (inputsPerCase.length < caseCount) { inputsPerCase.push([]); }
        }

        const testCases: ITestCase[] = [];
        let passedCount = 0;

        for (let i = 0; i < caseCount; i++) {
            const exp = expected[i] || "";
            const out = outputs[i] || "";
            const passed = exp.trim() === out.trim();
            if (passed) { passedCount++; }
            testCases.push({
                index: i + 1,
                passed,
                input: inputsPerCase[i] || [],
                expected: exp,
                output: out,
                stdout: stdouts[i],
            });
        }

        const accepted = passedCount === caseCount;
        const summary = `${passedCount}/${caseCount} cases passed`;

        let runtime: string | undefined;
        let memory: string | undefined;

        // Extract runtime from output key name like "Output (0 ms)"
        if (outputKey) {
            const keyTimeMatch = outputKey.match(/\((.+?\s*ms)\)/i);
            if (keyTimeMatch) { runtime = keyTimeMatch[1].trim(); }
        }

        for (const msg of result.messages) {
            const rtMatch = msg.match(/Runtime:\s*(.+)/i);
            if (rtMatch) { runtime = rtMatch[1].trim(); }
            const memMatch = msg.match(/Memory(?:\s+Usage)?:\s*(.+)/i);
            if (memMatch) { memory = memMatch[1].trim(); }
        }

        return { accepted, runtime, memory, testCases, summary };
    }

    private getAccordionStyles(): string {
        return `
            <style>
                .result-summary {
                    margin-bottom: 1rem;
                    padding: 0.5rem 0;
                }
                .result-summary .passed { color: var(--vscode-testing-iconPassed, #73c991); }
                .result-summary .failed { color: var(--vscode-testing-iconFailed, #f14c4c); }
                .result-summary .stats {
                    font-size: 0.9em;
                    opacity: 0.8;
                    margin-top: 0.25rem;
                }
                details.test-case {
                    margin-bottom: 0.5rem;
                    border: 1px solid var(--vscode-panel-border, #444);
                    border-radius: 4px;
                    overflow: hidden;
                }
                details.test-case summary {
                    padding: 0.5rem 0.75rem;
                    cursor: pointer;
                    font-weight: 500;
                    background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.04));
                    user-select: none;
                }
                details.test-case summary:hover {
                    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.08));
                }
                details.test-case summary .indicator {
                    font-weight: bold;
                    margin-left: 0.5rem;
                }
                details.test-case summary .indicator.pass { color: var(--vscode-testing-iconPassed, #73c991); }
                details.test-case summary .indicator.fail { color: var(--vscode-testing-iconFailed, #f14c4c); }
                details.test-case .case-body {
                    padding: 0.5rem 0.75rem;
                }
                details.test-case .case-body table {
                    width: 100%;
                    border-collapse: collapse;
                }
                details.test-case .case-body td {
                    padding: 0.25rem 0.5rem;
                    vertical-align: top;
                    border-bottom: 1px solid var(--vscode-panel-border, #333);
                }
                details.test-case .case-body td:first-child {
                    width: 80px;
                    font-weight: 500;
                    opacity: 0.8;
                    white-space: nowrap;
                }
                details.test-case .case-body td:last-child {
                    font-family: var(--vscode-editor-font-family, monospace);
                }
                details.test-case .case-body tr:last-child td {
                    border-bottom: none;
                }
                details.test-case .case-body pre {
                    margin: 0;
                    white-space: pre-wrap;
                }
            </style>
        `;
    }

    private getAccordionContent(result: ISubmissionResult): string {
        const statusIcon = result.accepted ? "&#x2713;" : "&#x2717;";
        const statusClass = result.accepted ? "passed" : "failed";
        const statusText = result.accepted ? "Accepted" : "Failed";

        let summaryHtml = `
            <div class="result-summary">
                <h2><span class="${statusClass}">${statusIcon} ${statusText}</span></h2>
                <div class="stats">${result.summary}`;
        if (result.runtime) { summaryHtml += ` &middot; Runtime: ${result.runtime}`; }
        if (result.memory) { summaryHtml += ` &middot; Memory: ${result.memory}`; }
        summaryHtml += `</div></div>`;

        const casesHtml = result.testCases.map((tc) => {
            const open = tc.passed ? "" : " open";
            const indicatorClass = tc.passed ? "pass" : "fail";
            const indicatorText = tc.passed ? "&#x2713; Passed" : "&#x2717; Failed";
            let rows = "";
            if (tc.input.length > 0) {
                rows += `<tr><td>Input</td><td><pre><code>${this.escapeHtml(tc.input.join("\n"))}</code></pre></td></tr>`;
            }
            rows += `<tr><td>Expected</td><td><pre><code>${this.escapeHtml(tc.expected)}</code></pre></td></tr>`;
            rows += `<tr><td>Output</td><td><pre><code>${this.escapeHtml(tc.output)}</code></pre></td></tr>`;
            if (tc.stdout) {
                rows += `<tr><td>Stdout</td><td><pre><code>${this.escapeHtml(tc.stdout)}</code></pre></td></tr>`;
            }
            return `
                <details class="test-case"${open}>
                    <summary>Case ${tc.index} <span class="indicator ${indicatorClass}">${indicatorText}</span></summary>
                    <div class="case-body"><table>${rows}</table></div>
                </details>
            `;
        }).join("\n");

        return summaryHtml + casesHtml;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
}

interface IResult {
    [key: string]: string[];
    messages: string[];
}

interface ITestCase {
    index: number;
    passed: boolean;
    input: string[];
    expected: string;
    output: string;
    stdout?: string;
}

interface ISubmissionResult {
    accepted: boolean;
    runtime?: string;
    memory?: string;
    testCases: ITestCase[];
    summary: string;
}

export const leetCodeSubmissionProvider: LeetCodeSubmissionProvider = new LeetCodeSubmissionProvider();
