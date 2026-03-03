// Copyright (c) leo.zhao. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

const CookieKey = "leetcode-cookie";
const UserStatusKey = "leetcode-user-status";
const FollowModeKey = "leetcode-follow-mode";
const DescCacheKey = "leetcode-desc-cache";

export type UserDataType = {
    isSignedIn: boolean;
    isPremium: boolean;
    username: string;
    avatar: string;
    isVerified?: boolean;
};

class GlobalState {
    private context: vscode.ExtensionContext;
    private _state: vscode.Memento;
    private _cookie: string;
    private _userStatus: UserDataType;

    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        this._state = this.context.globalState;
    }

    public setCookie(cookie: string): any {
        this._cookie = cookie;
        return this._state.update(CookieKey, this._cookie);
    }
    public getCookie(): string | undefined {
        return this._cookie ?? this._state.get(CookieKey);
    }

    public setUserStatus(userStatus: UserDataType): any {
        this._userStatus = userStatus;
        return this._state.update(UserStatusKey, this._userStatus);
    }

    public getUserStatus(): UserDataType | undefined {
        return this._userStatus ?? this._state.get(UserStatusKey);
    }

    public setFollowMode(enabled: boolean): Thenable<void> {
        return this._state.update(FollowModeKey, enabled);
    }

    public getFollowMode(): boolean {
        return this._state.get<boolean>(FollowModeKey, false);
    }

    public getDescCache(cacheKey: string, ttlMs: number): string | undefined {
        const cache: DescCache = this._state.get<DescCache>(DescCacheKey, {});
        const entry = cache[cacheKey];
        if (entry && (Date.now() - entry.ts) < ttlMs) {
            return entry.desc;
        }
        return undefined;
    }

    public setDescCache(cacheKey: string, desc: string): Thenable<void> {
        const cache: DescCache = this._state.get<DescCache>(DescCacheKey, {});
        cache[cacheKey] = { desc, ts: Date.now() };
        return this._state.update(DescCacheKey, cache);
    }

    public removeCookie(): void {
        this._state.update(CookieKey, undefined);
    }

    public removeAll(): void {
        this._state.update(CookieKey, undefined);
        this._state.update(UserStatusKey, undefined);
    }
}

interface IDescCacheEntry {
    desc: string;
    ts: number;
}

type DescCache = Record<string, IDescCacheEntry>;

export const globalState: GlobalState = new GlobalState();
