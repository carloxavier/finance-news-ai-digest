export function getUserId(): string {
  let userId = localStorage.getItem('fad_user_id');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('fad_user_id', userId);
  }
  return userId;
}

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem('fad_onboarding_complete') === 'true';
}

export function setOnboardingComplete(): void {
  localStorage.setItem('fad_onboarding_complete', 'true');
}

export function resetOnboarding(): void {
  localStorage.removeItem('fad_onboarding_complete');
}
