# Publishing

## Files

- `.token` — Azure DevOps PAT. **Listed in .gitignore and .vscodeignore — never committed or packaged.**
- `publish.sh` — publish script

## Publish

```bash
bash publish/publish.sh
```

The script will:
1. Show the current version and prompt for a bump (patch / minor / major / keep)
2. Update `package.json` and optionally add a `CHANGELOG.md` entry
3. Run `npm test`
4. Build a production bundle and publish to Marketplace
5. Offer to `git commit`, tag, and push

## Updating the token

Go to Azure DevOps → User Settings → Personal Access Tokens → New Token → Marketplace (Publish) scope.

Then overwrite the token file:

```bash
echo "your-new-token" > publish/.token
```
