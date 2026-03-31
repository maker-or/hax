import { Data, Effect, Either, ParseResult, Schedule, Schema } from "effect";

/** WorkOS Connect token endpoint used for refresh-token grants. */
const WORKOS_TOKEN_ENDPOINT = "https://YOUR_AUTH_DOMAIN/oauth2/token";

/** THis is the shape of the reuest that we expect. */
export const RefreshOptions = Schema.Struct({
  refreshToken: Schema.String,
  clientId: Schema.String,
  clientSecret: Schema.String,
});


/** THis is the shape of the response that we give back. */
export const RefreshResult = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.optional(Schema.String),
  expiresIn: Schema.optional(Schema.Number),
  idToken: Schema.optional(Schema.String),
  tokenType: Schema.optional(Schema.String),
});

/** THis is the shape of the reuest that we expect form the Workos. */
const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
  id_token: Schema.optional(Schema.String),
  token_type: Schema.optional(Schema.String),
});

/** TypeScript view of the refresh grant input schema. */
export type RefreshAccessTokenOptions = typeof RefreshOptions.Type;
/** TypeScript view of the normalized refresh result schema. */
export type RefreshAccessTokenResult = typeof RefreshResult.Type;

/** Raised when a required refresh input is empty after trimming. */
class MissingInput extends Data.TaggedError(
  "MissingInput",
)<{
  field: "refreshToken" | "clientId" | "clientSecret";
}> {}

/** Raised when the refresh HTTP request fails before a response is received. */
class NetworkError extends Data.TaggedError(
  "NetworkError",
)<{
  cause: unknown;
}> {}

/** Raised when the token endpoint returns a non-success HTTP status. */
class RequestError extends Data.TaggedError(
  "RequestError",
)<{
  status: number;
  body: string;
}> {}

/** Raised when the token response body cannot be parsed or decoded. */
class ResponseError extends Data.TaggedError(
  "ResponseError",
)<{
  message: string;
}> {}

/** Decodes unknown input with an Effect schema and maps formatting failures. */
function decodeWithSchema<A, I, E>(
  schema: Schema.Schema<A, I, never>,
  input: unknown,
  onError: (message: string) => E,
): Effect.Effect<A, E> {
  return Either.match(Schema.decodeUnknownEither(schema)(input), {
    onLeft: (error) =>
      Effect.fail(onError(ParseResult.TreeFormatter.formatErrorSync(error))),
    onRight: (value) => Effect.succeed(value),
  });
}

/** Ensures required string inputs are present and normalized before use. */
function requireTrimmed(
  value: string,
  field: "refreshToken" | "clientId" | "clientSecret",
): Effect.Effect<string, MissingInput> {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return Effect.fail(new MissingInput({ field }));
  }

  return Effect.succeed(normalized);
}

/**
 * Exchanges the current refresh token for a fresh access token using the
 * WorkOS Connect refresh-token grant.
 *
 * Retries once when the failure is network-bound before surfacing a typed error.
 */
export function refreshAccessToken(
  options: RefreshAccessTokenOptions,
): Effect.Effect<
  RefreshAccessTokenResult,
  | MissingInput
  | NetworkError
  | RequestError
  | ResponseError
> {
  return Effect.gen(function* () {
    const refreshToken = yield* requireTrimmed(
      options.refreshToken,
      "refreshToken",
    );
    const clientId = yield* requireTrimmed(options.clientId, "clientId");
    const clientSecret = yield* requireTrimmed(
      options.clientSecret,
      "clientSecret",
    );

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = yield* Effect.tryPromise({
      try: () =>
        globalThis.fetch(WORKOS_TOKEN_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        }),
      catch: (cause) => new NetworkError({ cause }),
    }).pipe(
      Effect.retry({
        while: (error) => error._tag === "NetworkError",
        schedule: Schedule.recurs(1),
      }),
    );

    if (!response.ok) {
      const errorBody = yield* Effect.tryPromise({
        try: async () => {
          try {
            return await response.text();
          } catch {
            return "";
          }
        },
        catch: (cause) =>
          new ResponseError({
            message: `Failed to read refresh error response: ${String(cause)}`,
          }),
      });

      yield* Effect.fail(
        new RequestError({
          status: response.status,
          body: errorBody,
        }),
      );
    }

    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new ResponseError({
          message: `Failed to parse refresh response JSON: ${String(cause)}`,
        }),
    });

    const decoded = yield* decodeWithSchema(
      TokenResponse,
      payload,
      (message) => new ResponseError({ message }),
    );

    return yield* decodeWithSchema(
      RefreshResult,
      {
        accessToken: decoded.access_token,
        ...(decoded.refresh_token ? { refreshToken: decoded.refresh_token } : {}),
        ...(decoded.expires_in !== undefined
          ? { expiresIn: decoded.expires_in }
          : {}),
        ...(decoded.id_token ? { idToken: decoded.id_token } : {}),
        ...(decoded.token_type ? { tokenType: decoded.token_type } : {}),
      },
      (message) => new ResponseError({ message }),
    );
  });
}
