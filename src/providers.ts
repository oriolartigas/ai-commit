import * as vscode from 'vscode';

export interface ProviderPlan {
    id: string;
    label: string;
    baseUrl: string;
}

export interface ProviderDefinition {
    id: string;
    label: string;
    defaultPlan?: string;
    apiKeyMessage: string;
    apiKeyPlaceholder: string;
    needsBaseUrl: boolean;
    baseUrl?: string;
    plans?: ProviderPlan[];
}

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
    {
        id: "groq",
        label: "Groq",
        apiKeyMessage: "Enter your Groq API Key",
        apiKeyPlaceholder: "gsk_...",
        needsBaseUrl: false,
        baseUrl: "https://api.groq.com/openai/v1"
    },
    {
        id: "opencode",
        label: "OpenCode",
        defaultPlan: "go",
        apiKeyMessage: "Enter your OpenCode API Key",
        apiKeyPlaceholder: "ok_...",
        needsBaseUrl: false,
        plans: [
            {
                id: "go",
                label: "OpenCode Go",
                baseUrl: "https://opencode.ai/zen/go/v1"
            },
            {
                id: "zen",
                label: "OpenCode Zen",
                baseUrl: "https://opencode.ai/zen/v1"
            },
            {
                id: "console",
                label: "OpenCode Console",
                baseUrl: "https://opencode.ai/zen/v1"
            }
        ]
    },
    {
        id: "custom",
        label: "Custom (OpenAI-compatible)",
        apiKeyMessage: "Enter your API Key",
        apiKeyPlaceholder: "",
        needsBaseUrl: true,
        baseUrl: ""
    }
];

export interface ResolvedProvider {
    id: string;
    label: string;
    baseUrl: string;
    apiKeyMessage: string;
    apiKeyPlaceholder: string;
    needsBaseUrl: boolean;
}

export function resolveProvider(providerId: string | undefined, planId: string | undefined): ResolvedProvider {
    const provider = getProviderDefinition(providerId);

    const plan = provider.plans
        ? provider.plans.find(p => p.id === planId)
            ?? provider.plans.find(p => p.id === provider.defaultPlan)
            ?? provider.plans[0]
        : undefined;

    const base = plan ?? provider;

    return {
        id: provider.id,
        label: base.label,
        baseUrl: base.baseUrl ?? "",
        apiKeyMessage: provider.apiKeyMessage,
        apiKeyPlaceholder: provider.apiKeyPlaceholder,
        needsBaseUrl: provider.needsBaseUrl
    };
}

export function getProviderDefinition(providerId: string | undefined): ProviderDefinition {
    return PROVIDER_DEFINITIONS.find(definition => definition.id === providerId) ?? PROVIDER_DEFINITIONS[0];
}

export async function fetchAvailableModels(
    provider: ResolvedProvider,
    apiKey: string,
    outputChannel: vscode.OutputChannel
): Promise<string[]> {
    try {
        const response = await fetch(`${provider.baseUrl}/models`, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "User-Agent": "ai-commit/1.0.0"
            }
        });

        if (!response.ok) {
            const errorData: any = await response.json().catch(() => null);
            throw new Error(errorData?.error?.message || `Models API Error ${response.status}`);
        }

        const data: any = await response.json();
        const models: string[] = (data.data ?? [])
            .map((model: any) => model.id)
            .filter((id: any): id is string => typeof id === "string")
            .sort();

        return models;
    } catch (error: any) {
        outputChannel.appendLine(`❌ Models Fetch Error: ${error.message}`);
        throw error;
    }
}

export interface GenerateOptions {
    provider: ResolvedProvider;
    apiKey: string;
    model: string;
    diff: string;
    language: string;
    token: vscode.CancellationToken;
    outputChannel: vscode.OutputChannel;
}

export async function generateCommitMessage(options: GenerateOptions): Promise<string | null> {
    const { provider, apiKey, model, diff, language, token, outputChannel } = options;

    try {
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "User-Agent": "ai-commit/1.0.0"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "system",
                        content:
                        `You are an expert git commit assistant. 
                        Your task is to generate a commit message strictly in ${language} using this EXACT structure:
                        
                        1. A subject line: <type>: <short summary>
                        2. A BLANK LINE (mandatory).
                        3. A short, concise description of changes (max 10 lines).

                        Rules:
                        - Types: feat, fix, chore, docs, test, style, refactor.
                        - Summary: Maximum 50 characters.
                        - Description: Use bullet points for multiple changes. Focus on "what" and "why".
                        - IMPORTANT: You must include a double newline between the subject line and the description.`
                    },
                    {
                        role: "user",
                        content: `Generate a commit message for this diff:\n\n${diff}`
                    }
                ],
                temperature: 0.2
            })
        });

        if (token.isCancellationRequested) return null;

        if (!response.ok) {
            const errorData: any = await response.json();
            throw new Error(errorData.error?.message || `API Error ${response.status}`);
        }

        const data: any = await response.json();
        return data.choices[0]?.message?.content?.trim() || null;

    } catch (error: any) {
        outputChannel.appendLine(`❌ Fetch Error: ${error.message}`);
        throw error;
    }
}