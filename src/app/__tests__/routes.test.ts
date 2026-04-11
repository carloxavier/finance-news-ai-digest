import { describe, it, expect } from 'vitest';
import { router } from '../routes';
import { Landing } from '../components/Landing';
import { Onboarding } from '../components/Onboarding';

/**
 * Route configuration tests.
 *
 * These prevent regressions like accidentally mapping Onboarding back to "/"
 * (which would hide the landing page) or forgetting a route.
 *
 * React Router v7 transforms `Component` into a React element at creation
 * time, so we check `element.type` to identify which component is mounted.
 */
describe('route configuration', () => {
  const rootRoute = router.routes[0];

  function getRouteComponent(route: any) {
    return route?.element?.type;
  }

  it('has Landing page at the index route (/)', () => {
    const indexRoute = rootRoute.children?.find(
      (r) => 'index' in r && r.index
    );
    expect(indexRoute).toBeDefined();
    expect(getRouteComponent(indexRoute)).toBe(Landing);
  });

  it('has Onboarding at /onboarding (not at /)', () => {
    const onboardingRoute = rootRoute.children?.find(
      (r) => r.path === 'onboarding'
    );
    expect(onboardingRoute).toBeDefined();
    expect(getRouteComponent(onboardingRoute)).toBe(Onboarding);
  });

  it('does NOT have Onboarding as the index route', () => {
    const indexRoute = rootRoute.children?.find(
      (r) => 'index' in r && r.index
    );
    expect(getRouteComponent(indexRoute)).not.toBe(Onboarding);
  });

  it('includes all required routes', () => {
    const childPaths = rootRoute.children?.map((r) =>
      'index' in r && r.index ? '/' : r.path
    );
    const requiredPaths = ['onboarding', 'feed', 'article/:id', 'privacy', 'terms', 'unsubscribe'];
    for (const path of requiredPaths) {
      expect(childPaths).toContain(path);
    }
  });

  it('uses the correct basename for the custom domain', () => {
    expect(router.basename).toBe('/');
  });
});
