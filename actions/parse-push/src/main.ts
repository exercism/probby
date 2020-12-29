import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as gh from '@actions/github'
import * as Webhooks from '@octokit/webhooks'
import * as fs from 'fs'
import * as path from 'path'

// TODO: Create a common package with types
type DispatchPayload = Record<string, Commit>

type Commit = {
    message: string
    slug?: string
    pull_request_html_url?: string
    new_cases?: string[]
}

/**
 * Extract the list of exercises from a list of files.
 *
 * @param files contains a list of files
 */
async function getSlugs(files: string[]): Promise<Set<string>> {
    const re = /exercises\/([a-z-]*)\//
    let exs = new Set<string>()

    for (const f of files) {
        const m = re.exec(f)
        if (m) {
            exs.add(m[0])
        }
    }

    return exs
}

/**
 * Parse the files modified in the commit and extract the exercise slug.
 *
 * Assumption: Commits may only modify one exercise.
 *             This usually holds true but there may be exceptions.
 *             In those cases, show a warning and return an empty slug.
 *
 * @param commit
 */
async function getSlug(commit: any): Promise<string> {
    const candidates = await getSlugs(commit.modified)

    // Assumption: Commits may only modify one exercise
    if (candidates.size != 1) {
        core.warning(
            `${candidates.size} exercises changed in commit ${commit.id}. Currently only one exercise per commit is supported.`,
        )
        return ''
    }

    return candidates.values().next().value
}

/**
 * Find PRs associated with the commit via the GitHub API and filter out unmerged PRs and PRs with non-default base branch.
 *
 * Assumption: Commits only occur once on the default branch.
 *             Due to the nature of problem-specs, this will generally hold true.
 *
 * @returns The PR associated with the commit.
 * @param commit_sha
 */
async function getPullRequestHTMLURL(commit_sha: string): Promise<string> {
    const octokit = gh.getOctokit(core.getInput('token'))
    const pullCandidates = await octokit.repos.listPullRequestsAssociatedWithCommit({
        owner: gh.context.repo.owner,
        repo: gh.context.repo.repo,
        commit_sha: commit_sha,
        mediaType: {
            previews: ['groot'], // This endpoint is part of a preview
        },
    })

    // Filter out unmerged PRs and PRs with a non-default base branch
    const pulls = pullCandidates.data.filter(x => {
        const eventPayload = gh.context.payload as Webhooks.EventPayloads.WebhookPayloadPush // Otherwise TS will moan about default_branch possibly being undefined
        return x.base.ref == `${eventPayload.repository.default_branch}` && x.state == 'closed' && x.merge_commit_sha
    })

    // Assumption: Commits only occur once on the default branch
    if (pulls.length != 1) {
        core.warning(
            `Could not determine a PR associated with ${commit_sha}; more than one candidate: ${pulls}. Expected a unique association.`,
        )
        return ''
    }

    return pulls[0].html_url
}

/**
 * Search the diff of the commit and return a list of all UUIDs added in the commit.
 *
 * @param commit_sha
 */
async function getNewCases(commit_sha: string): Promise<string[]> {
    // uuid4 regex from https://stackoverflow.com/questions/11384589/what-is-the-correct-regex-for-matching-values-generated-by-uuid-uuid4-hex/18516125#18516125
    const re = /^\+\s*"uuid": "([a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12})"/

    let out = ''
    let err = ''

    const opts: exec.ExecOptions = {}
    opts.listeners = {
        stdout: (data: Buffer) => {
            out += data.toString()
        },
        stderr: (data: Buffer) => {
            err += data.toString()
        },
    }
    // git diff COMMIT~ COMMIT
    await exec.exec('git', ['diff', `${commit_sha}~`, commit_sha])

    if (err || !out) {
        core.warning(`Could not parse diff of ${commit_sha}: ${err}`)
        return []
    }

    const m = re.exec(out)
    if (!m) {
        // Print a warning because this may or may not be expected
        core.warning(`Could not find new test cases in ${commit_sha}: ${m}`)
        return []
    }
    return m
}

async function parseCommit(commit: any): Promise<Commit> {
    const slug = await getSlug(commit)
    const pull_request_html_url = await getPullRequestHTMLURL(commit.id)
    const new_cases = await getNewCases(commit.id)

    return <Commit>{
        message: commit.message,
        slug: slug,
        pull_request_html_url: pull_request_html_url,
        new_cases: new_cases,
    }
}

async function run(): Promise<void> {
    try {
        // Confirm that it's a push event
        if (gh.context.eventName != 'push') {
            throw new Error(`Event ${gh.context.eventName} is not supported. Expected "repository_dispatch".`)
        }

        const payload = gh.context.payload as Webhooks.EventPayloads.WebhookPayloadPush

        // To prevent mistakes, only act on pushes to main or master branch
        // TODO: Remove probby-tests from this list
        const defaultBranchRef = `refs/heads/${payload.repository.default_branch}`
        if (!(payload.ref == defaultBranchRef || payload.ref == 'refs/heads/probby-tests')) {
            throw new Error(
                `Only pushes to the default branch should trigger notifications. Perhaps you have misconfigured the workflow? Received: ${payload.ref}. Expected: ${defaultBranchRef}.`,
            )
        }

        // Process commits
        const dispatchPayload = payload.commits.reduce((res, commit) => {
            res[commit.id] = parseCommit(commit)
            return res
        }, {} as DispatchPayload)

        // Write dispatchPayload to file and set path as output
        const tmpDir = fs.mkdtempSync('parse-push-')
        const payloadFile = path.join(tmpDir, 'payload.json')

        core.debug(`Writing payload.json to ${payloadFile}...`)
        fs.writeFileSync(payloadFile, JSON.stringify(dispatchPayload))
        core.setOutput('payload-file', payloadFile)
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()
