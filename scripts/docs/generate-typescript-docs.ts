import { deleteGeneratedDocs, generateFrontMatter, normalizeForUrlPart, processReadmeForMdx } from './docgen-utils';
import path, { extname } from 'path';

import { DocsPage, TypeMap } from './typescript-docgen-types';
import { TypescriptDocsParser } from './typescript-docs-parser';
import { TypescriptDocsRenderer } from './typescript-docs-renderer';
/* eslint-disable no-console */
import fs from 'fs-extra';
import klawSync from 'klaw-sync';

interface DocsSectionConfig {
    sourceDirs: string[];
    exclude?: RegExp[];
    outputPath: string;
    readmePath?: string;
}

const sections: DocsSectionConfig[] = [
    {
        sourceDirs: ['packages/common/src/'],
        exclude: [/dist/, /__tests__/],
        outputPath: 'common',
        readmePath: 'packages/common/README.md',
    },
    {
        sourceDirs: ['packages/react-core/src/'],
        exclude: [/dist/, /__tests__/],
        outputPath: 'react-core',
        readmePath: 'packages/react-core/README.md',
    },
    {
        sourceDirs: ['packages/react-ui/src/'],
        exclude: [/dist/, /__tests__/],
        outputPath: 'react-ui',
        readmePath: 'packages/react-ui/README.md',
    },
    {
        sourceDirs: ['packages/runtime/src/'],
        exclude: [/dist/, /__tests__/],
        outputPath: 'runtime',
        readmePath: 'packages/runtime/README.md',
    },
];

generateTypescriptDocs(sections);

const watchMode = !!process.argv.find(arg => arg === '--watch' || arg === '-w');
if (watchMode) {
    console.log(`Watching for changes to source files...`);
    sections.forEach(section => {
        section.sourceDirs.forEach(dir => {
            fs.watch(dir, { recursive: true }, (eventType, file) => {
                if (file && extname(file) === '.ts') {
                    console.log(`Changes detected in ${dir}`);
                    generateTypescriptDocs([section], true);
                }
            });
        });
    });
}

/**
 * Uses the TypeScript compiler API to parse the given files and extract out the documentation
 * into markdown files
 */
function generateTypescriptDocs(config: DocsSectionConfig[], isWatchMode: boolean = false) {
    const timeStart = +new Date();

    // This map is used to cache types and their corresponding path. It is used to enable
    // hyperlinking from a member's "type" to the definition of that type.
    const globalTypeMap: TypeMap = new Map();

    if (!isWatchMode) {
        for (const { outputPath } of config) {
            deleteGeneratedDocs(absOutputPath(outputPath));
        }
    }

    // Pass 1: Parse all sections and populate the complete type map
    const parsedSections: Array<{ outputPath: string; docsPages: DocsPage[] }> = [];
    for (const { outputPath, sourceDirs, exclude } of config) {
        const sourceFilePaths = getSourceFilePaths(sourceDirs, exclude);
        const docsPages = new TypescriptDocsParser().parse(sourceFilePaths);
        for (const page of docsPages) {
            const { category, fileName, declarations } = page;
            for (const declaration of declarations) {
                const pathToTypeDoc = `docs/${outputPath ? `${outputPath}/` : ''}${category ? category.map(part => normalizeForUrlPart(part)).join('/') + '/' : ''
                    }${fileName === 'index' ? '' : fileName}#${toHash(declaration.title)}`;
                globalTypeMap.set(declaration.title, pathToTypeDoc);
            }
        }
        parsedSections.push({ outputPath, docsPages });
    }

    // Read README files for each section
    const readmeContents = new Map<string, string>();
    for (const { outputPath, readmePath } of config) {
        if (readmePath) {
            const fullPath = path.join(__dirname, '../../', readmePath);
            if (fs.existsSync(fullPath)) {
                readmeContents.set(outputPath, fs.readFileSync(fullPath, 'utf-8'));
            }
        }
    }

    // Pass 2: Render all sections using the complete type map
    for (const { outputPath, docsPages } of parsedSections) {
        const docsUrl = ``;
        const generatedCount = new TypescriptDocsRenderer().render(
            docsPages,
            docsUrl,
            absOutputPath(outputPath),
            globalTypeMap,
            readmeContents.get(outputPath),
        );

        if (generatedCount) {
            console.log(
                `Generated ${generatedCount} typescript api docs for "${outputPath}" in ${+new Date() - timeStart
                }ms`,
            );
        }
    }

    // Generate root docs index from README.md
    const rootReadmePath = path.join(__dirname, '../../README.md');
    if (fs.existsSync(rootReadmePath)) {
        const rootReadme = fs.readFileSync(rootReadmePath, 'utf-8');
        const processedContent = processReadmeForMdx(rootReadme);
        const rootIndexPath = path.join(__dirname, '../../docs/pages/docs/index.mdx');

        let content = generateFrontMatter('Documentation');
        content += `\nimport { LinkCard } from '@/docs/components/docs/LinkCard'\n\n`;
        content += processedContent;
        content += '\n## API Reference\n\n';
        content += '<LinkCard href="/docs/common" title="Common" />\n';
        content += '<LinkCard href="/docs/react-core" title="React Core" />\n';
        content += '<LinkCard href="/docs/react-ui" title="React UI" />\n';
        content += '<LinkCard href="/docs/runtime" title="Runtime" />\n';

        fs.writeFileSync(rootIndexPath, content);
        console.log(`Generated root docs index from README.md`);
    }
}

function toHash(title: string): string {
    return title.replace(/\s/g, '').toLowerCase();
}

function absOutputPath(outputPath: string): string {
    return path.join(__dirname, '../../docs/pages/docs', outputPath);
}

function getSourceFilePaths(sourceDirs: string[], excludePatterns: RegExp[] = []): string[] {
    return sourceDirs
        .map(scanPath =>
            klawSync(path.join(__dirname, '../../', scanPath), {
                nodir: true,
                filter: item => {
                    const ext = path.extname(item.path);
                    if (ext === '.ts' || ext === '.tsx') {
                        for (const pattern of excludePatterns) {
                            if (pattern.test(item.path)) {
                                return false;
                            }
                        }
                        return true;
                    }
                    return false;
                },
                traverseAll: true,
            }),
        )
        .reduce((allFiles, files) => [...allFiles, ...files], [])
        .map(item => item.path);
}
