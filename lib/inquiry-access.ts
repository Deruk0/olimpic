import type { SessionAccount } from "./auth";
import { demoLoginEnabled } from "./demo-access";

export function inquiryPolicyUrl() {
  const value = process.env.OLIMPIK_PRIVACY_POLICY_URL?.trim();
  return value && URL.canParse(value) && new URL(value).protocol === "https:" ? value : undefined;
}

export function canAcceptInquiries() {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(inquiryPolicyUrl() && process.env.DATABASE_URL?.trim() &&
    (!demoLoginEnabled() || process.env.OLIMPIK_INQUIRY_REVIEWERS?.trim()));
}

export function isDesignatedInquiryReviewer(id: string) {
  return process.env.OLIMPIK_INQUIRY_REVIEWERS?.split(",").some(value => value.trim() === id) ?? false;
}

export function canReviewInquiries(user: SessionAccount) {
  if (user.role !== "methodist" || user.demo_session) return false;
  return process.env.OLIMPIK_INQUIRY_REVIEWERS?.trim()
    ? isDesignatedInquiryReviewer(user.id)
    : !demoLoginEnabled();
}
