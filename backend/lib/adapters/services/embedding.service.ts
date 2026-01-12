import { pipeline, Pipeline, env } from '@xenova/transformers';
import { ApplicationContext } from '../types/basic';
import * as path from 'path';
import * as fs from 'fs';

const MODULE_NAME = 'EMBEDDING-SERVICE';

/**
 * Determine the correct path to the models directory based on environment.
 * Tries multiple locations to support both development and production.
 */
function getModelsPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../../models'), // Development: backend/lib/adapters/services -> backend/models
    path.join(__dirname, '../../models'), // Production: dist/adapters/services -> dist/models
    path.join(__dirname, '../models'), // Alternative: dist/services -> dist/models
    path.join(process.cwd(), 'models'), // Fallback: root/models
    path.join(process.cwd(), 'dist/models'), // Fallback: root/dist/models
  ];

  for (const modelsPath of possiblePaths) {
    if (fs.existsSync(modelsPath)) {
      return modelsPath;
    }
  }

  // If no local models found, fall back to download cache (for dev environments)
  return path.join(process.cwd(), '.cache/models');
}

// Configure transformers library to use local models
env.cacheDir = getModelsPath();
env.allowLocalModels = true; // Allow loading from local cache
env.allowRemoteModels = false; // Disable downloading in production

/**
 * Singleton service for generating text embeddings using a local transformer model.
 * Uses all-MiniLM-L6-v2 for fast inference with 384-dimensional vectors.
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private model: Pipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of EmbeddingService.
   */
  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Lazy-load the embedding model on first use.
   * Model is cached in memory after first load.
   */
  private async initialize(context: ApplicationContext): Promise<void> {
    if (this.model) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const modelsPath = getModelsPath();
          context.logger.info(MODULE_NAME, `Models directory: ${modelsPath}`);
          context.logger.info(MODULE_NAME, `Loading embedding model: ${this.modelName}`);

          const startTime = Date.now();
          this.model = await pipeline('feature-extraction', this.modelName);
          const loadTime = Date.now() - startTime;

          context.logger.info(MODULE_NAME, `Embedding model loaded successfully in ${loadTime}ms`);
        } catch (error) {
          context.logger.error(MODULE_NAME, 'Failed to load embedding model', error);
          this.initPromise = null;
          throw error;
        }
      })();
    }

    await this.initPromise;
  }

  /**
   * Generate a 384-dimensional embedding vector for a single text string.
   *
   * @param context Application context for logging
   * @param text Input text to embed
   * @returns Array of 384 numbers, or null if generation fails
   */
  async generateEmbedding(context: ApplicationContext, text: string): Promise<number[] | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      await this.initialize(context);

      if (!this.model) {
        context.logger.error(MODULE_NAME, 'Model not initialized');
        return null;
      }

      const output = await this.model(text, {
        pooling: 'mean', // Average token embeddings
        normalize: true, // L2 normalization for cosine similarity
      });

      return Array.from(output.data);
    } catch (error) {
      context.logger.error(MODULE_NAME, `Failed to generate embedding for text: ${text}`, error);
      return null;
    }
  }

  /**
   * Generate embedding from multiple keywords by combining them.
   * Keywords are joined with spaces to preserve semantic meaning.
   *
   * @param context Application context for logging
   * @param keywords Array of keyword strings
   * @returns Array of 384 numbers, or null if generation fails
   */
  async generateKeywordsEmbedding(
    context: ApplicationContext,
    keywords: string[],
  ): Promise<number[] | null> {
    if (!keywords || keywords.length === 0) {
      return null;
    }

    // Join keywords with spaces for semantic encoding
    const combinedText = keywords.filter((k) => k && k.trim()).join(' ');
    return this.generateEmbedding(context, combinedText);
  }

  /**
   * Extract searchable keywords from case data.
   * Currently extracts debtor and joint debtor names.
   *
   * @param caseData Case data with debtor information
   * @returns Array of keyword strings
   */
  extractCaseKeywords(caseData: {
    debtor?: { name?: string };
    jointDebtor?: { name?: string };
    caseTitle?: string;
  }): string[] {
    const keywords: string[] = [];

    if (caseData.debtor?.name) {
      keywords.push(caseData.debtor.name);
    }

    if (caseData.jointDebtor?.name) {
      keywords.push(caseData.jointDebtor.name);
    }

    // Optional: include case title for additional context
    // if (caseData.caseTitle) {
    //   keywords.push(caseData.caseTitle);
    // }

    return keywords;
  }

  /**
   * Get the dimensions of the embedding vectors produced by this service.
   * Used for validation and index configuration.
   */
  getDimensions(): number {
    return 384; // all-MiniLM-L6-v2 produces 384-dimensional vectors
  }
}

/**
 * Factory function to get the singleton EmbeddingService instance.
 */
export function getEmbeddingService(): EmbeddingService {
  return EmbeddingService.getInstance();
}
