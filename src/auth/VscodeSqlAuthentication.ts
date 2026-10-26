import type * as vscode from "vscode";
import type { SqlServerConnectionProfile } from "../types";

const AUTHENTICATION_PROVIDER_ID = "microsoft";
const SQL_RESOURCE_SCOPE = "https://database.windows.net/.default";

export interface VscodeAuthenticationApi {
  getAccounts(
    providerId: string,
  ): Thenable<readonly vscode.AuthenticationSessionAccountInformation[]>;
  getSession(
    providerId: string,
    scopes: readonly string[],
    options?: vscode.AuthenticationGetSessionOptions,
  ): Thenable<vscode.AuthenticationSession | undefined>;
}

export interface VscodeSqlCredentials {
  accessToken: string;
}

function normalizeAccountIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function sessionAccountMatchesProfileUsername(
  account: vscode.AuthenticationSessionAccountInformation,
  username: string,
): boolean {
  const normalizedUsername = normalizeAccountIdentifier(username);
  return [account.id, account.label].some(
    (identifier) =>
      normalizeAccountIdentifier(identifier) === normalizedUsername,
  );
}

export async function getVscodeSqlAccessToken(
  profile: SqlServerConnectionProfile,
  authentication: VscodeAuthenticationApi,
): Promise<VscodeSqlCredentials> {
  const username = profile.username?.trim();
  const tenantId = profile.tenantId?.trim();
  const scopes = [SQL_RESOURCE_SCOPE];
  if (tenantId) {
    scopes.push(`VSCODE_TENANT:${tenantId}`);
  }

  // Attempt to find a preferred account in VS Code that matches the SQL profile username.
  let preferredAccount:
    | vscode.AuthenticationSessionAccountInformation
    | undefined;
  if (username) {
    const accounts = await authentication.getAccounts(
      AUTHENTICATION_PROVIDER_ID,
    );

    preferredAccount = accounts.find((account) =>
      sessionAccountMatchesProfileUsername(account, username),
    );

    if (!preferredAccount) {
      console.debug(
        "[JSQL Auth] No Microsoft account found in VS Code that matches the SQL profile username.",
      );
    }
  }

  // Attempt to get a silent session first, if possible.
  let session: vscode.AuthenticationSession | undefined;
  try {
    session = await authentication.getSession(
      AUTHENTICATION_PROVIDER_ID,
      scopes,
      { account: preferredAccount, silent: true },
    );

    if (
      session?.accessToken &&
      (!username ||
        sessionAccountMatchesProfileUsername(session.account, username))
    ) {
      console.debug("[JSQL Auth] Silent token lookup completed.", {
        sessionFound: Boolean(session),
      });
      return { accessToken: session.accessToken };
    }
  } catch {
    console.debug(
      "[JSQL Auth] Silent token lookup did not succeed; interactive authentication may be required.",
    );
    // A silent request can reject when JSQL still needs the user's consent.
  }

  // If we reach this point, we need to prompt the user for consent or to select an account interactively.
  console.debug("[JSQL Auth] Requesting interactive Microsoft sign-in.");
  session = await authentication.getSession(
    AUTHENTICATION_PROVIDER_ID,
    scopes,
    {
      account: preferredAccount,
      ...(username && !preferredAccount
        ? { clearSessionPreference: true }
        : {}),
      createIfNone: {
        detail: "JSQL needs a Microsoft Entra token to connect to Azure SQL.",
      },
    },
  );

  if (!session) {
    throw new Error(
      "VS Code did not return a Microsoft Entra authentication session.",
    );
  }
  if (!session.accessToken) {
    throw new Error("VS Code returned an empty Microsoft Entra access token.");
  }
  if (
    username &&
    !sessionAccountMatchesProfileUsername(session.account, username)
  ) {
    throw new Error(
      "The selected Microsoft account does not match the account in the active SQL connection.",
    );
  }

  return { accessToken: session.accessToken };
}
