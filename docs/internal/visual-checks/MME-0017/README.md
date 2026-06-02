# MME-0017 Visual Checks

These artifacts prove the AI writing demo flow without using a real provider key.

- `ai-panel-session-ready.png`: mock BYOK session is active and the key input is cleared after start.
- `ai-suggestion-pending.png`: mock provider returned a staged suggestion that has not been applied yet.
- `ai-suggestion-accepted.png`: accepting the staged suggestion changes the Markdown.
- `ai-policy-blocked.png`: Document Access Policy blocks AI before the provider receives content.

The visual script asserts that the test BYOK value is not present in the captured page state.

Current local status: code-complete, screenshots pending.

Reason: the reusable headless Chrome visual scripts currently fail before CDP is available with `SIGABRT`, including older scripts such as `visual:mme-0015`. The in-app browser also timed out on screenshot capture and later locator interactions. Automated tests still prove the AI flow and policy block; human visual review is required before accepting this UI slice.
