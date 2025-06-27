# Function Calling in Teams AI Bot

This Teams AI bot now supports function calling, allowing the AI model to automatically call functions to retrieve conversation data, manage history, and provide summaries.

## Available Functions

The bot has access to the following functions that the AI can call automatically:

### 1. `get_recent_messages`
- **Description**: Retrieve recent messages from the conversation history with timestamps
- **Parameters**: 
  - `limit` (optional): Number of recent messages to retrieve (default: 5, max: 20)
- **Usage**: The AI can call this when users ask about recent messages

### 2. `get_messages_by_time_range`
- **Description**: Retrieve messages from a specific time range
- **Parameters**: 
  - `start_time` (optional): Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z)
  - `end_time` (optional): End time in ISO format (e.g., 2024-01-01T23:59:59.999Z)
- **Usage**: The AI can call this when users ask about messages from specific time periods

### 3. `clear_conversation_history`
- **Description**: Clear all conversation history for this chat
- **Parameters**: None
- **Usage**: The AI can call this when users explicitly ask to clear or reset the conversation

### 4. `summarize_conversation`
- **Description**: Get a summary of the conversation with message counts and time span
- **Parameters**: None
- **Usage**: The AI can call this when users ask for conversation summaries or statistics

## How It Works

1. **Automatic Function Calling**: When you send a message to the bot, the AI model automatically determines if it needs to call any functions to answer your question.

2. **Natural Language Queries**: You can ask questions in natural language, such as:
   - "Show me the last 5 messages"
   - "What messages did we exchange yesterday?"
   - "Can you summarize our conversation?"
   - "Clear the chat history"

3. **Function Execution**: The AI calls the appropriate function(s) and uses the results to provide a comprehensive response.

## Example Interactions

- **User**: "Show me the recent messages with timestamps"
  - **AI**: Calls `get_recent_messages` and formats the response with timestamps

- **User**: "What did we discuss this morning?"
  - **AI**: Calls `get_messages_by_time_range` with appropriate time parameters

- **User**: "How many messages have we exchanged so far?"
  - **AI**: Calls `summarize_conversation` and provides statistics

- **User**: "Please clear our conversation history"
  - **AI**: Calls `clear_conversation_history` and confirms the action

## Manual Commands (Still Available)

You can still use these manual commands if needed:
- `CLEAR PREVIOUS HISTORY` - Clears conversation history
- `SHOW RECENT MESSAGES` - Shows recent messages
- `SHOW ALL TIMESTAMPS` - Shows all messages with timestamps

## Technical Implementation

- **Storage**: Uses SQLite database with two tables:
  - `conversations`: Stores Message[] arrays for fast retrieval
  - `messages`: Stores individual messages with UTC timestamps for querying
  
- **Function Handling**: Functions are registered with the ChatPrompt and handled by the `CorePromptManager.handleFunctionCall()` method

- **Response Format**: Functions return JSON-formatted responses that the AI model can interpret and present to users in natural language

## Benefits

1. **Natural Interaction**: Users can ask questions naturally without remembering specific commands
2. **Intelligent Context**: The AI understands when to retrieve historical data vs. when to use its general knowledge
3. **Comprehensive Responses**: The AI can combine function results with its own reasoning to provide detailed answers
4. **Persistent Data**: All conversation data is stored with timestamps for historical analysis
