import { App } from '@microsoft/teams.apps';
import { ChatPrompt, Message } from '@microsoft/teams.ai';
import { LocalStorage } from '@microsoft/teams.common/storage';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { OpenAIChatModel } from '@microsoft/teams.openai';

const storage = new LocalStorage<Array<Message>>();
const app = new App({
  storage,
  plugins: [new DevtoolsPlugin()],
});

app.on('message', async ({ send, activity, userGraph }) => {
  const prompt = new ChatPrompt({
    messages: storage.get(`${activity.conversation.id}/${activity.from.id}`),
    model: new OpenAIChatModel({
      model: process.env.AOAI_MODEL!,
      apiKey: process.env.AOAI_API_KEY!,
      endpoint: process.env.AOAI_ENDPOINT!,
      apiVersion: '2025-04-01-preview',
    }),
  });

  const res = await prompt.send(activity.text);
  await send({ type: 'message', text: res.content });

  const me = await userGraph.me.get();

  if (me) {
    console.log("Access Token:", me); // ✅ This logs the JWT
  } else {
    console.error("No token was returned.");
  }

  console.log(`User ID: ${me.id}`);
  console.log(`User Display Name: ${me.displayName}`);
  console.log(`User Email: ${me.mail}`);
  console.log(`User Job Title: ${me.jobTitle}`);
});

(async () => {
  await app.start(+(process.env.PORT || 3978));
})();
