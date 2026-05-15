# LinkedIn Profile Payload Reference (Simple)

This file explains the profile payload fields in plain English and how they can be used in our MVP/backend.

## 1) Top-level blocks

- `fetchedAt`
  - What it is: Time when data was fetched.
  - Use: Freshness checks, caching, retry logic.
- `limits`
  - What it is: Safety/rate-control settings used during fetch.
  - Use: Throttling, anti-spam behavior, stable scraping/API behavior.
- `profileUrn`
  - What it is: LinkedIn internal unique profile ID (`urn:li:fsd_profile:...`).
  - Use: Stable key for joining profile-related data across calls.
- `resolvedProfile`
  - What it is: Clean human-facing summary (name, slug, title).
  - Use: Fast UI display and quick sanity checks.
- `meData` / `meDataRaw`
  - What it is: Logged-in user identity details (clean + raw).
  - Use: Verify account identity and normalize profile owner info.
- `profileData` / `profileDataRaw`
  - What it is: Target profile details (clean + full raw LinkedIn response).
  - Use: Main source for analyzer context and deeper section fetch pointers.
- `profileError`
  - What it is: Error status for profile fetch.
  - Use: Detect partial fetch and trigger retry/fallback.

## 2) Identity fields

- `objectUrn` / `trackingMemberId` / `plainId`
  - What it is: Member identifiers in different forms.
  - Use: Internal joins, deduplication.
- `publicIdentifier`
  - What it is: Public LinkedIn slug (e.g. `priyansh-srivastava-...`).
  - Use: URL generation and profile matching.
- `firstName`, `lastName`, `fullName`, `headline`, `occupation`
  - What it is: Core profile identity text.
  - Use: Basic context pack fields for analyzer prompts.

## 3) Locale and geography fields

- `primaryLocale`, `supportedLocales`
  - What it is: Main and supported language/country locales.
  - Use: Locale-aware parsing and output style choices.
- `location.countryCode`, `location.postalCode`, `geoLocation.geoUrn`
  - What it is: Location details and geo reference.
  - Use: Region context for relevance checks and filtering.

## 4) Profile text fields

- `summary` / `multiLocaleSummary`
  - What it is: About section text (often rich and long).
  - Use: High-value input for profile analysis quality checks.
- `headline` / `multiLocaleHeadline`
  - What it is: Headline text.
  - Use: Role classification, niche detection, relevance scoring.

## 5) Section pointers (very important)

- `experienceCardUrn`
- `educationCardUrn`
- `profileCardUrns.experienceCardUrn`
- `profileCardUrns.educationCardUrn`

What they are:

- Internal pointers to specific profile cards.

Use:

- Fetch detailed data for experience/education beyond top-card summary.
- Build fuller profile snapshot over multiple calls.

## 6) Media fields

- `profilePicture` / `picture`
- `backgroundPicture` / `backgroundImage`
- `displayImageUrn`, `originalImageUrn`

What they are:

- Profile and cover image metadata and URLs.

Use:

- Visual display in UI only.
- Usually low analytical value for text-based ranking logic.

Note:

- URLs are time-limited and may expire.

## 7) Contact and external links

- `emailAddress.emailAddress`
- `websites[]`

What they are:

- Personal contact and external links.

Use:

- Optional enrichment only.

Warning:

- PII/sensitive. Do not send directly to LLM by default.
- Mask or drop in stored analyzer context unless absolutely needed.

## 8) Verification and badge fields

- `verificationData`
- `displayBadges`
- `showVerificationBadge`

What they are:

- Verification/badge status.

Use:

- Optional trust/authority signal.
- Good for profile credibility hints in report output.

## 9) Creator and influence fields

- `creator`
- `creatorInfo.associatedHashtagUrns`
- `influencer`
- `creatorBadgeStatus`

What they are:

- Creator-mode indicators and associated topics.

Use:

- Content strategy context (topic consistency, audience alignment).

## 10) Education and student fields

- `student`
- `educationOnProfileTopCardShown`
- `educationCardUrn`

What they are:

- Education-state indicators and education card pointer.

Use:

- Persona segmentation (student vs experienced professional).
- Pull education details for relationship/context checks.

## 11) Premium and feature flags (what is enabled)

From `premiumFeatures[]` and related booleans:

- `premium`
- `premiumSubscriber`
- `showPremiumSubscriberBadge`
- `hasEnabled`
- `hasAccess`
- `hasUpsellAccess`
- `featureName`

Observed feature names:

- `PROFILE_CUSTOM_CTA`
- `FEATURED_PROFILE_SECTION`
- `COVER_PHOTO_CAROUSEL`

What these mean:

- Whether premium-related profile features are available/enabled.

How we can use:

- Product UX adaptation (show feature-aware suggestions).
- Avoid recommending actions user cannot perform without premium.

## 12) Misc profile state flags

- `qualityProfile`
  - Better completeness indicator for profile quality.
- `endorsementsEnabled`
  - Whether endorsement behavior is enabled.
- `showFollowerCount`
  - Whether follower count is publicly shown.
- `companyNameOnProfileTopCardShown`
  - UI presentation flag.
- `memorialized`
  - Special account state; should avoid normal recommendations.
- `hideNonSelfProfileViewBasedOnViewer`
  - Visibility behavior flag.
- `geoLocationBackfilled`
  - Location inferred/backfilled status.
- `emailRequired`, `idvAdditionalNameConsent`, `iweWarned`
  - Account/compliance-flow flags.

## 13) High-priority fields for analyzer context pack (MVP)

Use first:

- `publicIdentifier`
- `firstName`, `lastName`
- `headline`
- `summary` (or `multiLocaleSummary`)
- `location.countryCode` (+ postal if available)
- `industryUrn`
- `experienceCardUrn`, `educationCardUrn`
- `creator`, `creatorInfo.associatedHashtagUrns`
- `verificationData` / verification badge state

Optional for later:

- Premium feature flags
- Websites
- Media metadata

## 14) Data safety notes

- Treat as sensitive profile data.
- Never log raw payloads in plaintext in production logs.
- Mask/drop: `emailAddress`, anti-abuse metadata, tracking IDs.
- Store a normalized subset for analyzer use; keep raw snapshot only when needed for debugging/audit with access control.

