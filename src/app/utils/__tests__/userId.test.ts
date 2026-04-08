import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserId,
  hasCompletedOnboarding,
  setOnboardingComplete,
  resetOnboarding,
  getFeedToken,
  setFeedToken,
  clearFeedToken,
} from '../userId';

describe('userId utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getUserId', () => {
    it('creates a new UUID on first call', () => {
      const id = getUserId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('returns the same UUID on subsequent calls', () => {
      const id1 = getUserId();
      const id2 = getUserId();
      expect(id1).toBe(id2);
    });

    it('stores the UUID in localStorage under fad_user_id', () => {
      const id = getUserId();
      expect(localStorage.getItem('fad_user_id')).toBe(id);
    });
  });

  describe('onboarding state', () => {
    it('returns false when onboarding not completed', () => {
      expect(hasCompletedOnboarding()).toBe(false);
    });

    it('returns true after setOnboardingComplete', () => {
      setOnboardingComplete();
      expect(hasCompletedOnboarding()).toBe(true);
    });

    it('returns false after resetOnboarding', () => {
      setOnboardingComplete();
      resetOnboarding();
      expect(hasCompletedOnboarding()).toBe(false);
    });
  });

  describe('feed token', () => {
    it('returns null when no token is set', () => {
      expect(getFeedToken()).toBeNull();
    });

    it('persists and retrieves feed token', () => {
      setFeedToken('test-token-123');
      expect(getFeedToken()).toBe('test-token-123');
    });

    it('clears feed token', () => {
      setFeedToken('test-token-123');
      clearFeedToken();
      expect(getFeedToken()).toBeNull();
    });
  });
});
