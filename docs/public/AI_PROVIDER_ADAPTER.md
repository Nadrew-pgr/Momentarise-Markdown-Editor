# AI Provider Adapter

Momentarise Markdown Editor keeps AI writing assistive, staged, and policy-gated.

The core packages do not import OpenAI, Gemini, Mistral, Anthropic, LiteLLM, Vercel AI SDK, browser `fetch`, or provider SDKs. `@momentarise/md-ai` exposes provider contracts plus an OpenAI-compatible adapter factory that receives an injected transport from the host.

## Supported Host Paths

- `mock`: default demo/test provider. No external calls.
- `host-managed`: recommended production path. The host backend owns provider credentials, quotas, billing, audit, and secure storage.
- `sidecar-local`: local gateway path for desktop or developer setups, including LiteLLM or another OpenAI-compatible endpoint running on the user's machine.
- `personal BYOK`: local/personal demo path. The key is memory-only in the browser session and is never logged or persisted by MME.

Production apps should prefer a host backend, sidecar, secure storage, or user-controlled gateway. Direct browser-to-provider personal BYOK is a local/personal mode, not the default production recommendation.

## Policy Boundary

Document Access Policy runs before provider transport. If policy denies `share`, no document content, selected text, prompt, or metadata is sent to the provider transport.

All provider results return the same staged `AiWritingSuggestion` shape used by the editor:

- pending suggestion;
- explicit accept/reject;
- source hash anchoring;
- stale accept refusal when the document changed.

## Key Handling

MME does not persist provider keys. In personal BYOK mode, the browser key is held only in memory long enough to configure the provider transport/session. It is not written to local storage, session storage, logs, visual-check state, or provider request payload metadata.

`@momentarise/md-ai` can construct a bearer `Authorization` header for explicit personal BYOK configuration, but the injected host transport owns network delivery and logging behavior. Hosts must avoid logging raw request headers when those headers include bearer tokens.
