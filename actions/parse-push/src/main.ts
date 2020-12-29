import core from '@actions/core'
import { exec, ExecOptions } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import type { WebhookPayload } from '@actions/github/lib/interfaces'
import { EventPayloads } from '@octokit/webhooks'
import { mkdtempSync, writeFileSync } from 'fs'
import path from 'path'

// TODO: Create a common package with types
type DispatchPayload = Record<string, Commit>

type RemoteCommit = {
    id: string
    message: string
}

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
async function getSlugs(files: readonly string[]): Promise<Set<string>> {
    const pattern = /exercises\/([a-z-]*)\//
    const slugs = new Set<string>()

    for (const file of files) {
        const matches = pattern.exec(file)
        if (matches) {
            slugs.add(matches[0])
        }
    }

    return slugs
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
            `${candidates.size} exercises changed in commit ${commit.id}. Currently only one exercise per commit is supported.`
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
 * @param commitSha
 */
export async function getPullRequestHtmlUrl(
    commitSha: string
): Promise<string> {
    const octokit = getOctokit(core.getInput('token'))
    const pullCandidates = await octokit.repos.listPullRequestsAssociatedWithCommit(
        {
            owner: context.repo.owner,
            repo: context.repo.repo,
            commit_sha: commitSha,
            mediaType: {
                previews: ['groot'], // This endpoint is part of a preview
            },
        }
    )

    // Filter out unmerged PRs and PRs with a non-default base branch
    const pulls = pullCandidates.data.filter((x) => {
        const eventPayload = context.payload

        return (
            eventPayload.repository &&
            x.base.ref == `${eventPayload.repository.default_branch}` &&
            x.state == 'closed' &&
            x.merge_commit_sha
        )
    })

    // Assumption: Commits only occur once on the default branch
    if (pulls.length != 1) {
        core.warning(
            `Could not determine a PR associated with ${commitSha}; more than one candidate: ${pulls}. Expected a unique association.`
        )
        return ''
    }

    return pulls[0].html_url
}

// uuid4 regex from https://stackoverflow.com/questions/11384589/what-is-the-correct-regex-for-matching-values-generated-by-uuid-uuid4-hex/18516125#18516125
const UUID_V4_PATTERN = /^\+\s*"uuid": "([a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12})"/

/**
 * Search the diff of the commit and return a list of all UUIDs added in the commit.
 *
 * @param commit_sha
 */
async function getNewCases(commitSha: string): Promise<string[]> {
    let out = ''
    let err = ''

    const opts: ExecOptions = {}
    opts.listeners = {
        stdout: (data: Buffer) => {
            out += data.toString()
        },
        stderr: (data: Buffer) => {
            err += data.toString()
        },
    }

    // git diff COMMIT~ COMMIT
    await exec('git', ['diff', `${commitSha}~`, commitSha])

    if (err || !out) {
        core.warning(`Could not parse diff of ${commitSha}: ${err}`)
        return []
    }

    const matches = UUID_V4_PATTERN.exec(out)
    if (!matches) {
        // Print a warning because this may or may not be expected
        core.warning(`Could not find new test cases in ${commitSha}: ${out}`)
        return []
    }

    return matches
}

async function parseCommit(commit: RemoteCommit): Promise<Commit> {
    const slug = await getSlug(commit)
    const pull_request_html_url = await getPullRequestHtmlUrl(commit.id)
    const new_cases = await getNewCases(commit.id)

    return {
        message: commit.message,
        slug,
        pull_request_html_url,
        new_cases,
    }
}

type WebhookPayloadPush = EventPayloads.WebhookPayloadPush

function isPushContext(
    _payload: WebhookPayload
): _payload is Omit<WebhookPayloadPush, 'commits'> & {
    commits: readonly RemoteCommit[]
} {
    return context.eventName === 'push'
}

async function run(): Promise<void> {
    try {
        const { payload } = context

        // Confirm that it's a push event
        if (!isPushContext(payload)) {
            throw new Error(
                `Event ${context.eventName} is not supported. Expected "push".`
            )
        }

        // To prevent mistakes, only act on pushes to main or master branch
        // TODO: Remove probby-tests from this list
        const defaultBranchRef = `refs/heads/${payload.repository.default_branch}`
        if (
            !(
                payload.ref == defaultBranchRef ||
                payload.ref == 'refs/heads/probby-tests'
            )
        ) {
            throw new Error(
                `Only pushes to the default branch should trigger notifications. Perhaps you have misconfigured the workflow? Received: ${payload.ref}. Expected: ${defaultBranchRef}.`
            )
        }

        // Process commits
        const dispatchPayload: DispatchPayload = {}
        const dispatchPayloadPromises = payload.commits.map((remoteCommit) =>
            parseCommit(remoteCommit).then(
                (commit) => (dispatchPayload[remoteCommit.id] = commit)
            )
        )

        // Wait for all commits to be processed
        await Promise.all(Object.values(dispatchPayloadPromises))

        // Write dispatchPayload to file and set path as output
        const tmpDir = mkdtempSync('parse-push-')
        const payloadFile = path.join(tmpDir, 'payload.json')

        core.debug(`Writing payload.json to ${payloadFile}...`)
        writeFileSync(payloadFile, JSON.stringify(dispatchPayload))
        core.setOutput('payload-file', payloadFile)
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()
