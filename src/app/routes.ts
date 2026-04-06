import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Onboarding } from "./components/Onboarding";
import { Feed } from "./components/Feed";
import { ArticleDetail } from "./components/ArticleDetail";
import { Unsubscribe } from "./components/Unsubscribe";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Onboarding },
      { path: "feed", Component: Feed },
      { path: "article/:id", Component: ArticleDetail },
      { path: "unsubscribe", Component: Unsubscribe },
    ],
  },
], {
  basename: '/finance-news-ai-digest/',
});
