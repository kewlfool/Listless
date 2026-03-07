# Listless
Simple list making webapp.

## GitHub Pages (test branch)
If you publish from the `test` branch (not Actions artifact deployment), use:

```bash
npm run build:pages
```

Then commit/push the generated `docs/` folder and set Pages to:
- Source: `Deploy from a branch`
- Branch: `test`
- Folder: `/docs`
