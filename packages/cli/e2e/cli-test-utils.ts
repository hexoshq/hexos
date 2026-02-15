import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface CliTestProject {
    projectDir: string;
    cleanup: () => void;
    writeFile: (relativePath: string, content: string) => void;
    readFile: (relativePath: string) => string;
    fileExists: (relativePath: string) => boolean;
    runCliCommand: (
        args: string[],
        options?: { expectError?: boolean; env?: Record<string, string>; stdin?: string },
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export function createNextTestProject(projectName: string = 'next-test-project'): CliTestProject {
    const workspaceRoot = join(__dirname, '..', '..', '..');
    const cliDistPath = join(workspaceRoot, 'packages', 'cli', 'dist', 'cli.js');

    const projectDir = join(
        tmpdir(),
        'hexos-cli-e2e',
        `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    mkdirSync(projectDir, { recursive: true });

    writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify(
            {
                name: projectName,
                private: true,
                version: '0.0.1',
                dependencies: {
                    next: '15.1.0',
                    react: '19.0.0',
                    'react-dom': '19.0.0',
                },
            },
            null,
            2,
        ),
    );

    writeFileSync(join(projectDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    mkdirSync(join(projectDir, 'app'), { recursive: true });

    writeFileSync(
        join(projectDir, 'app', 'layout.tsx'),
        `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>;\n}\n`,
    );

    writeFileSync(
        join(projectDir, 'app', 'page.tsx'),
        `export default function HomePage() {\n  return <main>Home</main>;\n}\n`,
    );

    writeFileSync(
        join(projectDir, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2022',
                },
            },
            null,
            2,
        ),
    );

    return {
        projectDir,
        cleanup: () => {
            rmSync(projectDir, { recursive: true, force: true });
        },
        writeFile: (relativePath: string, content: string) => {
            const fullPath = join(projectDir, relativePath);
            mkdirSync(join(fullPath, '..'), { recursive: true });
            writeFileSync(fullPath, content);
        },
        readFile: (relativePath: string) => readFileSync(join(projectDir, relativePath), 'utf8'),
        fileExists: (relativePath: string) => existsSync(join(projectDir, relativePath)),
        runCliCommand: async (
            args: string[],
            options: { expectError?: boolean; env?: Record<string, string>; stdin?: string } = {},
        ) => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [cliDistPath, ...args], {
                    cwd: projectDir,
                    env: {
                        ...process.env,
                        HEXOS_CLI_SKIP_INSTALL: '1',
                        ...options.env,
                    },
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                let stdout = '';
                let stderr = '';

                child.stdout?.on('data', data => {
                    stdout += data.toString();
                });

                child.stderr?.on('data', data => {
                    stderr += data.toString();
                });

                child.on('close', code => {
                    const exitCode = code ?? 0;
                    if (!options.expectError && exitCode !== 0) {
                        reject(new Error(`CLI failed with exit code ${exitCode}. stderr: ${stderr}`));
                        return;
                    }
                    resolve({ stdout, stderr, exitCode });
                });

                child.on('error', reject);

                if (options.stdin) {
                    child.stdin?.write(options.stdin);
                }
                child.stdin?.end();
            });
        },
    };
}
