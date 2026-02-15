import { addStream } from './add-stream';
import fs from 'fs-extra';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const conventionalChangelogCore = require('conventional-changelog-core').default;

let changelogFileName = 'CHANGELOG.md';
if (process.argv.includes('--next') || process.env.npm_config_argv?.includes('publish-prerelease')) {
    changelogFileName = 'CHANGELOG_NEXT.md';
}

/**
 * The types of commit which will be included in the changelog.
 */
const VALID_TYPES = ['feature','feat', 'fix', 'perf', 'chore', 'docs', 'refactor'];

/**
 * Define which packages to create changelog entries for.
 */
const VALID_SCOPES: string[] = [
    'common',
    'create',
    'react-ui',
    'react-core',
    'runtime'
];

const mainTemplate = fs.readFileSync(path.join(__dirname, 'template.hbs'), 'utf-8');
const commitTemplate = fs.readFileSync(path.join(__dirname, 'commit.hbs'), 'utf-8');

generateChangelogForPackage();

/**
 * Generates changelog entries based on the conventional commits data.
 */
function generateChangelogForPackage() {
    const changelogPath = path.join(__dirname, '../../', changelogFileName);
    const inStream = fs.createReadStream(changelogPath, { flags: 'a+' });
    const tempFile = path.join(__dirname, `__temp_changelog__`);
    conventionalChangelogCore(
        {
            transform: (commit: any, context: any) => {
                if (commit.type === 'chore' && commit.scope === 'changelog') {
                    return context(null, null);
                }
                const includeCommit = VALID_TYPES.includes(commit.type) && scopeIsValid(commit.scope);
                if (includeCommit) {
                    return context(null, commit);
                } else {
                    return context(null, null);
                }
            },
            releaseCount: 1,
            outputUnreleased: true,
        },
        {
            version: new Date().toISOString().slice(0, 10),
        },
        null,
        null,
        {
            mainTemplate,
            commitPartial: commitTemplate,
            finalizeContext(context: any, options: any, commits: any) {
                context.commitGroups.forEach(addHeaderToCommitGroup);
                return context;
            },
        },
    )
        .pipe(addStream(inStream))
        .pipe(fs.createWriteStream(tempFile))
        .on('finish', () => {
            fs.createReadStream(tempFile)
                .pipe(fs.createWriteStream(changelogPath))
                .on('finish', () => {
                    fs.unlinkSync(tempFile);
                });
        });
}

function scopeIsValid(scope?: string): boolean {
    if (!scope) {
        return true;
    }
    for (const validScope of VALID_SCOPES) {
        if (scope.includes(validScope)) {
            return true;
        }
    }
    return false;
}

/**
 * The `header` is a more human-readable version of the commit type, as used in the
 * template.hbs as a sub-heading.
 */
function addHeaderToCommitGroup(commitGroup: any) {
    switch (commitGroup.title) {
        case 'fix':
            commitGroup.header = 'Fixes';
            break;
        case 'feat':
        case 'feature':
            commitGroup.header = 'Features';
            break;
        case 'chore':
            commitGroup.header = 'Chores';
            break;
        case 'docs':
            commitGroup.header = 'Documentation';
            break;
        case 'refactor':
            commitGroup.header = 'Refactoring';
            break;
        case 'perf':
            commitGroup.header = 'Performance';
            break;
        default:
            commitGroup.header = commitGroup.title.charAt(0).toUpperCase() + commitGroup.title.slice(1);
            break;
    }
}
