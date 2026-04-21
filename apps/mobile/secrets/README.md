# `apps/mobile/secrets/` — App Store Connect API key

This directory holds the **App Store Connect API private key** used by EAS
Submit to upload builds to TestFlight / App Store Connect without prompting
for an Apple ID password.

**Nothing in this folder is committed** except this README (see root
`.gitignore`). Keep the `.p8` out of git, Slack, screenshots, etc.

## What to drop in here

Place your downloaded key file here as:

```
apps/mobile/secrets/AuthKey_XXXXXXXXXX.p8
```

Where `XXXXXXXXXX` is the **Key ID** from App Store Connect → Users and Access
→ Integrations → App Store Connect API.

> Apple only lets you download the `.p8` once. If you lose it, you must
> revoke the key and create a new one.

## Wire it up

`apps/mobile/eas.json` → `submit.production.ios` references this path via
`ascApiKeyPath`, along with `ascApiKeyId` (Key ID) and `ascApiKeyIssuerId`
(Issuer ID from the same screen).

## Alternative: EAS secrets

Instead of a file on disk, you can upload the key to EAS:

```bash
eas secret:create --scope project --name ASC_API_KEY_PATH \
  --type file --value ./apps/mobile/secrets/AuthKey_XXXXXXXXXX.p8
eas secret:create --scope project --name ASC_API_KEY_ID      --value XXXXXXXXXX
eas secret:create --scope project --name ASC_API_KEY_ISSUER_ID --value <issuer-uuid>
```

Then replace the literal values in `eas.json` with `$ASC_API_KEY_PATH`, etc.
Useful for CI or when multiple developers submit.
