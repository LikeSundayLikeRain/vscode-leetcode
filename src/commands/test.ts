// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as fse from "fs-extra";
import * as vscode from "vscode";
import { explorerNodeManager } from "../explorer/explorerNodeManager";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { leetCodeManager } from "../leetCodeManager";
import { queryExampleTestcases } from "../request/query-example-testcases";
import { leetCodeChannel } from "../leetCodeChannel";
import { IQuickItemEx, UserStatus } from "../shared";
import { getNodeIdFromFile } from "../utils/problemUtils";
import { DialogType, promptForOpenOutputChannel, showFileSelectDialog } from "../utils/uiUtils";
import { getActiveFilePath } from "../utils/workspaceUtils";
import { leetCodeSubmissionProvider } from "../webview/leetCodeSubmissionProvider";
import { leetCodeTestInputProvider } from "../webview/leetCodeTestInputProvider";

export async function testSolution(uri?: vscode.Uri): Promise<void> {
    try {
        if (leetCodeManager.getStatus() === UserStatus.SignedOut) {
            return;
        }

        const filePath: string | undefined = await getActiveFilePath(uri);
        if (!filePath) {
            return;
        }
        const picks: Array<IQuickItemEx<string>> = [];
        picks.push(
            {
                label: "$(three-bars) Default test cases",
                description: "",
                detail: "Test with the default cases",
                value: ":default",
            },
            {
                label: "$(pencil) Write directly...",
                description: "",
                detail: "Write test cases in input box",
                value: ":direct",
            },
            {
                label: "$(file-text) Browse...",
                description: "",
                detail: "Test with the written cases in file",
                value: ":file",
            },
        );
        const choice: IQuickItemEx<string> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }

        let result: string | undefined;
        switch (choice.value) {
            case ":default":
                try {
                    // Get problem slug from file path
                    const id: string = await getNodeIdFromFile(filePath);
                    const node = explorerNodeManager.getNodeById(id);
                    if (node) {
                        // Derive LeetCode slug from name (custom logic preserves "3sum" format; _.kebabCase would produce "3-sum")
                        const slug = node.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                        if (!slug) { break; }
                        const testcases: string[] = await queryExampleTestcases(slug);
                        if (testcases.length > 0) {
                            result = await leetCodeExecutor.testSolution(filePath, testcases.join("\n"));
                            break;
                        }
                    }
                } catch (error) {
                    leetCodeChannel.appendLine(`Failed to fetch example test cases: ${error}`);
                }
                // Fallback: use CLI default (single test case)
                result = await leetCodeExecutor.testSolution(filePath);
                break;
            case ":direct":
                const testString: string | undefined = await leetCodeTestInputProvider.getTestInput();
                if (testString) {
                    result = await leetCodeExecutor.testSolution(filePath, testString);
                }
                break;
            case ":file":
                const testFile: vscode.Uri[] | undefined = await showFileSelectDialog(filePath);
                if (testFile && testFile.length) {
                    const input: string = (await fse.readFile(testFile[0].fsPath, "utf-8")).trim();
                    if (input) {
                        result = await leetCodeExecutor.testSolution(filePath, input);
                    } else {
                        vscode.window.showErrorMessage("The selected test file must not be empty.");
                    }
                }
                break;
            default:
                break;
        }
        if (!result) {
            return;
        }
        leetCodeSubmissionProvider.show(result);
    } catch (error) {
        await promptForOpenOutputChannel("Failed to test the solution. Please open the output channel for details.", DialogType.error);
    }
}

