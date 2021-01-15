import { run } from './run'

// The reason this is imported from a different file is that this is a
// side-effect. That's fine when running this on the Github Action's Platform,
// but not when doing anything else, such as running tests.
run()
