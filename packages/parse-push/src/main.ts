import * as core from '@actions/core'
import * as gh from '@actions/github'
import * as Webhooks from '@octokit/webhooks'
import * as fs from 'fs'
import * as path from 'path'

// /**
//  * Extract the list of exercises from a list of files.
//  *
//  * @param files contains a list of files
//  */
// async function getExercises(files: string[]): Promise<Set<string>> {
//     const re = /exercises\/([a-z-]*)\//
//     let exs = new Set<string>()

//     for (const f of files) {
//         const m = re.exec(f)
//         if (m) {
//             exs.add(m[0])
//         }
//     }

//     return exs
// }

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

        // TODO: Process commits
        // TODO: Use the API to determine the associated PRs: https://docs.github.com/en/free-pro-team@latest/rest/reference/repos#list-pull-requests-associated-with-a-commit

        // Temporarily use a fixed dispatch payload for testing
        const dispatchPayload = {
            'list-ops': {
                commit_sha: 'bb38e15ba8e6048ba25a7cca3177688c96c4169b',
                commit_message: 'list-ops: reimplement ambiguous tests (#1746)',
                pull_request_html_url: 'https://github.com/exercism/problem-specifications/pull/1746',
                new_cases: [
                    '36549237-f765-4a4c-bfd9-5d3a8f7b07d2',
                    '7a626a3c-03ec-42bc-9840-53f280e13067',
                    'd7fcad99-e88e-40e1-a539-4c519681f390',
                    '17214edb-20ba-42fc-bda8-000a5ab525b0',
                    'e1c64db7-9253-4a3d-a7c4-5273b9e2a1bd',
                    '8066003b-f2ff-437e-9103-66e6df474844',
                ],
            },
        }

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
