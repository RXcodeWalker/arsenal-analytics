# GitHub Secrets Setup

Add the football-data.org API key as a repository secret:

1. Open your GitHub repository.
2. Go to **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret**.
4. Name: `FOOTBALL_DATA_API_KEY`
5. Value: your football-data.org API key.
6. Save.

The workflow `.github/workflows/data-refresh.yml` reads this secret and exposes it as:

- `FOOTBALL_DATA_API_KEY`

No API key is stored in committed source files.
