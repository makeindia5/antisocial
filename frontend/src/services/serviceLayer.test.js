
// Mock AsyncStorage
const mockAsyncStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock fetch
global.fetch = jest.fn();

// Import services to test
import { apiClient } from '../apiClient';
import { chatService } from '../chatService';
import { authRequest } from '../apiService'; // Legacy wrapper

describe('Service Layer Verification', () => {
    beforeEach(() => {
        fetch.mockClear();
        mockAsyncStorage.getItem.mockClear();
    });

    test('apiClient adds Authorization header when token exists', async () => {
        mockAsyncStorage.getItem.mockResolvedValue('test-token');
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        await apiClient.get('/test-endpoint');

        expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('token');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/test-endpoint'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer test-token',
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    test('chatService calls correct endpoint via apiClient', async () => {
        mockAsyncStorage.getItem.mockResolvedValue('test-token');
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        await chatService.archiveChat('user1', 'chat1');

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/chat/archive'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ userId: 'user1', chatId: 'chat1' })
            })
        );
    });

    test('legacy apiService wrapper works correctly', async () => {
        mockAsyncStorage.getItem.mockResolvedValue('test-token');
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        await authRequest('/legacy-endpoint', { foo: 'bar' });

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/legacy-endpoint'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ foo: 'bar' })
            })
        );
    });
});
