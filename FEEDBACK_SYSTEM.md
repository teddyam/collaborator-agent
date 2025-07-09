# Feedback System Implementation

## Overview
The Teams Collaborator Bot now includes a comprehensive feedback system using the Teams AI SDK v2's built-in feedback features. Users can provide thumbs up/down reactions and text feedback on AI responses.

## Implementation Details

### Database Schema
A new `feedback` table has been added to the SQLite database:
- `message_id`: Teams message ID (unique)
- `likes`: Number of like reactions
- `dislikes`: Number of dislike reactions  
- `feedbacks`: JSON array of feedback objects like `{"feedbackText":"Nice!"}`
- `created_at` / `updated_at`: Timestamps

### Core Components

#### 1. Storage Layer (`src/storage/storage.ts`)
- `FeedbackRecord` interface for type safety
- `initializeFeedbackRecord()` - Creates feedback record for new AI responses
- `updateFeedback()` - Updates reactions and feedback text
- `getFeedbackByMessageId()` - Retrieves feedback for specific messages
- `getFeedbackSummary()` - Analytics and statistics

#### 2. Event Handler (`src/index.ts`)
- `app.on('message.submit.feedback')` - Handles feedback submissions
- Extracts reaction type (`like`/`dislike`) and feedback text
- Updates database with new feedback data
- Logs feedback activity for debugging

#### 3. Message Response (`src/index.ts`)
- AI responses automatically initialize feedback records
- Message IDs are tracked for feedback correlation
- Both personal chat and group chat responses support feedback

#### 4. Debug Commands (`src/utils/debug.ts`)
- `feedback.stats` - Shows feedback analytics and recent feedback
- `feedback.clear` - Clears all feedback records

## Usage

### For Users
1. When the bot responds to an @mention, feedback buttons are automatically available
2. Users can click thumbs up/down or provide text feedback
3. Feedback is stored and can be analyzed by administrators

### For Administrators  
- Use `feedback.stats` to see feedback analytics
- Use `feedback.clear` to reset feedback data
- Check logs for feedback submission activity

## Example Feedback Flow

1. User: "@bot summarize this conversation"
2. Bot: Sends response with automatic feedback buttons enabled
3. User: Clicks thumbs up and adds "Very helpful!"
4. System: Stores reaction and feedback text in database
5. Admin: Can view analytics with `feedback.stats`

## Analytics Available

- Total feedback records
- Like/dislike counts and ratios
- Recent feedback with comments
- Message ID correlation for tracking specific responses

## Technical Notes

- Feedback buttons are automatically added by the Teams AI SDK v2
- The `message.submit.feedback` event provides structured feedback data
- Message correlation uses Teams message IDs (`replyToId`)
- All feedback is persisted in SQLite for analysis and improvement
