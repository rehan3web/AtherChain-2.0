import useSWR from "swr";

// Mock service or real endpoint
// The Layout uses: nodeStatus.status
export function useNodeStatus() {
    // Return mock data for now or fetch from an endpoint if known
    // Assuming '/node/status' or similar
    const { data, error, isLoading } = useSWR('/node/status', async () => {
        // Mock response matching the UI expectation
        return { status: 'Operational' };
    });

    return {
        data,
        isLoading,
        error
    };
}
