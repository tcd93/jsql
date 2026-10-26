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
  accountId: string;
}

function normalizeAccountIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function sessionMatchesProfile(
  session: vscode.AuthenticationSession,
  username: string | undefined,
): boolean {
  if (!username) {
    return true;
  }

  const normalizedUsername = normalizeAccountIdentifier(username);
  return [session.account.id, session.account.label].some(
    (identifier) =>
      normalizeAccountIdentifier(identifier) === normalizedUsername,
  );
}

export async function getVscodeSqlAccessToken(
  profile: SqlServerConnectionProfile,
  authentication: VscodeAuthenticationApi,
): Promise<VscodeSqlCredentials> {
  const username = profile.username?.trim();
  const scopes = [SQL_RESOURCE_SCOPE];
  if (profile.tenantId) {
    scopes.push(`VSCODE_TENANT:${profile.tenantId}`);
  }
  console.debug(
    "[JSQL Auth] Requesting Azure SQL token through VS Code authentication.",
    {
      hasProfileUsername: Boolean(username),
      hasTenantId: Boolean(profile.tenantId),
    },
  );

  const accounts = username
    ? await authentication.getAccounts(AUTHENTICATION_PROVIDER_ID)
    : [];
  const normalizedUsername = username
    ? normalizeAccountIdentifier(username)
    : undefined;
  const preferredAccount = normalizedUsername
    ? accounts.find((account) =>
        [account.id, account.label].some(
          (identifier) =>
            normalizeAccountIdentifier(identifier) === normalizedUsername,
        ),
      )
    : undefined;
  console.debug("[JSQL Auth] Microsoft account lookup completed.", {
    accountCount: accounts.length,
    matchedProfileAccount: Boolean(preferredAccount),
  });
  const accountOptions = preferredAccount ? { account: preferredAccount } : {};

  let session: vscode.AuthenticationSession | undefined;
  try {
    console.debug("[JSQL Auth] Attempting silent token lookup.");
    session = await authentication.getSession(
      AUTHENTICATION_PROVIDER_ID,
      scopes,
      { ...accountOptions, silent: true },
    );
    console.debug("[JSQL Auth] Silent token lookup completed.", {
      sessionFound: Boolean(session),
    });
  } catch {
    console.debug(
      "[JSQL Auth] Silent token lookup did not succeed; interactive authentication may be required.",
    );
    // A silent request can reject when JSQL still needs the user's consent.
  }

  if (session && sessionMatchesProfile(session, username)) {
    if (!session.accessToken) {
      console.debug("[JSQL Auth] Silent session returned an empty access token.");
      throw new Error(
        "VS Code returned an empty Microsoft Entra access token.",
      );
    }
    console.debug("[JSQL Auth] Using silent Microsoft Entra session.");
    return { accessToken: session.accessToken, accountId: session.account.id };
  }

  console.debug("[JSQL Auth] Requesting interactive Microsoft sign-in.");
  session = await authentication.getSession(
    AUTHENTICATION_PROVIDER_ID,
    scopes,
    {
      ...accountOptions,
      ...(username && !preferredAccount
        ? { clearSessionPreference: true }
        : {}),
      createIfNone: {
        detail: "JSQL needs a Microsoft Entra token to connect to Azure SQL.",
      },
    },
  );

  if (!session) {
    console.debug("[JSQL Auth] Interactive sign-in returned no session.");
    throw new Error(
      "VS Code did not return a Microsoft Entra authentication session.",
    );
  }
  if (!sessionMatchesProfile(session, username)) {
    console.debug(
      "[JSQL Auth] Interactive session account did not match the SQL profile account.",
    );
    throw new Error(
      "The selected Microsoft account does not match the account in the active SQL connection.",
    );
  }
  if (!session.accessToken) {
    console.debug(
      "[JSQL Auth] Interactive session returned an empty access token.",
    );
    throw new Error("VS Code returned an empty Microsoft Entra access token.");
  }

  console.debug("[JSQL Auth] Interactive Microsoft Entra session acquired.");
  return { accessToken: session.accessToken, accountId: session.account.id };
}
