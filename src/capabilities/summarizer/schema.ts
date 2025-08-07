// Function schemas for the summarizer

// Schema for Summarizer capability delegation function
export const SUMMARIZER_DELEGATION_SCHEMA = {
    type: 'object' as const,
    properties: {
        calculated_start_time: {
            type: 'string' as const,
            description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
        },
        calculated_end_time: {
            type: 'string' as const,
            description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
        },
        timespan_description: {
            type: 'string' as const,
            description: 'Human-readable description of the calculated time range (optional)'
        }
    },
    required: []
};
