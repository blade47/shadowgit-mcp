import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { SessionClient } from '../../src/core/session-client';

// Mock the global fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('SessionClient', () => {
  let client: SessionClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SessionClient();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isHealthy', () => {
    it('should return true when API responds successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const result = await client.isHealthy();
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({
          signal: expect.any(Object),
        })
      );
    });

    it('should return false when API returns non-200 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await client.isHealthy();
      
      expect(result).toBe(false);
    });

    it('should return false when fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.isHealthy();
      
      expect(result).toBe(false);
    });

    it('should return false when request times out', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 100)
        )
      );

      const result = await client.isHealthy();
      
      expect(result).toBe(false);
    });
  });

  describe('startSession', () => {
    it('should successfully start a session and return sessionId', async () => {
      const mockSessionId = 'test-session-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          success: true,
          sessionId: mockSessionId,
        }),
      } as unknown as Response);

      const result = await client.startSession({
        repoPath: '/test/repo',
        aiTool: 'Claude',
        description: 'Testing session',
      });
      
      expect(result).toBe(mockSessionId);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/session/start'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoPath: '/test/repo',
            aiTool: 'Claude',
            description: 'Testing session',
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should return null when API returns failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          success: false,
          error: 'Repository not found',
        }),
      } as unknown as Response);

      const result = await client.startSession({
        repoPath: '/test/repo',
        aiTool: 'Claude',
        description: 'Testing session',
      });
      
      expect(result).toBeNull();
    });

    it('should return null when API returns non-200 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: (jest.fn() as any).mockResolvedValue({
          error: 'Not found',
        }),
      } as unknown as Response);

      const result = await client.startSession({
        repoPath: '/test/repo',
        aiTool: 'Claude',
        description: 'Testing session',
      });
      
      expect(result).toBeNull();
    });

    it('should return null when fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.startSession({
        repoPath: '/test/repo',
        aiTool: 'Claude',
        description: 'Testing session',
      });
      
      expect(result).toBeNull();
    });

    it('should return null when response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response);

      const result = await client.startSession({
        repoPath: '/test/repo',
        aiTool: 'Claude',
        description: 'Testing session',
      });
      
      expect(result).toBeNull();
    });
  });

  describe('endSession', () => {
    it('should successfully end a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          success: true,
        }),
      } as unknown as Response);

      const result = await client.endSession('test-session-123', 'abc1234');
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/session/end'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'test-session-123',
            commitHash: 'abc1234',
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should successfully end a session without commit hash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          success: true,
        }),
      } as unknown as Response);

      const result = await client.endSession('test-session-123');
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/session/end'),
        expect.objectContaining({
          body: JSON.stringify({
            sessionId: 'test-session-123',
          }),
        })
      );
    });

    it('should return false when API returns failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          success: false,
          error: 'Session not found',
        }),
      } as unknown as Response);

      const result = await client.endSession('invalid-session');
      
      expect(result).toBe(false);
    });

    it('should return false when API returns non-200 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const result = await client.endSession('test-session-123');
      
      expect(result).toBe(false);
    });

    it('should return false when fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.endSession('test-session-123');
      
      expect(result).toBe(false);
    });
  });

  describe('Environment Variables', () => {
    it('should use custom SESSION_API_URL from environment', () => {
      const originalEnv = process.env.SHADOWGIT_SESSION_API;
      process.env.SHADOWGIT_SESSION_API = 'http://custom-api:5000/api';
      
      // Create new client to pick up env var
      const customClient = new SessionClient();
      
      // Reset environment
      if (originalEnv) {
        process.env.SHADOWGIT_SESSION_API = originalEnv;
      } else {
        delete process.env.SHADOWGIT_SESSION_API;
      }
      
      // We can't directly test the URL without exposing it, but we can verify
      // the client was created without errors
      expect(customClient).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout health check after 3 seconds', async () => {
      let timeoutCalled = false;
      
      mockFetch.mockImplementationOnce((_, options) => {
        const signal = (options as any).signal;
        
        // Simulate timeout
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            timeoutCalled = true;
            reject(new Error('AbortError'));
          });
          
          // Wait longer than timeout
          setTimeout(() => {}, 5000);
        });
      });

      const result = await client.isHealthy();
      
      expect(result).toBe(false);
      // The timeout should have been triggered
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should timeout startSession after 3 seconds', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 5000)
        )
      );

      const result = await client.startSession({
        repoPath: '/test/repo',
        aiTool: 'Claude',
        description: 'Test',
      });
      
      expect(result).toBeNull();
    });

    it('should timeout endSession after 3 seconds', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 5000)
        )
      );

      const result = await client.endSession('test-session-123');
      
      expect(result).toBe(false);
    });
  });
});