import * as core from '@actions/core'
import * as gh from '@actions/github'
import * as Webhooks from '@octokit/webhooks'

// TODO: Generalise this to work on any object
interface Notification {
    'list-ops': Exercise
}

interface Exercise {
    commit_sha: string
    commit_message: string
    pull_request_html_url: string
    new_cases: string[]
}

async function run(): Promise<void> {
    try {
        // Confirm that it's a repository_dispatch event
        if (gh.context.eventName != 'repository_dispatch') {
            throw new Error(`Event ${gh.context.eventName} is not supported`)
        }

        // Init octokit
        const octokit = gh.getOctokit(core.getInput('token'))

        const eventPayload = gh.context.payload as Webhooks.EventPayloads.WebhookPayloadRepositoryDispatch
        const payload = eventPayload.client_payload as Notification // TODO: Create proper type def based on schema

        // Create/update issue for each exercise
        for (const ex of Object.keys(payload)) {
            const issueTitle = `[Bot] problem-specifications/${ex} has been updated`
            const issueBody = `Changes:\n- ${payload['list-ops'].commit_message}\n\nNew tests: ${payload['list-ops'].new_cases}`

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
