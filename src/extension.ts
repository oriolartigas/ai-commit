import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { resolveProvider, generateCommitMessage, fetchAvailableModels, getProviderDefinition } from './providers';
import type { ResolvedProvider } from './providers';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Create an output channel to log errors and status
    outputChannel = vscode.window.createOutputChannel("AI Commit");
    context.subscriptions.push(outputChannel);

    const generateCommit = vscode.commands.registerCommand("aiCommit.generate", async () => {
        try {
            // Get configuration
            const config = vscode.workspace.getConfiguration("aiCommit");

            // Resolve the provider (and its plan, e.g. opencode go/zen/console)
            const providerId = config.get<string>("provider") || "groq";
            const planId = config.get<string>("plan");
            const provider = resolveProvider(providerId, planId);

            // Resolve base URL (custom providers require their own)
            let baseUrl = provider.baseUrl;
            if (provider.needsBaseUrl) {
                baseUrl = config.get<string>("customBaseUrl") || "";
                if (!baseUrl || baseUrl.trim() === "") {
                    vscode.window.showErrorMessage("Custom provider: set 'aiCommit.customBaseUrl' first.");
                    return;
                }
            }
            const resolvedProvider = { ...provider, baseUrl };

            // Check API Key
            let apiKey = config.get<string>("apiKey");
            if (!apiKey || apiKey.trim() === "") {
                apiKey = await vscode.window.showInputBox({
                    prompt: resolvedProvider.apiKeyMessage,
                    placeHolder: resolvedProvider.apiKeyPlaceholder,
                    ignoreFocusOut: true,
                    password: true
                });

                if (!apiKey) {
                    vscode.window.showErrorMessage(`${resolvedProvider.label} API Key is required.`);
                    return;
                }
                // Save the key globally
                await config.update("apiKey", apiKey, vscode.ConfigurationTarget.Global);
            }

            const language = config.get<string>("language") || "English";

            // Resolve the model: use the configured one, or ask the provider for its available models
            const model = await resolveModel(config, resolvedProvider, apiKey!);

            // Get Git API
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            const gitApi = gitExtension?.exports.getAPI(1);
            const repo = gitApi?.repositories[0];

            if (!repo) {
                vscode.window.showErrorMessage("No Git repository found.");
                return;
            }

            // Check for staged changes
            const stagedChanges = repo.state.indexChanges;
            if (stagedChanges.length === 0) {
                vscode.window.showErrorMessage("No staged changes found. Use 'git add' first.");
                return;
            }

            // Generate message with Progress UI
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `${resolvedProvider.label}: Generating commit in ${language}...`,
                cancellable: true
            }, async (progress, token) => {

                // Get the diff of staged changes
                const diff = execSync("git diff --cached", {
                    cwd: repo.rootUri.fsPath,
                    encoding: "utf8"
                });

                if (!diff) {
                    vscode.window.showErrorMessage("Could not retrieve git diff.");
                    return;
                }

                const commitMessage = await generateCommitMessage({
                    provider: resolvedProvider,
                    apiKey: apiKey!,
                    model,
                    diff,
                    language,
                    token,
                    outputChannel
                });

                if (commitMessage) {
                    repo.inputBox.value = commitMessage;
                }
            });

        } catch (error: any) {
            vscode.window.showErrorMessage(`AI Commit Error: ${error.message}`);
        }
    });

    const selectPlan = vscode.commands.registerCommand("aiCommit.selectPlan", async () => {
        try {
            const config = vscode.workspace.getConfiguration("aiCommit");
            const providerId = config.get<string>("provider") || "groq";
            const definition = getProviderDefinition(providerId);

            const plans = definition.plans;
            if (!plans || plans.length === 0) {
                vscode.window.showInformationMessage(`${definition.label} doesn't have selectable plans.`);
                return;
            }

            const currentPlan = config.get<string>("plan");
            const idByLabel = new Map(plans.map(plan => [plan.label, plan.id]));
            const items = plans.map(plan => ({
                label: plan.label,
                description: plan.baseUrl,
                picked: plan.id === currentPlan
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Select a plan for ${definition.label}`,
                ignoreFocusOut: true
            });

            if (!selected) {
                return;
            }

            await config.update("plan", idByLabel.get(selected.label), vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Plan set to ${selected.label}`);

        } catch (error: any) {
            vscode.window.showErrorMessage(`AI Commit Error: ${error.message}`);
        }
    });

    context.subscriptions.push(selectPlan);
    context.subscriptions.push(generateCommit);
}

export function deactivate() {}

async function resolveModel(
    config: vscode.WorkspaceConfiguration,
    provider: ResolvedProvider,
    apiKey: string
): Promise<string> {
    const configured = config.get<string>("model");
    if (configured && configured.trim() !== "") {
        return configured;
    }

    try {
        const models = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${provider.label}: Fetching available models...`,
            cancellable: false
        }, async () => {
            return await fetchAvailableModels(provider, apiKey, outputChannel);
        });

        if (models.length === 0) {
            throw new Error("The provider returned no models.");
        }

        const selected = await vscode.window.showQuickPick(models, {
            placeHolder: "Select a model",
            ignoreFocusOut: true
        });

        if (!selected) {
            throw new Error("No model selected.");
        }

        // Remember the choice so the user is not asked every time
        await config.update("model", selected, vscode.ConfigurationTarget.Global);
        return selected;

    } catch (error: any) {
        // Fallback: let the user type the model id manually
        const manual = await vscode.window.showInputBox({
            prompt: "Could not load the model list. Enter the model id manually (or Esc to cancel)",
            ignoreFocusOut: true
        });

        if (!manual || manual.trim() === "") {
            throw error;
        }
        return manual.trim();
    }
}