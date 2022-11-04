# GitHub Step Analyzer

This CLI tool calculates timing statistics for a given GitHub Actions [step](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idsteps) across multiple repos.

## Usage

```sh
  USAGE
    gh-step-analyze
      --token <token>
      --repo <repo> [--repo <repo>, ...[--repo <n>]]
      --workflow <workflow>
      --job <job>
      --step <step>
      --days [days]

  OPTIONS
    --token       GitHub auth token
    --repo        Repos to analyze (e.g. --repo foo/bar --repo foo/baz --repo fizz/buzz)
    --workflow    Workflow name
    --job         Job name
    --step        Step name
    --days        Number of days to analyze (default: 2)

  EXAMPLES
    $ gh-job-analyze
      --token gh_1232
      --repo foo/bar --repo foo/bar-improved
      --workflow "Build and Test"
      --job build
      --step "Install dependencies"
      --days 5
```

## Example Output

```sh
./lib/main.js \
  --token $(gh auth token) \
  --repo foo/bar \
  --repo fizz/buzz \
  --workflow "Build and Test" \
  --job "build" \
  --step "Install dependencies"

✔ Downloading and analyzing 2 days of job runs...

┌─────────────────────┬───────────┬────────┬────────┬────────┐
│ Repo                │ Runs      │ Avg.   │ Min.   │ Max.   │
├─────────────────────┼───────────┼────────┼────────┼────────┤
│ foo/bar             │ 34        │ 2m 6s  │ 1m 12s │ 3m 21s │
├─────────────────────┼───────────┼────────┼────────┼────────┤
│ fizz/buzz           │ 26        │ 1m 49s │ 1m 7s  │ 2m 48s │
└─────────────────────┴───────────┴────────┴────────┴────────┘
```
