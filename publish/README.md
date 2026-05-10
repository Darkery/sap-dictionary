# Publishing

## Files

- `.token` — Azure DevOps PAT. **Listed in .gitignore and .vscodeignore — never committed or packaged.**
- `publish.sh` — publish script

## Publish

```bash
# Publish with version already set in package.json
bash publish/publish.sh

# Auto-bump patch version and publish (0.1.1 → 0.1.2)
bash publish/publish.sh patch

# Auto-bump minor version and publish (0.1.1 → 0.2.0)
bash publish/publish.sh minor
```

## Updating the token

Go to Azure DevOps → User Settings → Personal Access Tokens → New Token → Marketplace (Publish) scope.

Then overwrite the token file:

```bash
echo "your-new-token" > publish/.token
```
