import 'dayjs/locale/ja';

import { App as SlackApp } from "@slack/bolt";
import { LinkUnfurls } from "@slack/web-api";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)
dayjs.locale('ja');

dotenv.config();

const prisma = new PrismaClient();

const app = new SlackApp({
  token: process.env.SLACK_TOKEN,
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

app.event("link_shared", async ({ event, client }) => {
  let unfurls: LinkUnfurls = {};

  for (const link of event.links) {
    const object = parseUrl(link.url);

    if (object.id == null || object.type == null) {
      console.log(`not found ${link.url}`);
      continue;
    }

    if (object.type == "knowledge") {
      const knowledge = await prisma.knowledge.findFirst({
        include: {
          _count: {
            select: {
              bookmarks: true,
              contributors: true,
            },
          },
        },
        where: {
          id: object.id,
          published: true,
        },
      });

      if (knowledge && knowledge.content && knowledge.title) {
        let text = knowledge.content;
        if (text.length > 200) {
          text = text.slice(0, 140) + "..." + `\n\n<${link.url}|続きを読む>`;
        }

        unfurls[link.url] = {
          title: knowledge.emoji + " " +  knowledge.title,
          fields: [
            {
              title: "ブックマーク",
              value: `${knowledge._count.bookmarks} Bookmarks`,
              short: true,
            },
            {
              title: "ページビュー",
              value: `${knowledge.views} Views`,
              short: true,
            },
            {
              title: "貢献",
              value: `${knowledge._count.contributors}人`,
              short: true,
            },
          ],
          text: text,
          footer_icon: "https://cdn.jsdelivr.net/gh/twitter/twemoji@v14.0.2/assets/72x72/1f4a1.png",
          title_link: link.url,
          footer: dayjs(knowledge.updated_at).fromNow() + "に更新",
          color: "#0099D9",
        };
      }
    } else if (object.type == "discussion") {
      const discussion = await prisma.discussion.findFirst({
        include: {
          user: {
            select: {
              image: true,
              displayname: true,
              handle: true,
            }
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        where: {
          id: object.id,
        },
      });

      if (discussion && discussion.user.image && discussion.user.displayname) {
        unfurls[link.url] = {
          title: discussion.title,
          author_name: discussion.user.displayname,
          author_icon: discussion.user.image,
          author_link: "https://nextnjrfeedback.net/users/" + discussion.user.handle,
          fields: [
            {
              title: "ステータス",
              value: discussion.archive ? "アーカイブ済み" : "オープン",
              short: true,
            },
            {
              title: "コメント数",
              value: `${discussion._count.comments}件 `,
              short: true,
            },
            {
              title: "ページビュー",
              value: `${discussion.views} Views`,
              short: true,
            },
          ],
          text: discussion.content,
          title_link: link.url,
          footer: discussion.last_comment_created_at ? dayjs(discussion.last_comment_created_at).fromNow() + "にコメント追加" : dayjs(discussion.createdAt).fromNow() + "に作成",
          footer_icon: "https://cdn.jsdelivr.net/gh/twitter/twemoji@v14.0.2/assets/72x72/1f4a1.png",
          color: "#0099D9",
        };
      }
    }
  }
  await client.chat.unfurl({
    ts: event.message_ts,
    channel: event.channel,
    unfurls,
  });
});

const main = async () => {
  await app.start({ port: Number(process.env.PORT) || 3000, path: "/" });
  console.log(`⚡️ Bolt app is listening ${Number(process.env.PORT) || 3000}`);
};

main();
