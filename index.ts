import { App as SlackApp } from '@slack/bolt'
import { LinkUnfurls } from '@slack/web-api'
import dotenv from 'dotenv'

dotenv.config()

const app = new SlackApp({
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

function parseUrl(url: string) {
  const discussionPattern = /https:\/\/nextnjrfeedback\.net\/discussion\/(\w+)/;
  const knowledgePattern = /https:\/\/nextnjrfeedback\.net\/knowledge\/(\w+)/;

  let result = {
    type: null as string | null,
    id: null as string | null,
  };

  if (discussionPattern.test(url)) {
    result.type = "discussion";
    const execResult = discussionPattern.exec(url);
    if (execResult !== null) {
      result.id = execResult[1];
    }
  } else if (knowledgePattern.test(url)) {
    result.type = "knowledge";
    const execResult = knowledgePattern.exec(url);
    if (execResult !== null) {
      result.id = execResult[1];
    }
  }

  return result;
}

app.event('link_shared', async ({ event, client }) => {

    let unfurls: LinkUnfurls = {}  

    for (const link of event.links) {
      const object = parseUrl(link.url)

      if (object.id == null || object.type == null) {
        console.log(`not found ${link.url}`)
        continue
      }  

      unfurls[link.url] = {
        title: "🗂 サーバルちゃんの導入・設定方法",
        author_name: "Next NJR Feedback",
        fields: [
            {
                "title": "ブックマーク",
                "value": "12 Bookmarks",
                "short": true
            },
            {
                "title": "ページビュー",
                "value": "150 Views",
                "short": true
            },
            {
                "title": "貢献",
                "value": "3人",
                "short": true
            }
        ],
        text: `S高等学校の校長のsifue(吉村 総一郎)さんが開発したSlack BOTの使用方法を紹介します。この情報は以下のGithubのREADME.mdからも参照できます。\n<${link.url}|続きを読む>`,
        title_link: link.url,
        footer: "Next NJR Feedback",
        color: '#0099D9',
      }
    }
    await client.chat.unfurl({
        ts: event.message_ts,
        channel: event.channel,
        unfurls,
      })    
  })


const main = async () => {
    await app.start({ port: Number(process.env.PORT) || 3000, path: '/' })
    console.log(`⚡️ Bolt app is listening ${Number(process.env.PORT) || 3000}`)
  }

main()