import type { NextApiRequest, NextApiResponse } from "next";

import { createExpressHandler, type RuntimeInput } from "@hexos/runtime";

import { getDocsRuntime } from "@/docs/lib/docs-runtime";

type PostHandler = ReturnType<typeof createExpressHandler>;

let postHandler: PostHandler | null = null;

async function getPostHandler(): Promise<PostHandler> {
  if (!postHandler) {
    const runtime = await getDocsRuntime();
    postHandler = createExpressHandler(runtime);
  }

  return postHandler;
}

function writeSseError(res: NextApiResponse, message: string): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(
    `data: ${JSON.stringify({
      type: "error",
      error: message,
      code: "DOCS_CHAT_UNAVAILABLE",
      category: "configuration",
    })}\n\n`
  );
  res.write("data: [DONE]\n\n");
  res.end();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    writeSseError(
      res,
      "Docs assistant is unavailable because OPENAI_API_KEY is not configured."
    );
    return;
  }

  try {
    const post = await getPostHandler();
    await post(req as unknown as { body: RuntimeInput }, res);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while handling the chat request.";
    writeSseError(res, message);
  }
}
