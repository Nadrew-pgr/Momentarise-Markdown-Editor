# Policy Sensitive Placeholder

This fixture references sensitive categories without containing real private data.

## Referenced paths

- `.env`
- `private/identity-document-placeholder.pdf`
- `finance/bank-statement-placeholder.pdf`
- `keys/redacted-api-key.txt`

## Placeholder values

```text
EXAMPLE_API_KEY = REDACTED_DO_NOT_USE
EXAMPLE_CREDENTIAL = REDACTED_DO_NOT_USE
```

The policy resolver should deny sharing or exporting sensitive categories by default.
