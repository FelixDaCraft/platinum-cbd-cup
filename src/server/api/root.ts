import { postRouter } from "~/server/api/routers/post";
import { profileRouter } from "~/server/api/routers/profile";
import { cupRouter } from "~/server/api/routers/cup";
import { categoryRouter } from "~/server/api/routers/category";
import { labelsRouter } from "~/server/api/routers/labels";
import { criteriaRouter } from "~/server/api/routers/criteria";
import { phaseAutomationRouter } from "~/server/api/routers/phase-automation";
import { producerRouter } from "~/server/api/routers/producer";
import { registrationRouter } from "~/server/api/routers/registration";
import { productRouter } from "~/server/api/routers/product";
import { juryRouter } from "~/server/api/routers/jury";
import { resultsRouter } from "~/server/api/routers/results";
import { userRouter } from "~/server/api/routers/user";
import { sponsorsRouter } from "~/server/api/routers/sponsors";
import { articlesRouter } from "~/server/api/routers/articles";
import { newsletterRouter } from "~/server/api/routers/newsletter";
import { widgetRouter } from "~/server/api/routers/widget";
import { rsTemplatesRouter } from "~/server/api/routers/rs-templates";
import { contactMessagesRouter } from "~/server/api/routers/contact-messages";
import { cupImportRouter } from "~/server/api/routers/cup-import";
import { scoringRouter } from "~/server/api/routers/scoring";
import { activityRouter } from "~/server/api/routers/activity";
import { juryCodesRouter } from "~/server/api/routers/jury-codes";
import { pressRouter } from "~/server/api/routers/press";
import { organizationAboutRouter } from "~/server/api/routers/organization-about";
import { historicalImportRouter } from "~/server/api/routers/historical-import";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  profile: profileRouter,
  cup: cupRouter,
  category: categoryRouter,
  labels: labelsRouter,
  criteria: criteriaRouter,
  phaseAutomation: phaseAutomationRouter,
  producer: producerRouter,
  registration: registrationRouter,
  product: productRouter,
  jury: juryRouter,
  results: resultsRouter,
  user: userRouter,
  sponsors: sponsorsRouter,
  articles: articlesRouter,
  newsletter: newsletterRouter,
  widget: widgetRouter,
  rsTemplates: rsTemplatesRouter,
  contactMessages: contactMessagesRouter,
  cupImport: cupImportRouter,
  scoring: scoringRouter,
  activity: activityRouter,
  juryCodes: juryCodesRouter,
  press: pressRouter,
  organizationAbout: organizationAboutRouter,
  historicalImport: historicalImportRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
