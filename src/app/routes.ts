import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Landing } from "./components/Landing";
import { Onboarding } from "./components/Onboarding";
import { Feed } from "./components/Feed";
import { ExploreFeed } from "./components/ExploreFeed";
import { ArticleDetail } from "./components/ArticleDetail";
import { Unsubscribe } from "./components/Unsubscribe";
import { Privacy } from "./components/Privacy";
import { Terms } from "./components/Terms";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Landing },
      { path: "onboarding", Component: Onboarding },
      { path: "feed", Component: Feed },
      // /digest is the canonical public-facing URL (e.g. finnopolis.com/digest);
      // /feed remains as an alias for older email links and internal links.
      { path: "digest", Component: Feed },
      { path: "explore", Component: ExploreFeed },
      { path: "article/:id", Component: ArticleDetail },
      { path: "unsubscribe", Component: Unsubscribe },
      { path: "privacy", Component: Privacy },
      { path: "terms", Component: Terms },
    ],
  },
], {
  basename: '/',
});
