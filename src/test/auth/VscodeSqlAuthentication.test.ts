import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import {
  getVscodeSqlAccessToken,
  VscodeAuthenticationApi,
} from "../../auth/VscodeSqlAuthentication";
import {
  DatabaseProvider,
  type SqlServerConnectionProfile,
} from "../../types/ConnectionProfile";

const account: vscode.AuthenticationSessionAccountInformation = {
  id: "aad-account-id",
  label: "user@example.com",
};

const session: vscode.AuthenticationSession = {
  id: "sql-resource-session",
  accessToken: "sql-resource-token",
  account,
  scopes: ["https://database.windows.net/.default"],
};

function createProfile(
  overrides: Partial<SqlServerConnectionProfile> = {},
): SqlServerConnectionProfile {
  return {
    name: "Azure SQL",
    provider: DatabaseProvider.SqlServer,
    host: "example.database.windows.net",
    port: 1433,
    username: account.label,
    authentication: "Active Directory Interactive",
    ...overrides,
  };
}

describe("VS Code SQL authentication", () => {
  it("uses an existing silent session for the matching account and tenant", async () => {
    const getSession = vi.fn(async () => session);
    const authentication: VscodeAuthenticationApi = {
      getAccounts: vi.fn(async () => [account]),
      getSession,
    };

    const credentials = await getVscodeSqlAccessToken(
      createProfile({ tenantId: "tenant-id" }),
      authentication,
    );

    expect(credentials).toEqual({
      accessToken: session.accessToken,
    });
    expect(getSession).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledWith(
      "microsoft",
      ["https://database.windows.net/.default", "VSCODE_TENANT:tenant-id"],
      { account, silent: true },
    );
  });

  it("prompts through VS Code when no silent session exists", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(session);
    const authentication: VscodeAuthenticationApi = {
      getAccounts: vi.fn(async () => [account]),
      getSession,
    };

    const credentials = await getVscodeSqlAccessToken(
      createProfile(),
      authentication,
    );

    expect(credentials).toEqual({
      accessToken: session.accessToken,
    });
    expect(getSession).toHaveBeenNthCalledWith(
      1,
      "microsoft",
      ["https://database.windows.net/.default"],
      { account, silent: true },
    );
    expect(getSession).toHaveBeenNthCalledWith(
      2,
      "microsoft",
      ["https://database.windows.net/.default"],
      {
        account,
        createIfNone: {
          detail: "JSQL needs a Microsoft Entra token to connect to Azure SQL.",
        },
      },
    );
  });

  it("continues with generic VS Code auth when profile metadata is absent", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(session);
    const authentication: VscodeAuthenticationApi = {
      getAccounts: vi.fn(async () => [account]),
      getSession,
    };

    await getVscodeSqlAccessToken(
      createProfile({ username: undefined, tenantId: undefined }),
      authentication,
    );

    expect(authentication.getAccounts).not.toHaveBeenCalled();
    expect(getSession).toHaveBeenNthCalledWith(
      1,
      "microsoft",
      ["https://database.windows.net/.default"],
      { silent: true },
    );
    expect(getSession).toHaveBeenNthCalledWith(
      2,
      "microsoft",
      ["https://database.windows.net/.default"],
      {
        createIfNone: {
          detail: "JSQL needs a Microsoft Entra token to connect to Azure SQL.",
        },
      },
    );
  });

  it("rejects a session for an account different from the MSSQL profile", async () => {
    const mismatchedSession = {
      ...session,
      account: { id: "other-account", label: "other@example.com" },
    };
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(mismatchedSession)
      .mockResolvedValueOnce(mismatchedSession);
    const authentication: VscodeAuthenticationApi = {
      getAccounts: vi.fn(async () => []),
      getSession,
    };

    await expect(
      getVscodeSqlAccessToken(createProfile(), authentication),
    ).rejects.toThrow(
      "The selected Microsoft account does not match the account in the active SQL connection.",
    );
    expect(getSession).toHaveBeenNthCalledWith(
      2,
      "microsoft",
      ["https://database.windows.net/.default"],
      {
        clearSessionPreference: true,
        createIfNone: {
          detail: "JSQL needs a Microsoft Entra token to connect to Azure SQL.",
        },
      },
    );
  });

  it("does not use a silent session for a different account", async () => {
    const otherAccountSession = {
      ...session,
      account: { id: "other-account", label: "other@example.com" },
    };
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(otherAccountSession)
      .mockResolvedValueOnce(session);
    const authentication: VscodeAuthenticationApi = {
      getAccounts: vi.fn(async () => []),
      getSession,
    };

    await expect(
      getVscodeSqlAccessToken(createProfile(), authentication),
    ).resolves.toEqual({ accessToken: session.accessToken });

    expect(getSession).toHaveBeenNthCalledWith(
      1,
      "microsoft",
      ["https://database.windows.net/.default"],
      { account: undefined, silent: true },
    );
    expect(getSession).toHaveBeenNthCalledWith(
      2,
      "microsoft",
      ["https://database.windows.net/.default"],
      {
        account: undefined,
        clearSessionPreference: true,
        createIfNone: {
          detail: "JSQL needs a Microsoft Entra token to connect to Azure SQL.",
        },
      },
    );
  });
});
