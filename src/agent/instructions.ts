// Prompt instructions for different agent functionalities

// Get current date once and reuse it
const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

export const SUMMARY_PROMPT = `
You are a helpful assistant that is listening to a conversation between a group of people.
Your job is to listen to the conversation and provide a structured summary.

Today's Date: ${currentDate}

<INSTRUCTIONS>
1. Analyze the conversation between the participants.
2. The conversations could deal with a single or multiple topics.
3. Return a list of bulleted points that describe, CONCISELY, the various topics discussed.
`;

// You can add more prompt instructions here as needed
// Example:
// export const CODE_REVIEW_PROMPT = `
//   You are a code review assistant...
//   Today's Date: ${currentDate}
//   ...
// `;
// export const MEETING_NOTES_PROMPT = `
//   You are a meeting notes assistant...
//   Today's Date: ${currentDate}
//   ...
// `;
