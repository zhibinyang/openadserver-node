/**
 * Mock ONNX Runtime for Testing
 * Simulates ML model inference without actual ONNX runtime
 */

export interface MockPredictionResult {
  pctr: number;
  pcvr: number;
}

// Default prediction values
const DEFAULT_PREDICTIONS: MockPredictionResult = {
  pctr: 0.02,  // 2% click-through rate
  pcvr: 0.1,   // 10% conversion rate
};

export class MockOnnxSession {
  private predictions: MockPredictionResult;
  private callCount: number = 0;
  private latencyMs: number = 0;

  constructor(predictions: Partial<MockPredictionResult> = {}) {
    this.predictions = { ...DEFAULT_PREDICTIONS, ...predictions };
  }

  async run(input: any): Promise<{ output: Float32Array }> {
    this.callCount++;

    // Simulate latency if configured
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }

    // Return mock predictions as Float32Array
    return {
      output: new Float32Array([this.predictions.pctr, this.predictions.pcvr]),
    };
  }

  // Configure predictions for testing
  setPredictions(predictions: Partial<MockPredictionResult>): void {
    this.predictions = { ...this.predictions, ...predictions };
  }

  // Configure simulated latency
  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  // Get call count for assertions
  getCallCount(): number {
    return this.callCount;
  }

  // Reset state
  reset(): void {
    this.callCount = 0;
    this.predictions = { ...DEFAULT_PREDICTIONS };
    this.latencyMs = 0;
  }
}

// Singleton instance
export const mockOnnxSession = new MockOnnxSession();

// Mock ONNX runtime module
export const mockOnnxRuntime = {
  InferenceSession: jest.fn().mockImplementation(() => mockOnnxSession),
  Tensor: jest.fn().mockImplementation((type: string, data: any, dims: number[]) => ({
    type,
    data,
    dims,
  })),
};

// Helper to create prediction service mock
export function createMockPredictionService() {
  return {
    predict: jest.fn().mockResolvedValue({ pctr: 0.02, pcvr: 0.1 }),
    predictBatch: jest.fn().mockResolvedValue([
      { pctr: 0.02, pcvr: 0.1 },
      { pctr: 0.03, pcvr: 0.15 },
    ]),
    isReady: jest.fn().mockReturnValue(true),
  };
}
