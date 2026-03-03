// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { ViewColumn, workspace, WorkspaceConfiguration } from "vscode";
import { DescriptionConfiguration, WebviewPosition } from "../shared";

export function getWorkspaceConfiguration(): WorkspaceConfiguration {
    return workspace.getConfiguration("leetcode");
}

export function shouldHideSolvedProblem(): boolean {
    return getWorkspaceConfiguration().get<boolean>("hideSolved", false);
}

export function shouldHideLockedProblem(): boolean {
    return getWorkspaceConfiguration().get<boolean>("hideLocked", false);
}

export function getWorkspaceFolder(): string {
    return getWorkspaceConfiguration().get<string>("workspaceFolder", "");
}

export function getEditorShortcuts(): string[] {
    return getWorkspaceConfiguration().get<string[]>("editor.shortcuts", ["submit", "test"]);
}

export function hasStarShortcut(): boolean {
    const shortcuts: string[] = getWorkspaceConfiguration().get<string[]>("editor.shortcuts", ["submit", "test"]);
    return shortcuts.indexOf("star") >= 0;
}

export function shouldUseEndpointTranslation(): boolean {
    return getWorkspaceConfiguration().get<boolean>("useEndpointTranslation", true);
}

export function getDescriptionConfiguration(): IDescriptionConfiguration {
    const setting: string = getWorkspaceConfiguration().get<string>("showDescription", DescriptionConfiguration.InWebView);
    const config: IDescriptionConfiguration = {
        showInComment: false,
        showInWebview: true,
    };
    switch (setting) {
        case DescriptionConfiguration.Both:
            config.showInComment = true;
            config.showInWebview = true;
            break;
        case DescriptionConfiguration.None:
            config.showInComment = false;
            config.showInWebview = false;
            break;
        case DescriptionConfiguration.InFileComment:
            config.showInComment = true;
            config.showInWebview = false;
            break;
        case DescriptionConfiguration.InWebView:
            config.showInComment = false;
            config.showInWebview = true;
            break;
    }

    // To be compatible with the deprecated setting:
    if (getWorkspaceConfiguration().get<boolean>("showCommentDescription")) {
        config.showInComment = true;
    }

    return config;
}

export function getWebviewViewColumn(): { viewColumn: ViewColumn; preserveFocus: boolean } {
    const config = getWorkspaceConfiguration();
    let position = config.get<string>("webviewPosition");

    // Migration: fall back to deprecated enableSideMode if webviewPosition is unset or invalid
    const validPositions: string[] = Object.values(WebviewPosition);
    if (!position || !validPositions.includes(position)) {
        const enableSideMode = config.get<boolean>("enableSideMode", true);
        position = enableSideMode ? WebviewPosition.Right : WebviewPosition.Left;
    }

    switch (position) {
        case WebviewPosition.Left:
            return { viewColumn: ViewColumn.One, preserveFocus: false };
        case WebviewPosition.Current:
            return { viewColumn: ViewColumn.Active, preserveFocus: false };
        case WebviewPosition.Right:
        default:
            return { viewColumn: ViewColumn.Two, preserveFocus: true };
    }
}

export interface IDescriptionConfiguration {
    showInComment: boolean;
    showInWebview: boolean;
}
