export const CAMPAIGN_IMAGE_PROVIDER = Symbol('CAMPAIGN_IMAGE_PROVIDER');

export type CampaignImageGenerateInput = {
  prompt: string;
  width: number;
  height: number;
  count: number;
  referenceUrls?: string[];
};

export type CampaignImageGenerateResult = {
  url: string;
  publicId?: string | null;
};

export interface ICampaignImageGenerationProvider {
  readonly name: string;
  generate(input: CampaignImageGenerateInput): Promise<CampaignImageGenerateResult[]>;
}
