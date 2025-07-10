export interface ModelConfig {
    model: string;
    apiKey: string;
    endpoint: string;
    apiVersion: string;
}
export declare const AI_MODELS: {
    MANAGER: ModelConfig;
    SUMMARIZER: ModelConfig;
    ACTION_ITEMS: ModelConfig;
    SEARCH: ModelConfig;
    DEFAULT: ModelConfig;
};
export declare function getModelConfig(capabilityType?: 'manager' | 'summarizer' | 'actionItems' | 'search' | 'default'): ModelConfig;
export declare function validateEnvironment(): void;
export declare function logModelConfigs(): void;
