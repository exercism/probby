import * as core from '@actions/core'
import * as gh from '@actions/github'
import * as Webhooks from '@octokit/webhooks'

type Notification = Record<string, Exercise>

type Exercise = {
    commit_sha: string
    commit_message: string
    pull_request_html_url?: string
    new_cases: string[]
}

async function run(): Promise<void> {
    try {
        // Confirm that it's a repository_dispatch event
        if (gh.context.eventName != 'repository_dispatch') {
            throw new Error(`Event ${gh.context.eventName} is not supported. Expected "repository_dispatch".`)
        }

        // Init octokit
        const octokit = gh.getOctokit(core.getInput('token'))

        const eventPayload = gh.context.payload as Webhooks.EventPayloads.WebhookPayloadRepositoryDispatch
        const payload = eventPayload.client_payload as Notification

        // Create/update issue for each exercise
        // TODO: Search for existing issues
        for (const ex of Object.keys(payload)) {
            const issueTitle = `[Bot] problem-specifications/${ex} has been updated`
            const issueBody = `Changes:\n- ${payload[ex].commit_message}\n\nNew tests: ${payload[ex].new_cases}`

            octokit.issues.create({
                owner: gh.context.repo.owner,
                repo: gh.context.repo.repo,
                title: issueTitle,
                body: issueBody,
                labels: ['probby 🤖', 'cross-track-consistency'],
            })
        }
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()
