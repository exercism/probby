import core from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces'
import { EventPayloads } from '@octokit/webhooks'

// TODO: Create a common package with types
type Notification = Record<string, Exercise>

type Exercise = {
    commit_sha: string
    commit_message: string
    pull_request_html_url?: string
    new_cases: string[]
}

type WebhookPayloadRepositoryDispatch = EventPayloads.WebhookPayloadRepositoryDispatch

function isDispatchContext(
    _payload: WebhookPayload
): _payload is WebhookPayloadRepositoryDispatch {
    return context.eventName === 'push'
}

async function run(): Promise<void> {
    try {
        const { payload: eventPayload, eventName } = context

        // Confirm that it's a repository_dispatch event
        if (!isDispatchContext(eventPayload)) {
            const actualEvent = context.eventName || '<none>'
            throw new Error(
                `Event ${actualEvent} is not supported. Expected "repository_dispatch".`
            )
        }

        // Init octokit
        const octokit = getOctokit(core.getInput('token'))

        const payload = eventPayload.client_payload as Notification

        // Create/update issue for each exercise
        // TODO: Search for existing issues
        const promises = Object.keys(payload).map((exercise) => {
            const issueTitle = `[Bot] problem-specifications/${exercise} has been updated`
            const issueBody = `Changes:\n- ${payload[exercise].commit_message}\n\nNew tests: ${payload[exercise].new_cases}`

            return octokit.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: issueTitle,
                body: issueBody,
                labels: ['probby 🤖', 'cross-track-consistency'],
            })
        })

        await Promise.all(promises)
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()
