# GitHub Secrets Setup

Add required repository secrets:

1. Open your GitHub repository.
2. Go to **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret**.
4. Name: `FOOTBALL_DATA_API_KEY`
5. Value: your football-data.org API key.
6. Save.

Optional but recommended for PR automation:

1. Create a GitHub Personal Access Token (classic or fine-grained) for a maintainer account.
2. Grant repo permissions needed for branches and pull requests.
3. Add as repository secret:
4. Name: `BOT_GH_TOKEN`
5. Value: your PAT.

The workflow `.github/workflows/data-refresh.yml` reads this secret and exposes it as:

- `FOOTBALL_DATA_API_KEY`
- `BOT_GH_TOKEN` (optional; used for create/auto-merge PR actions when GitHub policy blocks `GITHUB_TOKEN`)

If you prefer using only `GITHUB_TOKEN`, enable this repo setting:

- **Settings -> Actions -> General -> Workflow permissions -> Allow GitHub Actions to create and approve pull requests**

No API key is stored in committed source files.
