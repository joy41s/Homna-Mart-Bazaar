import express, { type Express } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { ApiError } from "./lib/http";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status =
    error instanceof ApiError
      ? error.statusCode
      : typeof error === "object" && error !== null && "status" in error &&
          typeof error.status === "number" && error.status >= 400 && error.status < 500
        ? error.status
        : 500;
  const message =
    error instanceof ApiError
      ? error.message
      : status === 400
        ? "অনুরোধের তথ্য সঠিক নয়"
        : "সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন";
  if (status >= 500) logger.error({ err: error, path: req.path }, "API request failed");
  res.status(status).json({ message });
});

export default app;
