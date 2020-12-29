# probby

Probby is the friendly Exercism problem-specs robot.

## Usage

### `problem-specifications` repo

1. Create a machine user with write access to all tracks that you want to push to.
2. Create a Personal Access Token (★) with the `public_repo` scope for the machine user.
3. Create an environment called `probby_environment`
   1. Add up to 6 trusted reviewers as _Required reviewers_. **Make sure to hit _Save protection rules_!**
   2. Create an **environment** secret `PROBBY_TOKEN` with the PAT (★) from above as content.
4. Add the workflow below as `.github/workflows/probby.yml`.
5. Change the value of `track-repos` to suit your needs.

```yaml
name: Probby

on:
  push:
    branches:
      - 'probby-tests'

jobs:
  parse-push:
    name: Parse push event and prepare payload
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      # TODO: Move everything up one level or rename packages to actions if lerna doesn't support it otherwise
      - uses: SaschaMann/probby/packages/parse-push@v1
        id: parse-push

      - uses: actions/upload-artifact@v2
        with:
          name: payload
          path: ${{ steps.parse-push.outputs.payload-file }}

  notifier:
    name: Send notifications to track repos
    runs-on: ubuntu-latest
    needs: parse-push
    environment: probby_environment
    steps:
      - name: Download payload.json
        id: download
        uses: actions/download-artifact@v2
        with:
          name: payload

      - uses: SaschaMann/probby/packages/notifier@v1
        with:
          token: ${{ secrets.PROBBY_TOKEN }}
          # Comma-separated list of track repos to send a notification to
          track-repos: c,javascript,julia
          payload-file: ${{ steps.download.outputs.download-path }}/payload.json
```

### Track repos

#### `issue-receiver`

1. Add the workflow below as `.github/workflows/probby.yml`:

```yaml
name: Probby

on:
  repository_dispatch:

jobs:
  issue-receiver:
    name: Issue Receiver
    runs-on: ubuntu-latest
    steps:
      - uses: SaschaMann/probby/packages/issue-receiver@v1
```

**Note:** This _must_ be merged to the default branch or it will not work.

## Writing your own receivers

If you want to do something different than opening an issue to respond to the `repository_dispatch` event, e.g. triggering the test generators of the track, you can write your own action that parses and acts on the `client_payload`.
You can find the spec of the `client_payload` in [`notification-spec/`](notification-spec/)
