export interface Scene {
  scene: number;
  text: string;
  image_prompt: string;
  imageUrl?: string;
  imageQuality?: {
    pass: boolean;
    feedback: string;
  };
}

export interface ScriptAnalysis {
  character_description: string;
  scenes: Scene[];
}

export interface VoiceOption {
  name: string;
  value: string;
}

export type ActiveTab = 'generate' | 'edit' | 'video';

export type StepName = 'analyze' | 'audio' | 'images' | 'ready';
export type StepStatus = 'pending' | 'in-progress' | 'success' | 'error';

export interface ProcessingStep {
  name: StepName;
  label: string;
  status: StepStatus;
  error?: string;
}