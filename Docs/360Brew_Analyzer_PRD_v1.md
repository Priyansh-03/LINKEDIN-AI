# 360Brew-Informed LinkedIn Analyzer
## Comprehensive Product & Technical Specification

---

**Document Version:** 1.0
**Date:** May 2026
**Document Type:** Product Requirements Document (PRD) + Technical Architecture Specification
**Audience:** Product Managers, Engineering Leadership, Flutter Developers, AI/ML Engineers

---

## 📋 TABLE OF CONTENTS

1. **Executive Summary**
2. **Background: The 360Brew Paper**
3. **Product Vision & Strategy**
4. **Core Hypothesis & Disclaimers**
5. **Target Users & Use Cases**
6. **Product Architecture Overview**
7. **Module 1: Profile Analyzer**
8. **Module 2: Behavior Analyzer**
9. **Module 3: Content Analyzer**
10. **Module 4: Comparative Intelligence**
11. **Module 5: Reporting & Recommendations**
12. **Technical Architecture**
13. **Data Models**
14. **API Specifications**
15. **Claude Prompt Library**
16. **Confidence Level System**
17. **UI/UX Specifications**
18. **Build Roadmap**
19. **Quality Assurance**
20. **Privacy, Security & Compliance**
21. **Success Metrics**
22. **Risk Register**
23. **Open Questions**

---

# 1. EXECUTIVE SUMMARY

## 1.1 The Product In One Paragraph

The **360Brew-Informed Analyzer** is a Flutter-based application that helps any LinkedIn user understand how LinkedIn's foundational ranking algorithm (360Brew) likely classifies their profile, content, and behavior. The system uses a real LLM (Claude) as an analytical engine, applying the same conceptual mechanics described in LinkedIn's published research paper (arXiv 2501.16450) to generate insights, identify gaps, and produce actionable recommendations.

## 1.2 Why This Product Exists

🟢 **The problem:** LinkedIn's 360Brew algorithm uses textual representations of user profiles and interaction histories as inputs to an LLM-based ranking system. Users have no visibility into how the algorithm "sees" them. Existing LinkedIn tools focus on surface metrics (followers, likes) and don't analyze the actual signals the algorithm uses.

🟡 **The opportunity:** LinkedIn published the foundational paper describing how 360Brew works. By applying these published mechanics through a real LLM, we can build an analyzer that gives users directionally accurate insights into their algorithmic positioning—even though we cannot access the actual model.

🟢 **The differentiator:** This is the only product that:
- Grounds analysis in published research, not speculation
- Analyzes profile + behavior + content as the algorithm does (as text)
- Tags every insight with confidence levels
- Works for any LinkedIn user, any niche, any goal

## 1.3 Core Capabilities

The product delivers five core capabilities:

1. **Profile Analyzer** — Evaluates how the user's profile text would be classified by an LLM-based ranking system
2. **Behavior Analyzer** — Evaluates whether the user's interaction history sends coherent or diluted signals
3. **Content Analyzer** — Pre-publish analysis predicting how a draft post will align with established profile/behavior signals
4. **Comparative Intelligence** — Benchmarks the user against peers in their declared niche
5. **Reporting & Recommendations** — Generates time-series reports tracking improvement over 30/60/90 day periods

## 1.4 Honest Scope Statement

🚨 **What this product is NOT:**

- ❌ NOT a copy of LinkedIn's 360Brew model
- ❌ NOT capable of producing actual algorithm scores
- ❌ NOT an automation tool (no LinkedIn account actions taken)
- ❌ NOT a guarantee of viral content or job placement

🟢 **What this product IS:**

- ✅ A research-grounded analytical framework
- ✅ A systematic coach using paper-published mechanics
- ✅ A directional indicator of likely algorithmic positioning
- ✅ A productivity tool that compresses analysis time from hours to minutes

## 1.5 Build Investment Summary

- **MVP Phase 1 (8 weeks):** Profile Analyzer + Behavior Analyzer + Content Analyzer
  - Estimated: $30,000-$50,000 (1 senior Flutter dev + 1 prompt engineer + 1 designer)
  
- **Phase 2 (4 weeks):** Comparative Intelligence + Reporting
  - Estimated: $15,000-$25,000

- **Phase 3 (8 weeks):** SaaS productization (multi-user, billing, marketing)
  - Estimated: $40,000-$80,000

- **Operating Costs (1,000 users):** $3,000-$6,000/month
- **Pricing Target:** $20-30/user/month

---

# 2. BACKGROUND: THE 360BREW PAPER

This section establishes the research foundation that grounds every analytical decision in this product. Direct quotes and findings from the paper drive the algorithmic logic.

## 2.1 Paper Reference

🟢 **Primary Source:** "360Brew: A Decoder-only Foundation Model for Personalized Ranking and Recommendation"
- **arXiv ID:** 2501.16450 (v1 published January 27, 2025)
- **Authors:** Hamed Firooz, Maziar Sanjabi, et al. (LinkedIn FAIT Team)
- **Institution:** LinkedIn Foundation AI Technologies team
- **URL:** https://arxiv.org/abs/2501.16450

🟢 **Secondary Confirmation:** LinkedIn Engineering Blog publication "Engineering the next generation of LinkedIn's Feed" by Hristo Danchev (March 12, 2026) confirms 360Brew has been deployed in production for feed ranking.

## 2.2 Architecture Foundations

🟢 **Verified architecture details from the paper:**

| Property | Value |
|----------|-------|
| Model size | 150 billion parameters |
| Architecture type | Decoder-only LLM |
| Base model | Mixtral 8x22B Mixture of Experts (MoE) |
| Training duration | 9 months |
| Training data | LinkedIn first-party data (excludes EU users) |
| Tasks supported | 30+ predictive tasks |
| Surfaces covered | 8+ LinkedIn surfaces |
| Max context window tested | 88,000 tokens |

⚠️ **Common misinformation to correct:** Multiple secondary sources claim 360Brew is built on LLaMA 3. The paper explicitly states it is built on Mixtral 8x22B. We will use this verified information.

## 2.3 The Mathematical Foundation

🟢 **From the paper (Section 2.1, Equation 1):**

The model approximates this joint probability distribution for all members:

```
P(m, (e₁, i₁), (e₂, i₂), ..., (eₙ, iₙ))
```

Where:
- `m` represents the **member profile as text**
- `(eⱼ, iⱼ)` are the **set of historical items and interactions** encoded as text for member m
- `eⱼ` represents an event/interaction type
- `iⱼ` represents the item interacted with

🟢 **From the paper (Section 2.1, Equation 2):**

For ranking tasks, the model computes:

```
P(iₜ, iₜ₊₁, ... | Task Instruction, m, (e₁, i₁), ..., (eₜ₋₁, iₜ₋₁), eₜ, eₜ₊₁, ...)
```

This is the equation our analyzer's logic must mirror in its evaluations.

## 2.4 The Three Inputs (Critical Foundation)

🟢 The paper definitively establishes that 360Brew uses three inputs:

### Input 1: Member Profile (Verbalized as Text)

The paper states: *"u represents the member profile as text"*

This includes:
- Headline
- About/Summary section
- Experience descriptions
- Skills section
- Education
- Certifications
- Recommendations
- Featured content

**Implication for our analyzer:** Every word in a user's profile becomes part of the LLM's context window. Profile analysis must evaluate text quality as if it were being fed to an LLM.

### Input 2: Interaction History (Verbalized as Text)

The paper states: *"(eⱼ, iⱼ), j=1,...,N are the set of historical items and interactions encoded as text for member m"*

This includes:
- Reactions (likes, celebrate, support, etc.) on posts
- Comments left on posts
- Profile views
- Job applications/views
- Connection requests sent/accepted
- Searches performed
- Companies followed
- Posts saved

**Implication for our analyzer:** User behavior is half the algorithmic signal. The Behavior Analyzer is therefore a critical—not optional—module.

### Input 3: Task Instruction

The paper provides an example in Table 1 for job recommendations:

```
"You are provided a member's profile and a set of jobs, their description, 
and interactions that the member had with the jobs..."
"Your task is to analyze the job interaction data along with the member's 
profile to predict whether the member will apply, view, or dismiss a new job..."
"Note: Focus on skills, location, and years of experience more than other 
criteria. In your calculation, assign a 30% weight to the relevance between 
the member's profile and the job description, and a 70% weight to the 
member's historical activity."
```

🟢 **Critical finding:** For job recommendations, the model is instructed to weight historical activity at 70% and profile-job match at 30%. **This is the single most important fact for senior job seekers and is encoded throughout our analyzer.**

### 2.4.1 Analyzer Implementation Contract (Math to Engine Mapping)

To mirror Equation 2 in implementation, every analyzer run must compute a deterministic math trace in addition to LLM narrative output:

```
profile_signal_score = f(profile text quality features)
behavior_signal_score = g(interaction history features)
math_score = clamp(0,100, round((0.3 * profile_signal_score + 0.7 * behavior_signal_score) * task_instruction_multiplier))
```

Required constraints:
- The analyzer must always include all three inputs: profile text (`m`), interaction history (`(e_j, i_j)`), and task instruction.
- For job-style ranking logic, behavior signal must remain dominant (70%) and profile match secondary (30%).
- Output must expose both model verdict and deterministic math trace for auditability.
- Tier assignment must be derived from score bands: `90-100 AUTHORITY`, `75-89 NICHE`, `50-74 GENERIC`, `0-49 CONFUSED`.

## 2.5 The Six Key Findings That Drive Our Logic

The paper establishes six findings that directly inform our analyzer's mechanics:

### Finding 1: Data Scaling Improves Performance (Figure 2)

🟢 The paper proves that increasing training data 3x improved model performance significantly. The slope of improvement is not flattening, suggesting more data continues to yield gains.

**Implication for our analyzer:** Users who post and engage more (more data) generally have richer signals for the algorithm to use. Our analyzer should reward consistent activity over sporadic posting.

### Finding 2: Model Size Improves Performance (Figure 3)

🟢 The paper shows performance improves with larger pre-trained architectures. This is a general LLM scaling law applied to ranking.

**Implication for our analyzer:** Not directly applicable to user behavior, but reinforces that 360Brew is a serious LLM with reasoning capabilities.

### Finding 3: History Length Improves Performance (Figure 4) ⭐ CRITICAL

🟢 The paper proves that performance improves as max context length increases (8K → 88K tokens tested). More history = better predictions.

**Direct quote:** *"360Brew model's performance gets better as we increase the history by increasing the max context length"*

**Implication for our analyzer:**
- Long-term consistency matters mathematically
- A user's last 6+ months of behavior is in context
- Sudden niche pivots take time to "register" with the algorithm
- Our analyzer should evaluate behavior over weeks/months, not days

### Finding 4: Cold-Start Members Benefit Most (Figure 6) ⭐ CRITICAL

🟢 The paper proves that 360Brew has the largest performance gap over baseline models when members have FEW interactions (5-10 vs 100).

**Direct quote:** *"the performance gap between the two models is the largest when member has few available interactions"*

**Implication for our analyzer:**
- New users (or those who reset their behavior signal) get a "fresh start" advantage
- Established users with messy history have biases baked in
- Our analyzer should propose 30-60 day reset protocols for users with diluted signals

### Finding 5: Temporal Robustness (Figure 7) ⭐ CRITICAL

🟢 The paper proves that 360Brew's performance degrades less over time than baseline models. The model adapts in real-time as user behavior shifts.

**Direct quote:** *"the performance of the 360Brew model is less affected by time"*

**Implication for our analyzer:**
- Niche pivots ARE recoverable through consistent new behavior
- Users locked in old classifications can rebuild
- Our analyzer should provide 60-90 day adaptation timelines

### Finding 6: Out-of-Domain Generalization (Figure 5)

🟢 The paper proves that 360Brew can generalize to tasks/surfaces not in training data, achieving performance comparable to or better than production models.

**Implication for our analyzer:** The model has reasoning capabilities, not just pattern matching. It evaluates semantic coherence, not keyword density.

## 2.6 The Two-Layer Architecture (Often Misunderstood)

🟢 The paper makes clear that LinkedIn's recommendation system has two layers (Figure 1):

### Layer 1: Retrieval

- Narrows millions of items to ~2,000 candidates
- Uses traditional methods (two-tower models, embeddings)
- Optimized for recall and scalability
- 360Brew does NOT operate at this layer

### Layer 2: Ranking

- Takes ~2,000 retrieved candidates
- Ranks with high precision
- Optimized for member-facing quality
- 360Brew operates HERE

**Implication for our analyzer:** Even with perfect 360Brew positioning, retrieval still happens first. We must inform users that retrieval uses traditional signals (search keywords, location, basic filters) and 360Brew refines from there.

## 2.7 Many-Shot In-Context Learning

🟢 The paper introduces a key concept: *"In any recommendation task, each member, with their unique profile and history of interactions, can be viewed as a many-shot problem"*

**Translation:** The model uses YOUR profile and YOUR history as in-context learning examples to predict YOUR future behavior. It's personalizing to you specifically using your verbalized data.

**Implication for our analyzer:** Generic advice is wrong. Each user's analysis must factor in their unique profile + history combination.

## 2.8 What The Paper Does NOT Establish

To maintain intellectual honesty, our analyzer must distinguish what's verified from what's commonly claimed:

### NOT in the paper (commonly misattributed):

- 🔴 "First 2 lines of posts get 3-5x weight"
- 🔴 "90-Minute Quality Gate for early engagement"
- 🔴 "Specific saves multipliers (e.g., 3.9x impressions per 200 saves)"
- 🔴 "Spam/Low/Good/Expert tier classification system"
- 🔴 "Direct AI-content detection mechanism"
- 🔴 "Posting frequency rules (3 posts/week is optimal)"
- 🔴 "Best time to post (e.g., 9 AM Tuesday)"
- 🔴 "Comment word count requirements (15+ words)"

These are practitioner observations or speculation, NOT paper-verified facts. Our analyzer must be careful to tag these appropriately.

### Verified in the paper:

- 🟢 Profile is verbalized as text and used as LLM input
- 🟢 Interaction history is verbalized and used as LLM input
- 🟢 More history = better predictions
- 🟢 Cold-start members benefit most from this approach
- 🟢 Temporal adaptation works (niche pivots recoverable)
- 🟢 Job ranking uses 70% behavior, 30% profile weighting
- 🟢 Many-shot in-context learning applies
- 🟢 Two-layer architecture (retrieval then ranking)

---

# 3. PRODUCT VISION & STRATEGY

## 3.1 Product Vision

> Empower every LinkedIn user to understand and optimize how the platform's algorithm classifies them—using research-grounded analysis instead of speculation.

## 3.2 Strategic Positioning

### Market Landscape

🟡 The current LinkedIn analytics tools landscape:

| Tool | Approach | Limitation |
|------|----------|------------|
| LinkedIn Native Analytics | Surface metrics | Doesn't reveal algorithm signals |
| Shield, Taplio | Engagement tracking | Speculation-based tactics |
| Buffer, Hootsuite | Scheduling | No analytical depth |
| AuthoredUp, Inlytics | Post analytics | Lacks profile/behavior analysis |
| Lempod (banned) | Engagement automation | ToS violations |

**Our positioning:** The first analyzer grounded in LinkedIn's published research, with confidence-tagged insights, covering profile + behavior + content as a unified system.

### Strategic Moats

1. **Paper-grounded methodology** — Hard to replicate without deep research understanding
2. **Behavioral signal analysis** — No competitor analyzes interaction history as 360Brew input
3. **Confidence level system** — Distinguishes verified from speculation
4. **Three-module integration** — Most competitors only do one (typically content)

## 3.3 Target Outcomes

For users:
- 🎯 Understand their current algorithmic classification
- 🎯 Identify specific gaps in profile or behavior
- 🎯 Make data-informed decisions before publishing content
- 🎯 Track algorithmic signal improvement over 60-90 days

For business:
- 🎯 Differentiated SaaS offering with paper-backed credibility
- 🎯 Adjacent expansion from career acceleration platforms
- 🎯 Subscription revenue at $20-30/user/month
- 🎯 Lower CAC through content-led marketing (the methodology IS the marketing)

---

# 4. CORE HYPOTHESIS & DISCLAIMERS

## 4.1 The Hypothesis

🟡 **Our central hypothesis:** Using a real LLM (Claude) to apply the published 360Brew methodology can produce directionally accurate analyses of LinkedIn profile and behavior signals, sufficient to drive measurable user outcomes (more reach, more inbound, more interview invitations) over a 60-90 day execution period.

## 4.2 Why This Is Defensible

🟢 **Methodological soundness:**
- 360Brew is itself an LLM (built on Mixtral 8x22B)
- Our analyzer uses an LLM (Claude) with similar reasoning capabilities
- The inputs (profile text, behavior history, task instructions) are the same conceptually
- The outputs (classifications, predictions) are conceptually similar

🟡 **Limitations to acknowledge:**
- We use a different LLM than LinkedIn does
- We don't have access to LinkedIn's training data
- We don't have access to actual ranking outcomes
- Our predictions are directional, not literal

## 4.3 Mandatory Disclaimers

Every user-facing report must include:

```
⚠️ ANALYSIS DISCLAIMER

This analyzer applies methodology described in LinkedIn's published 
research paper (arXiv 2501.16450) using a real LLM as the analytical 
engine. We are NOT LinkedIn and we cannot access the actual 360Brew 
model.

Our analyses are:
✅ Grounded in published research
✅ Generated by reasoning about your inputs the way 360Brew is documented to
✅ Directionally informative for optimization

Our analyses are NOT:
❌ Literal LinkedIn algorithm scores
❌ Guarantees of specific outcomes
❌ Substitutes for genuine expertise or work quality

Claims marked 🟢 are paper-verified.
Claims marked 🟡 are observed in practitioner data.
Claims marked 🔴 are speculation; use with caution.
```

This disclaimer is non-negotiable and appears on every analysis report.

---

# 5. TARGET USERS & USE CASES

## 5.1 Primary Personas

### Persona 1: The Thought Leader Builder
- **Profile:** Mid-career professional building authority in their niche
- **Goal:** Grow followers, drive inbound (deals, speaking, opportunities)
- **Time available:** 5-10 hours/week on LinkedIn
- **Frustration:** Inconsistent reach, can't tell what's working
- **Module priority:** Content Analyzer + Profile Analyzer

### Persona 2: The Senior Job Seeker (10+ YOE)
- **Profile:** Established professional considering next role
- **Goal:** Recruiter discoverability + hiring manager credibility
- **Time available:** 3-5 hours/week (high opsec)
- **Frustration:** Sending signals to wrong audiences, no inbound
- **Module priority:** Profile Analyzer + Behavior Analyzer

### Persona 3: The Founder/Operator
- **Profile:** Founder or senior leader at a startup
- **Goal:** Personal brand → company brand → deal flow
- **Time available:** 2-3 hours/week
- **Frustration:** Limited time, need maximum efficiency
- **Module priority:** All three modules, prioritized by impact

### Persona 4: The Career Coach (B2B Use Case)
- **Profile:** Consultant or coach helping clients
- **Goal:** Audit and advise client LinkedIn profiles at scale
- **Time available:** Variable, professional use
- **Frustration:** Manual analysis takes 2-3 hours per client
- **Module priority:** All modules, multi-profile support

## 5.2 Use Cases by Persona

### Use Case 1: Profile Diagnostic
**Persona:** Any
**Trigger:** New user onboarding OR existing user wants assessment
**Flow:** Upload profile → Profile Analyzer runs → Receives report
**Outcome:** User understands current classification, sees specific gaps

### Use Case 2: Pre-Publish Content Check
**Persona:** Thought Leader, Founder
**Trigger:** Drafting a new post
**Flow:** Paste draft → Content Analyzer runs → Receives feedback
**Outcome:** User refines hook, ensures coherence, improves before publishing

### Use Case 3: Behavior Reset Protocol
**Persona:** Job Seeker, Thought Leader
**Trigger:** Diagnostic shows diluted behavior signals
**Flow:** Track engagement for 30 days → Behavior Analyzer evaluates trends
**Outcome:** User rebuilds clean signal over 60-90 days

### Use Case 4: Quarterly Audit
**Persona:** Any
**Trigger:** Re-evaluation every 60-90 days
**Flow:** Run all three analyzers → Compare to baseline → Track improvement
**Outcome:** User sees measurable progress, identifies new gaps

### Use Case 5: Multi-Client Management
**Persona:** Career Coach (Pro Tier)
**Trigger:** Client onboarding
**Flow:** Add client profile → Run analyzers → Generate client report
**Outcome:** Coach delivers professional-grade analysis to client

---
# PRD Part 2: Module Specifications

---

# 6. PRODUCT ARCHITECTURE OVERVIEW

## 6.1 The Five-Module System

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   USER LINKEDIN PROFILE + BEHAVIOR + DRAFT CONTENT       │
│                                                          │
└──────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   MODULE 1: PROFILE ANALYZER                             │
│   "How is the LLM classifying you based on your text?"   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   MODULE 2: BEHAVIOR ANALYZER                            │
│   "What signals does your interaction history send?"     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   MODULE 3: CONTENT ANALYZER (Pre-Publish)               │
│   "Will this post align with your established signals?"  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   MODULE 4: COMPARATIVE INTELLIGENCE                     │
│   "How do you compare to peers in your declared niche?"  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   MODULE 5: REPORTING & RECOMMENDATIONS                  │
│   "Track your progress over 30/60/90 days."              │
│                                                          │
└──────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   UNIFIED INSIGHTS + ACTION PLAN                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 6.2 How Modules Interact

The modules are not independent silos. They share data and inform each other:

- **Profile Analyzer** establishes the user's *declared identity* (what their text claims)
- **Behavior Analyzer** establishes the user's *demonstrated identity* (what their actions show)
- **Content Analyzer** evaluates whether a draft *aligns with both*
- **Comparative Intelligence** benchmarks the user against the declared niche
- **Reporting** synthesizes all of the above over time

🟢 **Critical principle:** A user's algorithmic classification is the *intersection* of profile + behavior. Misalignment between these two creates the "confused signal" problem the analyzer must surface.

---

# 7. MODULE 1: PROFILE ANALYZER

## 7.1 Purpose

Evaluate the user's LinkedIn profile **as the LLM input it actually is**. Per the paper, profile text is verbalized and fed into 360Brew as context. Our analyzer must score whether that verbalization is unambiguous, semantically rich, and well-classified.

## 7.2 Inputs Required

### 7.2.1 Mandatory Inputs

The user provides their profile content through one of two methods:

**Method A: Manual Paste (MVP)**
- Headline (text, max 220 chars)
- About section (text, max 2,600 chars)
- Each Experience entry (role title, company, duration, description text)
- Skills list (text array)
- Education entries
- Certifications
- Recommendations received (text array)

**Method B: Profile URL Submission (Future Phase)**
- User pastes their LinkedIn profile URL
- System guides them through manual extraction (LinkedIn ToS prohibits automated scraping)

🚨 **Critical compliance note:** We do NOT scrape LinkedIn. All profile data is user-provided. This is non-negotiable for ToS compliance.

### 7.2.2 Optional Inputs (Improve Analysis)

- Declared niche/specialty (free text)
- Geographic focus
- Career goal (Growth / Job Seeking / Both)
- Industry context
- Years of experience
- Target audience description

## 7.3 Analysis Logic

The Profile Analyzer runs **seven sub-analyses** in sequence:

### 7.3.1 Sub-Analysis A: Headline Decomposition

🟢 **Paper foundation:** The headline is the most concentrated piece of text in the profile. Per the paper's verbalization principle, every word becomes context.

**Evaluation criteria:**

```
HEADLINE COMPONENTS TO EVALUATE:

1. Topic Clarity (1-10 score)
   - Would an LLM unambiguously classify the user's domain from headline alone?
   - Are the keywords specific (e.g., "agentic AI") or vague (e.g., "innovation leader")?

2. Seniority Signal (1-10 score)
   - Is the user's level clear (Senior, Lead, Principal, VP, Founder)?
   - Are years of experience anchored?
   - Is title aligned with claimed seniority?

3. Outcome Specificity (1-10 score)
   - Does the headline include a specific outcome or value prop?
   - Concrete metrics > vague claims

4. Search Keyword Density (1-10 score)
   - Recruiter-searchable terms present?
   - Industry-standard role names used?

5. Differentiation (1-10 score)
   - What separates this user from 1000 others with similar roles?
   - Unique angle vs generic positioning

6. Character Efficiency (1-10 score)
   - Optimal use of 220 character limit?
   - Filler words vs high-density positioning
```

**Output structure:**

```json
{
  "headline_text": "...",
  "scores": {
    "topic_clarity": 8,
    "seniority_signal": 5,
    "outcome_specificity": 7,
    "keyword_density": 9,
    "differentiation": 6,
    "character_efficiency": 8
  },
  "overall_headline_score": 71,
  "issues_found": [
    {
      "severity": "high",
      "issue": "No years of experience anchor — recruiters can't filter for senior roles",
      "confidence": "🟡",
      "fix": "Add '20+ yrs' or 'Senior' designation"
    }
  ],
  "rewrite_options": [
    "Option A: ...",
    "Option B: ...",
    "Option C: ...",
    "Option D (Hybrid): ..."
  ]
}
```

### 7.3.2 Sub-Analysis B: About Section Semantic Density

🟢 **Paper foundation:** The About section is the longest text block fed to the LLM as profile context. Semantic richness directly affects classification accuracy.

**Evaluation criteria:**

```
ABOUT SECTION ELEMENTS TO EVALUATE:

1. First 275 Characters Hook (1-10 score)
   - Does it nail the topic before the "...see more" cutoff?
   - Strong opening vs generic intro

2. Topic Coherence (1-10 score)
   - Are the topics covered consistent?
   - Or does it drift across multiple unrelated themes?

3. Specificity Density (1-10 score)
   - Number of concrete details (numbers, named tools, specific outcomes)
   - Vague vs concrete language ratio

4. Pillar Definition (1-10 score)
   - Are 3-5 expertise pillars clearly defined?
   - Or is it a wall of text without structure?

5. Voice/Authenticity (1-10 score)
   - Reads like a real person vs generic LinkedIn-speak
   - First-person authenticity present

6. CTA Presence (1-10 score)
   - Clear next-step for readers (DM, contact, follow)
   - Soft vs hard CTA appropriateness

7. Length Optimization (1-10 score)
   - Sweet spot: 1,200-2,400 characters
   - Too short = thin signal
   - Too long = scanned/skipped
```

### 7.3.3 Sub-Analysis C: Experience Description Quality

🟢 **Paper foundation:** Each experience description becomes part of the verbalized profile. Multiple roles = compound context.

**Evaluation per role:**

```
EXPERIENCE EVALUATION DIMENSIONS:

1. Scope Clarity (1-10)
   - Is the role's scope/scale evident?
   - Team size, budget, geography mentioned?

2. Outcome Density (1-10)
   - Concrete outcomes with numbers?
   - Or just responsibilities listed?

3. Strategic vs Tactical Balance (1-10)
   - Senior roles should show strategic responsibility
   - Junior framing on senior roles = downgrade signal

4. Verb Strength (1-10)
   - Action verbs vs passive descriptions
   - "Led X" vs "Was responsible for X"

5. Skill Tagging Coherence (1-10)
   - Does this role's skill tags match the description?
   - Internal consistency check

6. Recency Treatment (1-10)
   - Current role: highest density of detail
   - Older roles: appropriately compressed
```

### 7.3.4 Sub-Analysis D: Skills Section Strategy

🟢 **Paper foundation:** Skills are explicit categorical signals fed to the LLM. They reinforce profile classification.

**Evaluation criteria:**

```
SKILLS EVALUATION DIMENSIONS:

1. Top 3 Alignment (1-10)
   - Are the most-weighted skills aligned with declared niche?
   - Or are they generic/irrelevant?

2. Total Skill Count (1-10)
   - 30-100 skills is the optimal range
   - Too few = thin categorical signal
   - Too many = diluted focus

3. Niche-Aligned Skills Present (1-10)
   - Specific industry/role skills present?
   - Or generic "Leadership" / "Communication" only?

4. "Boring Filter" Skills Present (for senior roles) (1-10)
   - Strategic Planning, Cross-Functional Leadership, 
     Stakeholder Management, P&L Management, etc.
   - These are recruiter filters most users skip

5. Endorsement Distribution (1-10) [if visible]
   - Top skills should have most endorsements
   - Misalignment between top skills and most-endorsed = noise

6. Skill-to-Experience Coherence (1-10)
   - Do skills match the experience descriptions?
   - Internal consistency check
```

### 7.3.5 Sub-Analysis E: Recommendations Quality

🟡 **Practitioner observation:** Recommendations carry social proof signal. The paper doesn't explicitly mention them, but they're part of profile text fed to the LLM.

**Evaluation criteria:**

```
RECOMMENDATIONS EVALUATION:

1. Count (1-10)
   - 5+ recommendations = solid signal
   - 0-2 = weak signal

2. Recency (1-10)
   - All within last 5 years = current
   - Mostly old = stale

3. Specificity (1-10)
   - Specific accomplishments mentioned?
   - Or generic praise?

4. Senior Source Quality (1-10)
   - Recommendations from senior people = stronger
   - Average length 15+ words = signal
```

### 7.3.6 Sub-Analysis F: Featured Section Strategy

**Evaluation criteria:**

```
FEATURED SECTION EVALUATION:

1. Item Count (1-10)
   - 3-5 items optimal
   - 0 = empty signal; 6+ = noise

2. Niche Alignment (1-10)
   - All items support declared niche?

3. Recency (1-10)
   - At least 1 item from last 30 days?
   - Or all stale content?

4. Content Mix (1-10)
   - Variety of formats (article, post, link, media)?
   - Or single-format only?
```

### 7.3.7 Sub-Analysis G: Composite Classification Prediction

This is the **synthesis layer**. Based on all six sub-analyses above, the analyzer predicts the user's likely 360Brew classification.

**Classification Tiers:**

```
TIER 1: AUTHORITY FIGURE (Score: 90-100)
- Profile is unambiguous about expertise
- Specific, concrete, senior signals throughout
- Predicted reach: above niche average
- Predicted recruiter discoverability: very high

TIER 2: NICHE SPECIALIST (Score: 75-89)
- Profile is clear on niche
- Some senior signals present
- Predicted reach: niche average
- Predicted recruiter discoverability: high

TIER 3: GENERIC PROFESSIONAL (Score: 50-74)
- Profile is moderately clear
- Mixed signals
- Predicted reach: below niche average
- Predicted recruiter discoverability: medium

TIER 4: CONFUSED SIGNAL (Score: 0-49)
- Profile lacks clarity
- Conflicting topics or seniority levels
- Predicted reach: low
- Predicted recruiter discoverability: low
```

## 7.4 The Profile Analyzer Prompt

This is the master prompt that powers the Profile Analyzer when calling Claude API:

```
═══════════════════════════════════════════════════════════
PROFILE ANALYZER PROMPT v1.0
═══════════════════════════════════════════════════════════

You are an expert analyst applying the methodology described in 
LinkedIn's 360Brew research paper (arXiv 2501.16450) to evaluate 
a LinkedIn profile.

CONTEXT FROM THE PAPER:
The 360Brew model uses profile text as direct input to a 150B 
parameter decoder-only LLM. The model approximates:

P(item | task instruction, member profile, member interaction history)

Where the member profile is verbalized as text and fed as LLM 
context. Your task is to evaluate this profile as 360Brew would: 
by reading the verbalized text and classifying the member.

CRITICAL EVALUATION PRINCIPLES:

1. EVERY WORD IS MATHEMATICAL INPUT
   - Vague language = vague semantic signal
   - Specific language = strong semantic signal
   - Generic phrases = low classification accuracy

2. PROFILE COHERENCE MATTERS
   - Internal contradictions confuse the model
   - Topic drift across sections dilutes signal

3. SEMANTIC RICHNESS WINS
   - Concrete details, named tools, specific outcomes = better
   - Number density correlates with semantic richness

USER CONTEXT PROVIDED:
[USER_CONTEXT_BLOCK]

Declared niche: {{niche}}
Career goal: {{career_goal}} (Growth / Job Seeking / Both)
Geographic focus: {{geography}}
Years of experience: {{years_experience}}
Target audience: {{target_audience}}

PROFILE DATA TO ANALYZE:

HEADLINE: {{headline_text}}

ABOUT SECTION: {{about_text}}

EXPERIENCE ENTRIES:
{{#each experiences}}
ROLE {{@index}}: {{title}} at {{company}}
DURATION: {{duration}}
DESCRIPTION: {{description}}
{{/each}}

SKILLS LISTED ({{skills_count}} total):
{{skills_list}}

RECOMMENDATIONS RECEIVED ({{recommendations_count}} total):
{{#each recommendations}}
FROM: {{from}}
TEXT: {{text}}
{{/each}}

FEATURED SECTION:
{{featured_items}}

ANALYSIS TASKS:

Perform the seven sub-analyses below in sequence. For each, 
provide a score (1-10), specific issues found, and recommended 
fixes. Tag every recommendation with confidence:

🟢 = Direct from 360Brew paper
🟡 = Observed in practitioner data
🔴 = Speculation; use with caution

SUB-ANALYSIS A: HEADLINE DECOMPOSITION
- Topic Clarity score
- Seniority Signal score
- Outcome Specificity score
- Search Keyword Density score
- Differentiation score
- Character Efficiency score

Provide:
- Composite headline score (sum × 1.67 to normalize to 100)
- Top 3 issues
- 4 rewrite options (Specific Outcome / Authority / Contrarian / Hybrid)
- Top recommendation with rationale

SUB-ANALYSIS B: ABOUT SECTION SEMANTIC DENSITY
- First 275 chars hook score
- Topic coherence score
- Specificity density score
- Pillar definition score
- Voice/authenticity score
- CTA presence score
- Length optimization score

Provide:
- Composite about score
- Top 3 issues
- Specific paragraph-by-paragraph rewrites if needed
- Restructured first 275 chars

SUB-ANALYSIS C: EXPERIENCE DESCRIPTION QUALITY
For current role + 2 most recent past roles:
- Scope Clarity
- Outcome Density
- Strategic vs Tactical Balance
- Verb Strength
- Skill Tagging Coherence
- Recency Treatment

Provide:
- Per-role scores
- Top 3 issues per role
- Restructured descriptions

SUB-ANALYSIS D: SKILLS SECTION STRATEGY
- Top 3 alignment
- Total skill count assessment
- Niche-aligned skills presence
- "Boring filter" skills (if senior role)
- Endorsement distribution coherence
- Skill-to-experience coherence

Provide:
- Skills strategy score
- Specific skills to add (with rationale)
- Specific skills to remove (with rationale)
- Recommended top 3 ordering

SUB-ANALYSIS E: RECOMMENDATIONS QUALITY
- Count, recency, specificity, source quality

Provide:
- Recommendations score
- Identified gaps
- Suggested action items (request templates if needed)

SUB-ANALYSIS F: FEATURED SECTION STRATEGY
- Item count, niche alignment, recency, content mix

Provide:
- Featured score
- Specific recommendations

SUB-ANALYSIS G: COMPOSITE CLASSIFICATION PREDICTION

Synthesize all sub-analyses to predict the user's likely 360Brew 
classification:

- Authority Figure (90-100)
- Niche Specialist (75-89)
- Generic Professional (50-74)
- Confused Signal (0-49)

Provide:
- Predicted classification with score
- Reasoning grounded in paper mechanics
- Top 3 highest-impact changes to elevate classification
- Realistic 30/60/90 day improvement projection

OUTPUT FORMAT:

Structure your response as JSON matching the following schema:

{
  "analysis_metadata": {
    "user_context": {...},
    "analysis_date": "...",
    "framework_version": "1.0"
  },
  "sub_analyses": {
    "headline": {...},
    "about": {...},
    "experience": [{...}, {...}, {...}],
    "skills": {...},
    "recommendations": {...},
    "featured": {...}
  },
  "composite_classification": {
    "tier": "...",
    "score": 0,
    "reasoning": "..."
  },
  "top_issues": [
    {"severity": "...", "issue": "...", "fix": "...", "confidence": "..."}
  ],
  "improvement_projection": {
    "30_days": "...",
    "60_days": "...",
    "90_days": "..."
  },
  "paper_grounded_disclaimer": "This analysis applies methodology 
  from arXiv 2501.16450 using Claude as the analytical engine. 
  Predictions are directional, not literal LinkedIn scores."
}

Be brutally honest. Treat the user like a paying client.
Tag every recommendation with confidence level.
Ground all major claims in paper-verified mechanics.
```

## 7.5 Output Specifications

The Profile Analyzer produces a structured report with:

1. **Score Dashboard** (visual)
   - Composite score: __/100
   - 6 sub-scores with individual ratings
   - Tier classification badge

2. **Critical Issues** (ranked, max 10)
   - Severity indicator
   - Confidence tag
   - Specific fix
   - Paper-grounded rationale

3. **Paste-Ready Rewrites**
   - 4 headline options
   - Restructured About section
   - Restructured experience descriptions
   - Skills recommendations

4. **Improvement Projection**
   - 30 / 60 / 90 day expectations
   - Confidence intervals on predictions

5. **Action Plan**
   - Top 5 actions this week
   - Top 5 actions this month
   - Long-term considerations

---

# 8. MODULE 2: BEHAVIOR ANALYZER

## 8.1 Purpose

🟢 **Paper foundation:** From the paper's Equation 1, interaction history `(eⱼ, iⱼ)` is verbalized as text and fed to the LLM as context. This is half of the model's input.

For job recommendations specifically (Table 1 of paper), the model is instructed to weight historical activity at **70%** versus profile match at **30%**.

**This module is the most underused leverage in LinkedIn growth strategy.** No competitor analyzes this rigorously.

## 8.2 Inputs Required

### 8.2.1 Behavior Data Collection Methods

🚨 **ToS-compliant collection only.** No scraping, no automation.

**Method A: Manual Logging (MVP)**
- User logs each LinkedIn action in the app after performing it
- Quick-entry UI: 5 seconds per action
- Categorized at time of entry

**Method B: Periodic Export**
- LinkedIn allows users to download their data (Settings → Privacy → Get a copy of your data)
- User uploads the export file
- App parses behavior history

**Method C: Voice Log (Future)**
- "Just liked Hamel's post on AI agents"
- Voice → categorized entry via Claude

### 8.2.2 Categorization Schema

Every logged action is categorized along these dimensions:

```
ACTION DIMENSIONS:

1. ACTION TYPE
   - Reaction (like, celebrate, support, etc.)
   - Comment (with optional length)
   - Share/Repost
   - Profile View
   - Connection Request Sent
   - Connection Request Accepted
   - Job View
   - Job Save
   - Job Application
   - Search Performed
   - Company Followed
   - Post Saved

2. TARGET CLASSIFICATION
   - In-niche (matches user's declared niche)
   - Adjacent niche (related but different)
   - Off-niche (random/diluting)
   - Senior content (signals senior level)
   - Junior content (signals junior level)
   - Target company content (for job seekers)
   - Hiring manager content (for job seekers)

3. METADATA
   - Timestamp
   - Person/company involved (optional)
   - Comment length (if applicable)
   - Notes (optional)
```

## 8.3 Analysis Logic

The Behavior Analyzer runs **six sub-analyses**:

### 8.3.1 Sub-Analysis A: Niche Coherence Ratio

🟢 **Mathematical foundation:** If the LLM verbalizes the user's last 30-50 interactions, what percentage are in the user's declared niche?

**Formula:**

```
NICHE_COHERENCE_RATIO = 
   (Count of in-niche actions / Total actions) × 100

Target: 80%+
Mixed: 50-79%
Diluted: <50%
```

**Why 80%?** 🟡 Practitioner consensus across multiple sources (Pettauer, van der Blom, Buffer) suggests 80% niche discipline drives strongest classification. Not paper-verified specifically, but mathematically sensible.

### 8.3.2 Sub-Analysis B: Senior Signal Ratio (Job Seekers)

🟢 **Paper foundation:** For job recommendations, 70% weight is on historical activity. If the user's behavior doesn't include senior-level engagement, the model deprioritizes them for senior matches.

**Formula:**

```
SENIOR_SIGNAL_RATIO = 
   (Senior content actions / Total in-niche actions) × 100

Target (for job seekers): 60%+
Mixed: 30-59%
Weak: <30%
```

### 8.3.3 Sub-Analysis C: Target Company Engagement (Job Seekers)

For users in job-seeking mode, this measures behavior on target company content:

```
TARGET_COMPANY_RATIO = 
   (Actions on target company content / Total senior actions) × 100

Target: 30%+
Mixed: 10-29%
Weak: <10%
```

### 8.3.4 Sub-Analysis D: Comment Quality Trend

🟡 Practitioner observation: Comments with substantive length correlate with higher reach. Not paper-verified.

```
COMMENT_QUALITY_TREND:

- Average comment length over last 30 days
- Distribution: substantive (15+ words) vs perfunctory ("Great!")
- Comment-to-reaction ratio (1 comment per 5 reactions = healthy)

Trend direction:
- Improving: avg length increasing month-over-month
- Stable: consistent quality
- Declining: decreasing quality (red flag)
```

### 8.3.5 Sub-Analysis E: Behavioral Pattern Detection

This sub-analysis identifies patterns over time:

```
PATTERNS DETECTED:

A. Niche Drift Detection
   - Is the user's engagement gradually shifting topics?
   - Could indicate conscious pivot OR signal dilution
   
B. Engagement Burst/Drought Pattern
   - Heavy engagement followed by silence (spam pattern flag)
   - Consistent rhythm vs erratic

C. Response Reciprocity
   - Are people who engage with the user being engaged back?
   - Reciprocity ratio over time

D. Off-Niche Concentration
   - Is off-niche engagement clustered (bad days) or spread?
   - Clustered = recoverable; spread = chronic dilution
```

### 8.3.6 Sub-Analysis F: Predicted Behavioral Classification

🟢 Synthesizing all above: what does 360Brew likely conclude about this user from their behavior?

**Classifications:**

```
BEHAVIORAL CLASSIFICATIONS:

A. STRONG NICHE OPERATOR (90-100)
   - 80%+ niche coherence
   - Substantive comment patterns
   - Reciprocal engagement
   - Predicted boost in niche matching

B. CLEAR NICHE PARTICIPANT (75-89)
   - 60-79% niche coherence  
   - Mixed comment quality
   - Reasonable reciprocity
   - Predicted neutral to slight boost

C. SCATTERED PROFESSIONAL (50-74)
   - 40-59% niche coherence
   - Inconsistent quality
   - Mixed signals
   - Predicted slight penalty

D. DILUTED SIGNAL (0-49)
   - <40% niche coherence
   - Poor comment quality
   - Off-topic dominance
   - Predicted significant penalty

For job seekers specifically:

A. ACTIVE SENIOR JOB SEEKER (90-100)
   - 80%+ niche, 60%+ senior, 30%+ target companies
   - Behavioral pattern signals readiness
   
B. LATENT SENIOR PROSPECT (75-89)
   - Good niche, mixed senior signals
   - Could trigger inbound but not actively visible

C. PASSIVE SENIOR (50-74)
   - Niche-aligned but no senior signaling
   - Won't surface for senior role matching

D. WRONG-LEVEL SIGNALING (0-49)
   - Niche-aligned but junior-level engagement
   - Active negative signal for senior matches
```

## 8.4 The Behavior Analyzer Prompt

```
═══════════════════════════════════════════════════════════
BEHAVIOR ANALYZER PROMPT v1.0
═══════════════════════════════════════════════════════════

You are an expert analyst applying the 360Brew paper methodology 
(arXiv 2501.16450) to evaluate a LinkedIn user's interaction 
history pattern.

CONTEXT FROM THE PAPER:
The 360Brew model verbalizes user interaction history as text and 
feeds it as LLM context. The paper proves (Figure 4) that more 
history improves predictions, and (Figure 7) that the model adapts 
to behavior shifts over time.

CRITICAL: For job recommendations (Table 1 of paper), the model 
weights historical activity at 70% and profile match at 30%. This 
makes behavior the dominant signal for job matching.

EVALUATION PRINCIPLES:

1. BEHAVIOR IS HALF THE SIGNAL (or more)
   - For Growth: behavior shapes who sees user's content
   - For Job: 70% of match weight comes from behavior

2. COHERENCE BEATS VOLUME
   - 30 in-niche actions > 100 random actions
   - The model classifies based on patterns, not counts

3. ADAPTATION TAKES TIME
   - Per Figure 7, niche pivots are recoverable but require 
     60-90 days of consistent new behavior

USER CONTEXT:
Declared niche: {{niche}}
Career goal: {{career_goal}}
Years of experience: {{years_experience}}
Target companies (if job seeking): {{target_companies}}
Target role titles (if job seeking): {{target_roles}}

BEHAVIOR LOG TO ANALYZE:
Total actions logged: {{total_actions}}
Date range: {{start_date}} to {{end_date}}

ACTION BREAKDOWN:
{{#each actions}}
- {{action_type}} on {{target_classification}} content 
  ({{date}}, {{notes}})
{{/each}}

COMMENT SAMPLE (last 10):
{{#each recent_comments}}
- "{{text}}" ({{length}} words, on {{topic}})
{{/each}}

ANALYSIS TASKS:

Perform six sub-analyses:

SUB-ANALYSIS A: NICHE COHERENCE RATIO
Formula: (in-niche actions / total actions) × 100
Provide:
- Calculated ratio
- Classification (Strong/Mixed/Diluted)
- Trend over time (if data spans 30+ days)
- Specific examples of dilution

SUB-ANALYSIS B: SENIOR SIGNAL RATIO (only if career_goal includes Job Seeking)
Formula: (senior content actions / in-niche actions) × 100
Provide:
- Calculated ratio
- Classification
- Specific examples

SUB-ANALYSIS C: TARGET COMPANY ENGAGEMENT (only for Job Seekers)
Formula: (target company actions / senior actions) × 100
Provide:
- Calculated ratio
- Companies most/least engaged
- Recommendations for next 30 days

SUB-ANALYSIS D: COMMENT QUALITY TREND
- Average comment length
- Distribution (substantive vs perfunctory)
- Comment-to-reaction ratio
- Trend direction

SUB-ANALYSIS E: BEHAVIORAL PATTERN DETECTION
Identify:
- Niche drift patterns
- Engagement burst/drought patterns
- Response reciprocity
- Off-niche concentration patterns

SUB-ANALYSIS F: PREDICTED BEHAVIORAL CLASSIFICATION
Synthesize: based on the verbalized history, what would 360Brew 
likely conclude about this user?

Provide:
- Classification tier (Strong Niche Operator / Clear Niche 
  Participant / Scattered / Diluted)
- For Job Seekers: additional Job Seeker classification
- Reasoning grounded in paper mechanics
- 30-day reset protocol if signal is diluted

OUTPUT FORMAT:

{
  "analysis_metadata": {...},
  "ratios": {
    "niche_coherence": 0,
    "senior_signal": 0,
    "target_company_engagement": 0
  },
  "comment_analysis": {...},
  "patterns_detected": [...],
  "behavioral_classification": {...},
  "30_day_reset_protocol": [...],
  "weekly_action_recommendations": [...],
  "paper_grounded_disclaimer": "..."
}

Tag every recommendation with confidence level (🟢/🟡/🔴).
Ground all major claims in paper-verified mechanics.
Be specific. No generic advice.
```

## 8.5 Output Specifications

The Behavior Analyzer produces:

1. **Behavior Health Dashboard**
   - Niche coherence ratio with trend line
   - Senior signal ratio (if applicable)
   - Target company engagement (if applicable)
   - Visual: spider/radar chart of behavioral dimensions

2. **Pattern Insights**
   - Identified patterns with severity tags
   - Cluster analysis (good days vs bad days)
   - Reciprocity analysis

3. **30-Day Reset Protocol** (if signal is diluted)
   - Daily action targets
   - Specific people/topics to engage with
   - Things to STOP engaging with

4. **Weekly Maintenance Plan**
   - Sustained discipline checklist
   - Red flags to watch for

---
# PRD Part 3: Modules 3, 4, 5

---

# 9. MODULE 3: CONTENT ANALYZER (PRE-PUBLISH)

## 9.1 Purpose

🟢 **Paper foundation:** Per Equation 1, when 360Brew evaluates a candidate post for a viewer, it computes:

```
P(post | task, member profile, member interaction history)
```

The post being evaluated must align with:
1. The user's verbalized profile (their declared identity)
2. The user's verbalized history (their demonstrated behavior)
3. The viewer's profile and history (audience match)

**Module 3 evaluates dimensions 1 and 2** before the user publishes—catching coherence problems, hook weaknesses, and signal dilutions in advance.

## 9.2 Inputs Required

### 9.2.1 Mandatory Inputs

```
USER PROVIDES:
- Draft post text (full body)
- Intended format (text, multi-image, carousel, video, document)
- Intended publish day/time
- Intended hook archetype (optional, can be detected)
```

### 9.2.2 Inputs From Other Modules

The Content Analyzer pulls data from:

```
- Profile Analyzer output (latest classification + niche pillars)
- Behavior Analyzer output (current niche coherence + signal strength)
- Historical Posts Database (last 10-30 posts with performance)
- Hook Archetype Library (12 archetypes from our framework)
```

## 9.3 Analysis Logic

The Content Analyzer runs **eight sub-analyses**:

### 9.3.1 Sub-Analysis A: Hook Detection & Strength

🟡 The "first 2 lines drive see-more click" claim is practitioner-observed but not paper-verified. We treat it as 🟡 throughout.

**Detection logic:**

```
HOOK DETECTION:

1. Extract first 2 lines (or first 220 characters)
2. Detect archetype from our 12-archetype library:
   - Specific Number 🟢
   - Years-Earned Insight 🟡
   - Receipts Reveal 🟢
   - Pattern Interrupt 🟡
   - Open Loop 🟡
   - Counter-Intuitive Truth 🟡
   - Confessional 🟡
   - Contrarian Stand 🟡
   - "I Was Wrong" Pivot 🟡
   - Numbered Promise 🟡
   - "Steal This" Offer 🟡
   - Diagnostic Question 🟡

3. Score hook strength on:
   - Curiosity Generation (1-10)
   - Specificity (1-10)
   - Topic Clarity (1-10)
   - Differentiation (1-10)
```

### 9.3.2 Sub-Analysis B: Profile-Content Coherence

🟢 **Paper foundation:** This is the most important sub-analysis. The paper's mathematical formulation requires content to align with the verbalized profile for high ranking.

```
COHERENCE EVALUATION:

1. TOPIC MATCH (1-10)
   - Does this post's topic match the user's declared pillars?
   - Or does it drift to off-niche territory?

2. EXPERTISE LEVEL MATCH (1-10)
   - Does the technical depth match the user's claimed seniority?
   - Junior content from senior profile = mismatch
   - Senior content from junior profile = aspirational stretch

3. VOICE CONSISTENCY (1-10)
   - Does the writing style match the profile's voice?
   - Or does it sound like generic LinkedIn-speak?

4. CREDIBILITY ANCHORING (1-10)
   - Does the post leverage the user's profile credentials?
   - Or are claims unsupported by profile?
```

### 9.3.3 Sub-Analysis C: Behavior-Content Coherence

🟢 **Paper foundation:** The model uses interaction history to find audiences. If the user posts about something they've never engaged with, the model has weak signal to find matching audiences.

```
BEHAVIOR ALIGNMENT:

1. TOPIC FAMILIARITY (1-10)
   - Has the user been engaging with similar content in the last 30 days?
   - High familiarity = strong audience routing

2. AUDIENCE PRE-WARMING (1-10)
   - Have similar topics gotten the user engagement before?
   - If user has never posted on X but suddenly does, 
     audience routing is weaker
```

### 9.3.4 Sub-Analysis D: Format Optimization

```
FORMAT EVALUATION:

1. FORMAT-CONTENT MATCH (1-10)
   - Carousel for frameworks/lists ✅
   - Long-form for detailed stories ✅
   - Video for demonstrations ✅
   - Single image for stand-alone visuals ⚠️

2. LENGTH OPTIMIZATION (1-10)
   - Short text (<800 chars): only for punchy hot takes
   - Medium text (800-1300 chars): default for most posts
   - Long-form (1300-2500 chars): for substantive content
   - Very long (2500+): for comprehensive deep-dives

3. CTA STRENGTH (1-10)
   - Specific question that invites real responses
   - Or generic "Thoughts?" CTA
```

### 9.3.5 Sub-Analysis E: Save-Trigger Element Detection

🟡 **Practitioner observation (not paper-verified):** Saves are reported as the highest-weight engagement signal.

```
SAVE-TRIGGER ELEMENTS:

Detect presence of:
- Frameworks (named, structured)
- Numbered lists (5 things, 7 principles, etc.)
- Checklists
- Templates (paste-ready snippets)
- Diagrams/visualizations
- Specific data the reader might want to reference

Score saveability: 1-10
```

### 9.3.6 Sub-Analysis F: Reach Killer Detection

🟡 **Practitioner-observed reach killers:**

```
RED FLAGS (each subtracts from predicted reach):

1. External link in body (-60% reach)
2. "Link in first comment" workaround (still penalized)
3. Engagement bait phrases ("Comment YES if you agree")
4. Generic AI-generated tone (suspected detection)
5. Mass tagging (>5 people)
6. Re-engagement requests within post
7. Misleading hook (hook promises X, body delivers Y)
8. Excessive hashtags (>3)
9. Formatting issues (broken line breaks, weird symbols)
10. Repeated archetype (same as last 3 posts)

Each detected = severity flag with specific fix
```

### 9.3.7 Sub-Analysis G: Variety Check

🟢 **Paper foundation:** The paper proves the model uses long context (up to 88K tokens). Repetitive content patterns get classified as formulaic.

```
VARIETY EVALUATION:

Compare draft to last 5-10 published posts:
- Hook archetype repetition
- Topic repetition (within pillar variation is OK)
- Format repetition
- Tone repetition

Score variety: 1-10
Flag if same pattern 3+ times in row
```

### 9.3.8 Sub-Analysis H: Performance Prediction

The synthesis: based on all above, predict likely performance.

```
PERFORMANCE PREDICTION:

Inputs combined:
- Profile classification (from Module 1)
- Behavior signal strength (from Module 2)
- Content coherence scores (from this module)
- Historical post performance baseline

Output:
- Predicted impression range (low / mid / high)
- Predicted save rate
- Predicted comment quality
- Confidence interval (high/medium/low)

⚠️ Predictions are directional, not precise
```

## 9.4 The Content Analyzer Prompt

```
═══════════════════════════════════════════════════════════
CONTENT ANALYZER PROMPT v1.0
═══════════════════════════════════════════════════════════

You are an expert analyst applying the 360Brew paper methodology 
(arXiv 2501.16450) to evaluate a draft LinkedIn post BEFORE the 
user publishes it.

CONTEXT FROM THE PAPER:
360Brew evaluates posts with this formulation:

P(post | task, member profile, member interaction history)

The post must align with both:
1. The user's verbalized profile (declared identity)
2. The user's verbalized history (demonstrated behavior)

When these align, the model has clear signals for audience routing.
When they don't, the model struggles to find matching viewers.

USER CONTEXT:
Declared niche: {{niche}}
Profile classification (from Module 1): {{profile_tier}}
Behavioral signal strength (from Module 2): {{behavior_tier}}
Niche coherence ratio: {{niche_coherence}}%

CONTENT PILLARS (from profile):
{{#each pillars}}
- {{pillar_name}}: {{pillar_description}}
{{/each}}

RECENT POST HISTORY (last 5 posts):
{{#each recent_posts}}
Post {{@index}}: 
- Topic: {{topic}}
- Format: {{format}}
- Hook archetype: {{archetype}}
- Performance: {{performance}}
{{/each}}

DRAFT POST TO ANALYZE:

{{draft_post_text}}

INTENDED FORMAT: {{format}}
INTENDED PUBLISH TIME: {{publish_datetime}}

ANALYSIS TASKS:

Perform eight sub-analyses:

SUB-ANALYSIS A: HOOK DETECTION & STRENGTH
- Extract first 2 lines / 220 characters
- Detect hook archetype from 12-archetype library
- Score curiosity generation, specificity, topic clarity, differentiation
- Provide 3 alternative hooks if strength <7

SUB-ANALYSIS B: PROFILE-CONTENT COHERENCE
- Topic match score (1-10)
- Expertise level match score
- Voice consistency score
- Credibility anchoring score
- Identify any drift from declared niche

SUB-ANALYSIS C: BEHAVIOR-CONTENT COHERENCE
- Topic familiarity score (based on recent engagement)
- Audience pre-warming score
- Flag if user is suddenly posting on topics they've never engaged with

SUB-ANALYSIS D: FORMAT OPTIMIZATION
- Format-content match
- Length optimization
- CTA strength
- Recommend format changes if mismatched

SUB-ANALYSIS E: SAVE-TRIGGER ELEMENT DETECTION
- Identify saveable elements
- Score saveability
- Suggest additions if score <5

SUB-ANALYSIS F: REACH KILLER DETECTION
- Run through 10-point red flag checklist
- Flag every detected issue
- Provide specific fix for each

SUB-ANALYSIS G: VARIETY CHECK
- Compare to last 5-10 posts
- Flag repetition (archetype, topic, format)
- Suggest variation if needed

SUB-ANALYSIS H: PERFORMANCE PREDICTION
- Synthesize all above
- Predict impression range
- Predict save/comment likelihood
- Provide confidence interval

DELIVERABLES:

1. Composite Quality Score (0-100)
2. Top 5 issues (severity-ranked)
3. Specific edit suggestions (paste-ready)
4. Predicted performance range with confidence
5. Decision recommendation: 
   - Post as is (score 80+)
   - Edit then post (score 60-79)
   - Significant rework needed (score 40-59)
   - Do not post / save for later (score <40)

OUTPUT FORMAT (JSON):

{
  "draft_analysis_metadata": {...},
  "hook_analysis": {
    "detected_archetype": "...",
    "scores": {...},
    "alternatives": [...]
  },
  "coherence_analysis": {
    "profile_coherence": {...},
    "behavior_coherence": {...}
  },
  "format_analysis": {...},
  "saveability_analysis": {...},
  "reach_killers_detected": [...],
  "variety_analysis": {...},
  "performance_prediction": {
    "impression_range": "...",
    "save_likelihood": "...",
    "comment_quality_prediction": "...",
    "confidence": "..."
  },
  "composite_quality_score": 0,
  "decision_recommendation": "...",
  "edit_suggestions": [...],
  "paper_grounded_disclaimer": "..."
}

Tag every recommendation with confidence level.
Ground major claims in paper mechanics.
Be specific. No generic feedback.
```

## 9.5 Output Specifications

The Content Analyzer produces:

1. **Quality Score Card**
   - Composite score: 0-100
   - 8 sub-scores
   - Decision: Post / Edit / Rework / Save for Later

2. **Issue Detection**
   - Reach killers found
   - Coherence problems
   - Variety repetition flags

3. **Hook Variations** (if hook is weak)
   - 3 alternative hooks
   - Each with archetype + rationale

4. **Edit Suggestions**
   - Specific paste-ready edits
   - Why each suggestion improves the post

5. **Performance Prediction**
   - Impression range with confidence
   - Save/comment likelihood
   - Comparison to user's average performance

---

# 10. MODULE 4: COMPARATIVE INTELLIGENCE

## 10.1 Purpose

🟡 The paper doesn't directly address peer comparison, but it implies it. The model classifies users into latent categories based on profile + behavior. Users in the same niche have similar classifications, and the model knows this.

**Module 4 helps users understand their position relative to peers in their declared niche.** This isn't competitive analysis—it's calibration.

## 10.2 Inputs Required

### 10.2.1 Peer Identification

```
PEER IDENTIFICATION INPUTS:

1. User's declared niche
2. User's seniority level
3. User's geography
4. User's career goal

OPTIONAL:
- Specific peer profiles to compare against
- Industry leaders to benchmark
```

### 10.2.2 Public Data Collection

🚨 **ToS-compliant only.** We use:
- Publicly visible LinkedIn profiles (user manually adds peer URLs)
- Publicly available metrics (followers, post frequency)
- Public posts from peers (manually shared by user)

No scraping. No automation. User manually adds peers to compare against.

## 10.3 Analysis Logic

### 10.3.1 Sub-Analysis A: Profile Tier Comparison

```
COMPARISON DIMENSIONS:

1. Headline strength (vs. peer average)
2. About section depth (vs. peer average)
3. Experience description quality
4. Skills coverage
5. Recommendations count
6. Featured section usage

For each dimension:
- User's score
- Peer median score
- Peer top quartile score
- Gap analysis
```

### 10.3.2 Sub-Analysis B: Content Strategy Comparison

```
CONTENT STRATEGY COMPARISON:

1. Posting frequency (posts/week)
2. Format mix (carousel %, video %, text %)
3. Average engagement rate
4. Topic coverage (pillar variety)
5. Hook archetype variety
6. Average post length

User's stats vs:
- Peer median
- Top performers in niche
```

### 10.3.3 Sub-Analysis C: Behavioral Pattern Comparison

```
BEHAVIORAL COMPARISON:

1. Engagement frequency
2. Comment-to-reaction ratio
3. Network composition
4. Connection quality

User's stats vs peer benchmark
```

### 10.3.4 Sub-Analysis D: Gap Analysis

Synthesize the above:

```
GAP ANALYSIS OUTPUT:

GAPS WHERE USER LEADS:
- [Areas where user outperforms peer median]

GAPS WHERE USER LAGS:
- [Areas where user underperforms]
- Severity of each gap
- Specific actions to close gap

NEUTRAL ZONES:
- [Areas where user is at peer median]
```

## 10.4 The Comparative Intelligence Prompt

```
═══════════════════════════════════════════════════════════
COMPARATIVE INTELLIGENCE PROMPT v1.0
═══════════════════════════════════════════════════════════

You are an expert analyst comparing a LinkedIn user's profile 
and behavior against peers in their declared niche.

CONTEXT:
The 360Brew model classifies users into latent categories based 
on profile + behavior. Users in similar niches with similar 
classifications compete for similar audience attention.

This analysis isn't about competition—it's about calibration. 
Help the user understand:
- Where they're already strong vs niche peers
- Where they have specific gaps
- What it would take to elevate their classification

USER CONTEXT:
Niche: {{niche}}
Seniority: {{seniority}}
Geography: {{geography}}
Career goal: {{career_goal}}

USER'S CURRENT STATE (from Modules 1 & 2):
Profile classification: {{profile_tier}}
Behavior classification: {{behavior_tier}}
Profile composite score: {{profile_score}}
Behavior composite score: {{behavior_score}}

PEER PROFILES TO COMPARE AGAINST:
{{#each peers}}
PEER {{@index}}: {{name}}
- Headline: {{headline}}
- Followers: {{followers}}
- Niche: {{niche}}
- Seniority: {{seniority}}
{{/each}}

ANALYSIS TASKS:

1. PROFILE TIER COMPARISON
   For each dimension, estimate where user falls:
   - Bottom 25%
   - 25th-50th percentile
   - 50th-75th percentile  
   - Top 25%
   
   Dimensions:
   - Headline strength
   - About section depth
   - Experience description quality
   - Skills coverage
   - Recommendations count
   - Featured section usage

2. CONTENT STRATEGY COMPARISON
   Compare user's content patterns to peers:
   - Posting frequency vs peer median
   - Format mix differences
   - Topic coverage breadth/depth
   - Hook archetype variety

3. BEHAVIORAL PATTERN COMPARISON
   Estimate user's behavioral standing:
   - Engagement quality vs peer norms
   - Network strategic vs random
   - Comment substantive vs perfunctory

4. GAP ANALYSIS
   Provide:
   - Top 3 areas where user leads
   - Top 3 areas where user lags (with specific gaps)
   - Estimated time/effort to close each gap
   - Specific 30/60/90 day actions

5. CLASSIFICATION TRAJECTORY
   Estimate:
   - Current 360Brew classification tier
   - Realistic next tier with consistent execution
   - Time required for tier progression

OUTPUT FORMAT (JSON):

{
  "comparison_metadata": {...},
  "profile_comparison": {
    "dimensions": {...},
    "overall_percentile": "..."
  },
  "content_comparison": {...},
  "behavior_comparison": {...},
  "gap_analysis": {
    "user_leads": [...],
    "user_lags": [...],
    "neutral_zones": [...]
  },
  "trajectory": {
    "current_tier": "...",
    "next_tier_target": "...",
    "estimated_timeline": "..."
  },
  "paper_grounded_disclaimer": "..."
}

⚠️ Note: We cannot scrape peer data. Analysis is based on 
publicly visible profile information user has shared.

Tag confidence levels.
Ground in paper mechanics where possible.
```

## 10.5 Output Specifications

The Comparative Intelligence module produces:

1. **Percentile Visualization**
   - User's position across 6-8 dimensions
   - Visual: bar chart with peer ranges

2. **Gap Analysis**
   - Top 3 strengths (areas user leads)
   - Top 3 weaknesses (areas user lags)
   - Specific actions to close each gap

3. **Trajectory Estimate**
   - Current tier + projected next tier
   - Realistic timeline

4. **Peer Insights**
   - What top performers in niche do differently
   - Adoptable patterns (with confidence levels)

---

# 11. MODULE 5: REPORTING & RECOMMENDATIONS

## 11.1 Purpose

Modules 1-4 produce point-in-time analyses. Module 5 provides:
- **Time-series tracking** of user's algorithmic positioning
- **Progress measurement** against baseline
- **Recommendation orchestration** across modules
- **Habit formation** through scheduled audits

## 11.2 Reporting Cadence

### 11.2.1 Daily Reports

**The Daily Mission Report** (sent each morning):

```
Good morning, {{user_name}}!

📊 YESTERDAY'S BEHAVIOR:
- Total LinkedIn actions logged: {{count}}
- Niche coherence: {{percentage}}%
- Senior signal: {{percentage}}% (if Job Seeker)

🎯 TODAY'S MISSION:
- Engagement targets: {{target_count}} actions
  - Suggested topics: {{topics}}
  - Suggested people: {{people}}
- Content target: {{post_today_yes_no}}
  - Suggested topic: {{topic}}
  - Suggested format: {{format}}

⚠️ ALERTS:
{{any_red_flags_today}}

🔥 STREAK: {{streak_count}} days of niche-disciplined behavior
```

### 11.2.2 Weekly Reports

**The Weekly Performance Report** (sent each Saturday):

```
Week {{week_number}} Performance Report

📈 METRICS THIS WEEK:
- Profile views: {{count}} ({{change_vs_last_week}})
- Search appearances: {{count}}
- Post impressions total: {{count}}
- New followers: {{count}}
- New connections: {{count}}

🎯 BEHAVIOR ANALYSIS:
- Niche coherence: {{percentage}}%
- Total LinkedIn actions: {{count}}
- Average comment length: {{words}}
- Reciprocity ratio: {{percentage}}%

📝 CONTENT ANALYSIS:
- Posts this week: {{count}}
- Best post: {{title}} ({{performance}})
- Worst post: {{title}} ({{performance}})
- Hook archetype variety check: {{pass_fail}}

🚨 RED FLAGS:
{{any_concerning_patterns}}

🎯 NEXT WEEK FOCUS:
{{1-2 specific recommendations}}
```

### 11.2.3 Monthly Reports

**The Monthly Audit Report** (sent at month end):

```
Month {{month_name}} Comprehensive Audit

🎯 ALGORITHMIC POSITIONING:
- Profile classification trend: {{trend_arrow}}
- Behavior classification trend: {{trend_arrow}}
- Composite score change: {{number}}

📊 GROWTH METRICS:
- Followers: {{start}} → {{end}} ({{percentage}})
- Profile views: {{trend}}
- Search appearances: {{trend}}
- Post impressions: {{trend}}

🎯 CONTENT PERFORMANCE:
- Top 3 posts of month: {{list}}
- Hook archetypes used: {{distribution}}
- Topics covered: {{list_with_pillar_alignment}}

🚨 CRITICAL ISSUES TO ADDRESS:
{{prioritized_list}}

🏆 WINS TO CELEBRATE:
{{list_of_improvements}}

📋 NEXT MONTH PLAN:
{{specific_30_day_action_items}}
```

### 11.2.4 Quarterly Re-Audits

**The Quarterly Deep Dive** (every 90 days):

Complete re-run of Modules 1-4 with comparison to:
- Baseline (initial onboarding)
- Last quarter
- Trend over time

Output: Comprehensive PDF report suitable for sharing.

## 11.3 Recommendation Engine

### 11.3.1 Prioritization Algorithm

When all modules have produced recommendations, the system prioritizes:

```
PRIORITY SCORE = (Impact × Confidence × Urgency) / Effort

WHERE:
- Impact: 1-10 (how much will this move the needle?)
- Confidence: 1-10 (how certain are we of the impact?)
- Urgency: 1-10 (how time-sensitive?)
- Effort: 1-10 (how much work to implement?)

Each recommendation gets a score.
Top 5 recommendations surface first.
```

### 11.3.2 Recommendation Types

```
RECOMMENDATION CATEGORIES:

1. PROFILE FIXES (One-time)
   - Headline rewrite
   - About section updates
   - Skills additions/removals
   - Recommendation requests
   
2. BEHAVIORAL CHANGES (Ongoing)
   - Daily engagement targets
   - Topics to engage with
   - People to engage with
   - Habits to break

3. CONTENT STRATEGY (Recurring)
   - Topics to cover next
   - Hook archetypes to try
   - Formats to experiment with
   
4. NETWORK STRATEGY (Periodic)
   - Connection requests to send
   - Recruiters to outreach
   - Hiring managers to warm up
   
5. STRATEGIC PIVOTS (Rare)
   - Niche refinement
   - Career direction shifts
   - Major positioning updates
```

## 11.4 The Master Reporting Prompt

```
═══════════════════════════════════════════════════════════
MASTER REPORTING PROMPT v1.0
═══════════════════════════════════════════════════════════

You are synthesizing analyses from all four 360Brew analyzer 
modules into a unified report for a LinkedIn user.

INPUT DATA:

PROFILE ANALYSIS (Module 1):
{{profile_analysis_json}}

BEHAVIOR ANALYSIS (Module 2):
{{behavior_analysis_json}}

CONTENT ANALYSIS (Module 3, last 30 days of posts):
{{content_analyses_json}}

COMPARATIVE INTELLIGENCE (Module 4):
{{comparative_analysis_json}}

PREVIOUS REPORT (for trend analysis):
{{previous_report_json}}

REPORTING TASK:

1. SYNTHESIZE INSIGHTS
   - Connect findings across modules
   - Identify themes (e.g., "profile says senior but behavior is junior")
   - Surface highest-leverage opportunities

2. PRIORITIZE RECOMMENDATIONS
   Use formula: (Impact × Confidence × Urgency) / Effort
   - Top 5 actions THIS WEEK
   - Top 5 actions THIS MONTH
   - Strategic considerations

3. TRACK PROGRESS
   Compared to baseline:
   - What's improved?
   - What's regressed?
   - What's stable?

4. PROJECT FUTURE STATE
   With current trajectory:
   - 30 days: realistic expectations
   - 60 days: realistic expectations
   - 90 days: realistic expectations
   
   With recommended actions:
   - Different projection if user executes plan

5. CELEBRATE WINS
   Don't be all critique. Surface genuine improvements.

OUTPUT FORMAT:

Comprehensive report in markdown with:
- Executive summary (3 paragraphs)
- Key insights (5-7 bullets)
- Priority actions table (top 10)
- Progress tracking section
- Future projections
- Wins celebration
- Disclaimer block

Tag confidence levels throughout.
Be honest about limitations.
Ground major claims in paper mechanics.
```

---
# PRD Part 4: Technical Architecture & Specifications

---

# 12. TECHNICAL ARCHITECTURE

## 12.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ CLIENTS (Web / Mobile / Internal Ops Tools)            │
│ - Collect user inputs                                   │
│ - Render analysis + reports                             │
└─────────────────────────────────────────────────────────┘
                          ↓
                    HTTPS (TLS 1.3)
                          ↓
┌─────────────────────────────────────────────────────────┐
│ API LAYER (Node.js / TypeScript)                       │
│ - Input validation + schema enforcement                │
│ - Orchestration of Modules 1-5                         │
│ - Prompt passport trace per module                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ WORKER / SCHEDULER LAYER                               │
│ - Daily/weekly/monthly report jobs                     │
│ - Quarterly deep re-audit jobs                         │
│ - Retry/backoff for LLM calls                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ DATA LAYER: MongoDB                                     │
│ - users, profiles, behavior_logs, content_drafts       │
│ - analyses_profile / behavior / content / comparative  │
│ - reports_daily / weekly / monthly / quarterly         │
│ - prompt_registry / prompt_passports / audit_traces    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ EXTERNAL LLM APIs                                       │
│ - Profile Analysis                                      │
│ - Behavior Analysis                                     │
│ - Content Analysis                                      │
│ - Comparative Intelligence                              │
│ - Master Reporting                                      │
└─────────────────────────────────────────────────────────┘
```

## 12.2 Technology Stack

### 12.2.1 Application Layer

```
PRIMARY:
- Node.js 20.x
- TypeScript
- Fastify or Express

KEY MODULES:
- Zod/JSON schema validation
- Module orchestrator (M1→M5 flows)
- Prompt passport tracing
- Report composition engine
```

### 12.2.2 Backend

```
PLATFORM: Cloud VM / Container runtime

CORE SERVICES:
- API service (sync requests)
- Worker service (async/scheduled jobs)
- Queue service (BullMQ/SQS/RabbitMQ equivalent)
- Object storage (reports/PDF artifacts, optional)

RUNTIME:
- Node.js 20.x
- TypeScript
- OpenAI/Anthropic-compatible SDK adapter
- MongoDB Node driver or Mongoose
- Redis (optional cache + queues)
```

### 12.2.3 AI/ML

```
PRIMARY LLM: Claude / GPT-compatible model endpoint
- Profile, Behavior, Content, Comparative, Master Reporting prompts
- Fallback model for low-cost retries

PROMPT ENGINEERING:
- Version-controlled prompt files in repo + prompt registry in MongoDB
- Prompt passport per layer (path + version + hash)
- Output validation layer (JSON schema enforcement)
```

### 12.2.4 Analytics & Monitoring

```
ANALYTICS:
- Product analytics (Mixpanel/PostHog)
- Module-level latency and success metrics

ERROR MONITORING:
- Sentry (API + worker)

PERFORMANCE:
- Structured logs (JSON)
- Trace IDs across module flows
- MongoDB slow query monitoring
```

## 12.3 Data Flow Architecture

### 12.3.1 Profile Analysis Flow

```
1. USER ACTION:
   User/client submits profile dataset payload
   
2. CLIENT VALIDATION:
   API validates schema + required fields
   
3. STORE INPUT TO MONGODB:
   Save to users/profile_inputs collection
   
4. TRIGGER ORCHESTRATION:
   API starts Module 1 pipeline
   
5. CLAUDE API CALL:
   Orchestrator:
   a. Loads profile data from MongoDB
   b. Loads user context (niche, goal, etc.)
   c. Loads prompt path + version + hash (passport)
   d. Constructs full prompt
   e. Calls model API with prompt
   f. Validates response JSON
   
6. STORE RESULTS:
   Analysis saved to analyses_profile collection
   
7. RETURN TO CLIENT:
   API returns analysis ID + status
   
8. CLIENT FETCHES & RENDERS:
   Client loads analysis via API and renders report
```

### 12.3.2 Behavior Analysis Flow

```
1. ONGOING DATA COLLECTION:
   User logs LinkedIn actions throughout day
   Each action saved to behavior_logs collection
   
2. SCHEDULED ANALYSIS (Daily/Weekly):
   Scheduler triggers Module 2 run at configured cadence
   
3. AGGREGATION:
   Worker aggregates last 30-50 days behavior window
   
4. MODEL CALL OR DETERMINISTIC FLOW:
   Uses behavior prompt + formula checks with prompt passport
   
5. STORE & NOTIFY:
   Save to analyses_behavior + enqueue alerts/report jobs
```

### 12.3.3 Content Analysis Flow (Real-Time)

```
1. USER PASTES DRAFT:
   Client submits draft post + intended format/time
   
2. PRE-ANALYSIS LOADING:
   Load latest profile + behavior analyses + historical posts
   
3. CLAUDE API CALL:
   Run Module 3 sub-analyses A-H with content prompt passport
   
4. RENDER LIVE:
   Return score card + edit suggestions for iteration
   
5. USER DECISION:
   - Edit and re-analyze (additional API calls)
   - Accept and save to /users/{userId}/posts
   - Discard
```

## 12.4 Scalability Considerations

### 12.4.1 Cost Management

```
CLAUDE API COSTS (Approximate):

Profile Analysis:
- Tokens: ~5,000 input + 3,000 output = 8,000 total
- Cost per analysis: ~$0.10 (Sonnet)
- 1,000 users × 4 analyses/year = $400/year

Behavior Analysis:
- Tokens: ~3,000 input + 2,000 output = 5,000 total
- Cost per analysis: ~$0.06
- 1,000 users × 12 analyses/year = $720/year

Content Analysis:
- Tokens: ~4,000 input + 2,500 output = 6,500 total
- Cost per analysis: ~$0.08
- 1,000 users × 50 analyses/year = $4,000/year

Comparative + Reporting:
- Cost per: ~$0.15
- 1,000 users × 10/year = $1,500/year

TOTAL: ~$6,620/year for 1,000 users
PER USER: ~$6.62/year ($0.55/month)

At $25/user/month subscription = strong margin
```

### 12.4.2 Rate Limiting

```
API RATE LIMITING:
- Anthropic API: ~5 requests/second per key
- Use queue system (Cloud Tasks) for bulk operations
- Per-user limits: 50 analyses/day max

USER QUOTA TIERS:
- Free: 1 profile analysis, 5 content analyses/month
- Pro ($25/mo): Unlimited within reason
- Team ($50/mo): Multi-user (up to 10)
- Coach ($150/mo): Multi-client (up to 50)
```

### 12.4.3 Caching Strategy

```
CACHE LAYERS:

1. Profile Analysis Cache (TTL: 30 days)
   - Major profile changes invalidate cache
   - Re-analyze if user requests fresh

2. Behavior Analysis Cache (TTL: 1 day)
   - Daily refresh
   - On-demand refresh available

3. Content Analysis (No cache)
   - Each draft analyzed fresh
   - But profile/behavior context cached

4. Comparative Data (TTL: 7 days)
   - Peer comparisons updated weekly
```

---

# 13. DATA MODELS

## 13.1 Firestore Collections

### 13.1.1 Users Collection

```typescript
// /users/{userId}
interface User {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  
  // Profile context
  context: {
    niche: string;
    careerGoal: 'growth' | 'job' | 'both';
    geography: string;
    yearsExperience: number;
    targetAudience: string;
    targetCompanies?: string[];
    targetRoles?: string[];
    opsecLevel?: 'low' | 'medium' | 'high';
  };
  
  // Subscription
  subscription: {
    tier: 'free' | 'pro' | 'team' | 'coach';
    startedAt: Timestamp;
    renewsAt?: Timestamp;
  };
  
  // Settings
  settings: {
    notificationsEnabled: boolean;
    timezone: string;
    dailyReportEnabled: boolean;
    weeklyReportEnabled: boolean;
  };
  
  // Stats summary
  stats: {
    profileAnalysesRun: number;
    behaviorEntriesLogged: number;
    contentAnalysesRun: number;
    lastActiveAt: Timestamp;
  };
}
```

### 13.1.2 Profile Sub-Collection

```typescript
// /users/{userId}/profile/current
interface ProfileData {
  headline: string;
  about: string;
  experiences: Experience[];
  skills: string[];
  education: Education[];
  certifications: Certification[];
  recommendations: Recommendation[];
  featured: FeaturedItem[];
  
  lastUpdatedAt: Timestamp;
  version: number;
}

interface Experience {
  title: string;
  company: string;
  duration: string; // "Jan 2024 - Present"
  description: string;
  skillsTagged: string[];
}

interface Education {
  institution: string;
  degree: string;
  duration: string;
}

interface Certification {
  name: string;
  issuer: string;
  issuedDate: string;
  expiresDate?: string;
}

interface Recommendation {
  fromName: string;
  fromTitle?: string;
  fromCompany?: string;
  text: string;
  receivedDate: Timestamp;
}

interface FeaturedItem {
  type: 'post' | 'article' | 'link' | 'media';
  title: string;
  description?: string;
  url?: string;
  publishedDate?: Timestamp;
}
```

### 13.1.3 Behavior Logs Sub-Collection

```typescript
// /users/{userId}/behaviors/{actionId}
interface BehaviorAction {
  actionId: string;
  timestamp: Timestamp;
  
  actionType: 
    | 'reaction' 
    | 'comment' 
    | 'share' 
    | 'profile_view' 
    | 'connection_request_sent' 
    | 'connection_request_accepted' 
    | 'job_view' 
    | 'job_save' 
    | 'job_application' 
    | 'search' 
    | 'company_followed' 
    | 'post_saved';
  
  classification: 
    | 'in_niche' 
    | 'adjacent_niche' 
    | 'off_niche' 
    | 'senior_content' 
    | 'junior_content' 
    | 'target_company' 
    | 'hiring_manager';
  
  metadata: {
    targetPersonName?: string;
    targetCompany?: string;
    commentText?: string;
    commentLength?: number;
    notes?: string;
    topicTags?: string[];
  };
}
```

### 13.1.4 Posts Sub-Collection

```typescript
// /users/{userId}/posts/{postId}
interface Post {
  postId: string;
  
  draft: {
    text: string;
    createdAt: Timestamp;
    lastModifiedAt: Timestamp;
    analyses: ContentAnalysis[]; // Multiple analyses if user iterates
  };
  
  publishStatus: 'draft' | 'published' | 'discarded';
  
  published?: {
    publishedAt: Timestamp;
    format: 'text' | 'multi_image' | 'carousel' | 'video' | 'document';
    hookArchetype?: string;
    pillar?: string;
    
    performance: {
      impressions?: number;
      reactions?: number;
      comments?: number;
      saves?: number;
      shares?: number;
      lastUpdatedAt: Timestamp;
    };
  };
}
```

### 13.1.5 Analyses Sub-Collection

```typescript
// /users/{userId}/analyses/{analysisId}
interface Analysis {
  analysisId: string;
  
  type: 'profile' | 'behavior' | 'content' | 'comparative' | 'master_report';
  
  createdAt: Timestamp;
  
  // The full Claude response
  results: {
    metadata: object;
    scores: object;
    issues: Issue[];
    recommendations: Recommendation[];
    classification: string;
    confidence_disclaimer: string;
  };
  
  // The prompt version used (for reproducibility)
  promptVersion: string;
  modelUsed: string; // e.g., "claude-sonnet-4-5"
  
  // Cost tracking
  tokens: {
    input: number;
    output: number;
    estimatedCost: number;
  };
}

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: '🟢' | '🟡' | '🔴';
  description: string;
  fix: string;
  paperGrounded: boolean;
}

interface Recommendation {
  priority: number;
  category: string;
  action: string;
  rationale: string;
  estimatedImpact: string;
  estimatedEffort: string;
  confidence: '🟢' | '🟡' | '🔴';
}
```

### 13.1.6 Reports Sub-Collection

```typescript
// /users/{userId}/reports/{reportId}
interface Report {
  reportId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  generatedAt: Timestamp;
  
  // Period covered
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  
  // Synthesized findings
  content: {
    executiveSummary: string;
    keyInsights: string[];
    priorityActions: Action[];
    progressTracking: ProgressItem[];
    futureProjections: object;
    winsToCelebrate: string[];
  };
  
  // PDF reference
  pdfUrl?: string;
  
  // Read status
  readByUser: boolean;
}
```

### 13.1.7 Peers Sub-Collection (For Comparative Intelligence)

```typescript
// /users/{userId}/peers/{peerId}
interface Peer {
  peerId: string;
  addedAt: Timestamp;
  
  publicData: {
    name: string;
    headline: string;
    company?: string;
    role?: string;
    followersCount?: number;
    profileUrl: string;
  };
  
  category: 'mega_influencer' | 'peer_level' | 'industry_leader' | 'competitor';
  notes?: string;
}
```

### 13.1.8 Prompts Collection (Versioned)

```typescript
// /prompts/{promptType}/versions/{version}
interface PromptTemplate {
  promptType: 'profile' | 'behavior' | 'content' | 'comparative' | 'reporting';
  version: string; // e.g., "1.0", "1.1"
  
  template: string; // The actual prompt with {{variables}}
  
  variables: string[]; // List of variable names
  
  metadata: {
    createdAt: Timestamp;
    createdBy: string;
    description: string;
    isActive: boolean;
    
    // Performance tracking
    avgInputTokens?: number;
    avgOutputTokens?: number;
    avgUserSatisfaction?: number;
  };
}
```

## 13.2 Indexes Required

```
COMPOSITE INDEXES:

1. /users/{userId}/behaviors:
   - timestamp DESC
   - actionType ASC + timestamp DESC
   - classification ASC + timestamp DESC

2. /users/{userId}/posts:
   - draft.createdAt DESC
   - publishStatus ASC + published.publishedAt DESC

3. /users/{userId}/analyses:
   - type ASC + createdAt DESC

4. /users/{userId}/reports:
   - type ASC + generatedAt DESC
   - readByUser ASC + generatedAt DESC
```

---

# 14. API SPECIFICATIONS

## 14.1 Cloud Functions Endpoints

### 14.1.1 Authentication

All endpoints require Firebase ID token in `Authorization: Bearer {token}` header.

### 14.1.2 Profile Analysis Endpoint

```
POST /api/analyzeProfile

REQUEST BODY:
{
  "profileData": {
    "headline": "...",
    "about": "...",
    "experiences": [...],
    "skills": [...],
    ...
  },
  "userContext": {
    "niche": "...",
    "careerGoal": "growth" | "job" | "both",
    ...
  },
  "options": {
    "freshAnalysis": boolean,  // Bypass cache
    "promptVersion": "1.0"      // Optional, defaults to active
  }
}

RESPONSE:
{
  "analysisId": "...",
  "status": "complete" | "queued",
  "results": {
    // Full analysis JSON
  },
  "metadata": {
    "tokensUsed": number,
    "cost": number,
    "modelUsed": "...",
    "completedAt": Timestamp
  }
}

ERRORS:
- 401: Unauthorized
- 403: Quota exceeded
- 429: Rate limited
- 500: Claude API error
- 503: Service temporarily unavailable
```

### 14.1.3 Behavior Logging Endpoint

```
POST /api/logBehavior

REQUEST BODY:
{
  "actions": [
    {
      "actionType": "reaction",
      "classification": "in_niche",
      "timestamp": "...",
      "metadata": {
        "targetPersonName": "...",
        "topicTags": [...]
      }
    }
  ]
}

RESPONSE:
{
  "actionsLogged": number,
  "currentNicheCoherence": number,  // Real-time updated metric
  "alerts": [...]  // Any red flags triggered
}
```

### 14.1.4 Behavior Analysis Endpoint

```
POST /api/analyzeBehavior

REQUEST BODY:
{
  "dateRange": {
    "start": "2026-04-01",
    "end": "2026-05-01"
  },
  "options": {
    "freshAnalysis": boolean
  }
}

RESPONSE:
{
  "analysisId": "...",
  "results": {
    "ratios": {...},
    "patterns": [...],
    "classification": "...",
    "resetProtocol": [...]
  }
}
```

### 14.1.5 Content Analysis Endpoint

```
POST /api/analyzeContent

REQUEST BODY:
{
  "draftText": "...",
  "format": "carousel",
  "intendedPublishTime": "...",
  "options": {
    "iterationOf": "previous_analysis_id"  // For iterative drafting
  }
}

RESPONSE:
{
  "analysisId": "...",
  "results": {
    "compositeScore": number,
    "decision": "post" | "edit" | "rework" | "save",
    "hookAnalysis": {...},
    "coherenceAnalysis": {...},
    "performancePrediction": {...},
    "editSuggestions": [...]
  }
}
```

### 14.1.6 Comparative Analysis Endpoint

```
POST /api/analyzeComparative

REQUEST BODY:
{
  "peerIds": ["peer1", "peer2", ...]
}

RESPONSE:
{
  "analysisId": "...",
  "results": {
    "percentiles": {...},
    "gaps": {...},
    "trajectory": {...}
  }
}
```

### 14.1.7 Report Generation Endpoint

```
POST /api/generateReport

REQUEST BODY:
{
  "reportType": "daily" | "weekly" | "monthly" | "quarterly",
  "options": {
    "includeProfile": boolean,
    "includeBehavior": boolean,
    "includeContent": boolean,
    "includeComparative": boolean,
    "exportFormat": "json" | "pdf"
  }
}

RESPONSE:
{
  "reportId": "...",
  "content": {...},
  "pdfUrl": "..."  // If exportFormat is "pdf"
}
```

### 14.1.8 Scheduled Functions

```
DAILY:
- generateDailyReports() - Runs at 6am user-local
- checkBehaviorAlerts() - Runs every 4 hours
- updatePeerData() - Runs at 2am UTC

WEEKLY:
- generateWeeklyReports() - Runs Saturday 6am user-local
- runComparativeAnalyses() - Runs Sunday 2am UTC

MONTHLY:
- generateMonthlyReports() - Runs 1st of month
- archiveOldData() - Runs 1st of month

QUARTERLY:
- runDeepDiveAudits() - Runs 1st of quarter
```

## 14.2 Rate Limiting & Quotas

```
PER-USER LIMITS:

Free Tier:
- 1 profile analysis/month
- 5 content analyses/month
- 100 behavior log entries/day
- 0 comparative analyses
- Weekly reports only

Pro Tier ($25/mo):
- Unlimited profile analyses (with reasonable use)
- 50 content analyses/month
- Unlimited behavior logging
- 5 comparative analyses/month
- Daily + weekly + monthly reports

Team Tier ($50/mo):
- Pro features × 5 users
- Team dashboards
- Shared peer database

Coach Tier ($150/mo):
- Pro features × 50 client profiles
- White-label reports
- Client management dashboard
```

---

# 15. CLAUDE PROMPT LIBRARY

## 15.1 Prompt Versioning Strategy

All prompts are version-controlled in Firestore (`/prompts` collection). Updates require:

1. New version created (e.g., 1.0 → 1.1)
2. A/B test against current active version (if user base >100)
3. Migration plan if version causes breaking changes
4. Active flag toggled after validation

## 15.2 Master Prompt Engineering Principles

```
PRINCIPLE 1: Ground Every Major Claim
- Every recommendation must trace to either:
  a) Direct paper finding (🟢)
  b) Multiple practitioner sources (🟡)
  c) Speculation explicitly labeled (🔴)

PRINCIPLE 2: Demand Specificity
- Generic advice is useless
- Force specific, paste-ready outputs
- "Improve your headline" → BAD
- "Replace 'Innovation Leader' with 'AI Engineering Leader 
   | 20+ yrs | Founding Member @ Outspark'" → GOOD

PRINCIPLE 3: Honest Limitations
- Always include disclaimer block
- Never claim algorithm certainty
- Acknowledge directional vs literal

PRINCIPLE 4: Structured Outputs
- All responses in valid JSON
- Schema enforced at validation layer
- Fallback handling for malformed responses

PRINCIPLE 5: Confidence Tagging
- Every claim gets 🟢/🟡/🔴
- Forces honesty about evidence strength
- Helps users prioritize high-confidence actions
```

## 15.3 Prompt Files Reference

The complete prompts for each module are documented in Sections 7-11. They will be stored as templates in Firestore with the following structure:

```
/prompts/profile/v1.0
/prompts/behavior/v1.0
/prompts/content/v1.0
/prompts/comparative/v1.0
/prompts/reporting/v1.0
```

Variables are interpolated at runtime using a Mustache-style template engine.

## 15.4 Output Validation

Each Claude response is validated against a JSON schema before being saved:

```typescript
// Example schema for profile analysis
const profileAnalysisSchema = {
  type: "object",
  required: [
    "analysis_metadata",
    "sub_analyses",
    "composite_classification",
    "top_issues",
    "improvement_projection",
    "paper_grounded_disclaimer"
  ],
  properties: {
    analysis_metadata: {
      type: "object",
      required: ["user_context", "analysis_date", "framework_version"]
    },
    sub_analyses: {
      type: "object",
      required: ["headline", "about", "experience", "skills", "recommendations", "featured"]
    },
    composite_classification: {
      type: "object",
      required: ["tier", "score", "reasoning"],
      properties: {
        tier: { 
          type: "string", 
          enum: ["Authority Figure", "Niche Specialist", "Generic Professional", "Confused Signal"] 
        },
        score: { type: "number", minimum: 0, maximum: 100 }
      }
    },
    top_issues: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        required: ["severity", "issue", "fix", "confidence"],
        properties: {
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          confidence: { type: "string", enum: ["🟢", "🟡", "🔴"] }
        }
      }
    }
  }
};
```

If validation fails:
1. Log the validation error
2. Retry with structured output instruction
3. If second retry fails, return graceful error to user
4. Flag prompt for review

---
# PRD Part 5: Confidence System, UI/UX, Roadmap & Operations

---

# 16. CONFIDENCE LEVEL SYSTEM

## 16.1 The Three-Tier System

🟢 **PAPER-VERIFIED** — Direct from 360Brew paper (arXiv 2501.16450) or LinkedIn Engineering blog

🟡 **OBSERVED** — Validated by multiple credible practitioner sources OR derived from paper-verified mechanics

🔴 **SPECULATION** — Common claim with no verified source; surface for transparency, not as guidance

## 16.2 Tagging Rules

### 16.2.1 What Earns 🟢

```
GREEN LABEL CRITERIA:
- Direct quote/paraphrase from 360Brew paper
- Mathematical formula from the paper
- Specific finding from a paper figure
- LinkedIn Engineering blog confirmed claim
- Mechanic explicitly described in paper

EXAMPLES:
🟢 "Profile is verbalized as text and used as LLM input"
🟢 "70% behavior + 30% profile weighting for jobs"
🟢 "More history = better predictions"
🟢 "Cold-start members benefit most"
🟢 "Temporal adaptation works over 60-90 days"
```

### 16.2.2 What Earns 🟡

```
YELLOW LABEL CRITERIA:
- Observation reported by 3+ independent practitioners
- Backed by Buffer/Metricool/Socialinsider data
- Logical inference from paper-verified mechanics
- Common LinkedIn growth wisdom that's at least partially validated

EXAMPLES:
🟡 "Carousels get 6.6% engagement (highest format)"
🟡 "Long-form posts (1300+ chars) outperform short"
🟡 "Saves are stronger signal than likes"
🟡 "Single-image posts have lowest reach"
🟡 "External links in body = -60% reach"
🟡 "First 2 lines drive see-more click"
```

### 16.2.3 What Earns 🔴

```
RED LABEL CRITERIA:
- Single-source claim
- Anecdotal evidence only
- "Something I heard from a LinkedIn coach"
- Specific numbers without backing data
- Survivorship bias generalizations

EXAMPLES:
🔴 "First 2 lines get 3-5x weight" (no source for "3-5x")
🔴 "90-Minute Quality Gate" (not in paper or verified)
🔴 "200 saves = 3.9x impressions" (specific multipliers unsourced)
🔴 "Spam/Low/Good/Expert tier classification" (not in paper)
🔴 "Post at 9 AM Tuesday for best results" (specific timing unsourced)
```

## 16.3 User-Facing Display

Every recommendation, insight, and claim in the app displays its confidence level:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  ISSUE #3 [🟢 HIGH CONFIDENCE]                       │
│  ─────────────────────────                           │
│  Your headline lacks seniority signal                │
│                                                      │
│  Why this matters:                                   │
│  Per the 360Brew paper, profile text is verbalized   │
│  as LLM input. Without seniority indicators,         │
│  recruiters searching for senior roles can't filter  │
│  for you effectively.                                │
│                                                      │
│  Recommended fix:                                    │
│  Add "20+ yrs" or seniority designation              │
│                                                      │
│  Confidence rationale:                               │
│  This recommendation is grounded in:                 │
│  🟢 Paper Section 2.1 (profile as LLM input)        │
│  🟢 Paper Table 1 (job ranking uses profile-job     │
│      relevance for 30% weight)                       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 16.4 Why This System Matters

Without confidence labels:
- All recommendations look equally credible
- Users can't prioritize high-confidence actions
- Speculation gets equal weight to verified mechanics
- Product loses scientific credibility over time

With confidence labels:
- Users execute high-confidence actions first
- Speculation is explicitly flagged as such
- Product earns trust through honesty
- Differentiates from "LinkedIn growth bro" tools

---

# 17. UI/UX SPECIFICATIONS

## 17.1 Information Architecture

```
APP STRUCTURE:

┌──────────────────────────────────────────────────────┐
│  HOME (Today's Mission)                              │
├──────────────────────────────────────────────────────┤
│  PROFILE                                             │
│  ├── Current Profile Data                            │
│  ├── Latest Analysis                                 │
│  ├── Analysis History                                │
│  └── Profile Changes Log                             │
├──────────────────────────────────────────────────────┤
│  BEHAVIOR                                            │
│  ├── Today's Log (quick entry)                       │
│  ├── This Week                                       │
│  ├── Trends                                          │
│  └── Reset Protocols                                 │
├──────────────────────────────────────────────────────┤
│  CONTENT                                             │
│  ├── Drafts (with analyses)                          │
│  ├── Published Posts                                 │
│  ├── New Draft (Pre-Publish Analyzer)                │
│  └── Performance History                             │
├──────────────────────────────────────────────────────┤
│  PEERS                                               │
│  ├── My Peer List                                    │
│  ├── Add Peer                                        │
│  ├── Comparative Analyses                            │
│  └── Niche Benchmarks                                │
├──────────────────────────────────────────────────────┤
│  REPORTS                                             │
│  ├── Daily                                           │
│  ├── Weekly                                          │
│  ├── Monthly                                         │
│  └── Quarterly Deep Dives                            │
├──────────────────────────────────────────────────────┤
│  SETTINGS                                            │
│  ├── Account                                         │
│  ├── Subscription                                    │
│  ├── Notifications                                   │
│  ├── Data Export                                     │
│  └── Help & FAQ                                      │
└──────────────────────────────────────────────────────┘
```

## 17.2 Key Screen Specifications

### 17.2.1 Home Screen (Daily Mission)

```
LAYOUT:

┌──────────────────────────────────────────────────────┐
│  Good morning, {{name}}!                             │
│  Day {{streak}} of niche-disciplined behavior 🔥    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 YESTERDAY'S SNAPSHOT                             │
│  ┌──────────────────────────────────────────────┐   │
│  │ Profile views:    47   ↗ +12                 │   │
│  │ Niche coherence:  85%  ↗ +5%                 │   │
│  │ New followers:    +3                         │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  🎯 TODAY'S MISSION (30 min)                         │
│                                                      │
│  ☐ ENGAGE (15 min)                                  │
│    [Tap to see today's queue of 5 posts to engage]  │
│                                                      │
│  ☐ POST (10 min)                                    │
│    Suggested topic: [Pillar 3] Recent production    │
│    work on AI agents                                │
│    [Tap to start drafting]                          │
│                                                      │
│  ☐ INBOUND (5 min)                                  │
│    🔴 NEW: Recruiter from True Search viewed you    │
│    [Tap to triage]                                  │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📅 WEEKLY PROGRESS                                  │
│  [Visual: line chart showing 7-day metrics]         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 17.2.2 Profile Analysis Screen

```
LAYOUT:

┌──────────────────────────────────────────────────────┐
│  Profile Analysis - {{date}}                         │
│  Run new analysis →                                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🎯 CLASSIFICATION                                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  NICHE SPECIALIST (Score: 78/100)            │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        │   │
│  │  Tier: 2 of 4                                │   │
│  │  Next tier: Authority Figure (90+)           │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  📊 SUB-SCORES (Tap to drill down)                  │
│  Headline ......... 71/100  [Detail]                │
│  About ............ 82/100  [Detail]                │
│  Experience ....... 76/100  [Detail]                │
│  Skills ........... 74/100  [Detail]                │
│  Recommendations .. 65/100  [Detail]                │
│  Featured ......... 88/100  [Detail]                │
│                                                      │
│  🚨 TOP 5 ISSUES                                     │
│  1. [🟢 CRITICAL] Headline lacks seniority signal   │
│     [Fix Now] [Learn More]                          │
│  2. [🟡 HIGH] Recommendations look stale            │
│     [Fix Now] [Learn More]                          │
│  ...                                                 │
│                                                      │
│  🎯 30/60/90 PROJECTION                             │
│  [Visual: projected improvement chart]              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 17.2.3 Behavior Logging Quick Entry

```
LAYOUT (Bottom Sheet, slides up from anywhere):

┌──────────────────────────────────────────────────────┐
│                Log a LinkedIn action                 │
│  ─────────────────────────────────────────           │
│                                                      │
│  Action type:                                        │
│  [Reaction] [Comment] [Share] [View] [Connect]      │
│  [Job View] [Save] [Search] [Follow]                │
│                                                      │
│  Topic:                                              │
│  [In niche] [Adjacent] [Off-niche]                  │
│  [Senior content] [Junior content]                  │
│  [Target company] [Hiring manager]                  │
│                                                      │
│  Optional:                                           │
│  [Person name]                                       │
│  [Company]                                           │
│  [Notes]                                             │
│                                                      │
│  [Cancel]              [Log Action]                 │
└──────────────────────────────────────────────────────┘

DESIGN: Should take <5 seconds to complete. 
Default values pre-selected based on common patterns.
```

### 17.2.4 Content Pre-Publish Analyzer

```
LAYOUT:

┌──────────────────────────────────────────────────────┐
│  Analyze Draft Post                                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ✏️  YOUR DRAFT                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  │  [Editable text area for draft]              │   │
│  │                                              │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Format: [Carousel ▼]                                │
│  Publish time: [Tomorrow 9 AM ▼]                    │
│                                                      │
│  [Analyze Draft]                                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 ANALYSIS RESULTS (after running)                │
│                                                      │
│  Composite Score: 68/100                             │
│  Decision: ⚠️  EDIT THEN POST                       │
│                                                      │
│  ✅ STRENGTHS:                                       │
│  - Strong hook (Specific Number archetype) [🟢]    │
│  - Good profile coherence [🟢]                     │
│  - Saveable framework included [🟡]                │
│                                                      │
│  ⚠️ ISSUES:                                          │
│  1. [🟡] Last 3 posts also used "Specific Number"  │
│     hook. Variety check failed.                     │
│     [Try alternative hook archetypes]               │
│                                                      │
│  2. [🟡] External link in body = -60% reach        │
│     [Move to comments]                              │
│                                                      │
│  📈 PERFORMANCE PREDICTION:                          │
│  Impressions: 800-1,400 (medium confidence)         │
│  Save likelihood: HIGH                               │
│  Comment quality: GOOD                               │
│                                                      │
│  [Edit Draft] [Save for Later] [Post Anyway]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 17.3 Visual Design System

### 17.3.1 Color Palette

```
PRIMARY: #2557A7 (LinkedIn-adjacent blue, but distinct)
ACCENT: #00D4FF (Cyberpunk cyan — for highlights)
DARK: #0A0E27 (For dark mode backgrounds)
LIGHT: #F4F4F4 (For light mode backgrounds)

CONFIDENCE COLORS:
🟢 Green: #1A8754 (Paper-verified)
🟡 Yellow: #FFC107 (Observed)
🔴 Red: #DC3545 (Speculation)

SEMANTIC:
SUCCESS: #1A8754
WARNING: #FFC107  
DANGER: #DC3545
INFO: #0DCAF0
```

### 17.3.2 Typography

```
HEADINGS: SF Pro Display (iOS) / Roboto (Android) / Inter (Web)
BODY: SF Pro Text / Roboto / Inter
MONOSPACE: SF Mono / Roboto Mono / JetBrains Mono

SIZES:
H1: 32pt
H2: 24pt
H3: 20pt
H4: 18pt
Body: 16pt
Small: 14pt
Caption: 12pt
```

### 17.3.3 Component Library

```
KEY COMPONENTS:

1. ScoreCard
   - Large number display
   - Tier badge
   - Trend arrow

2. ConfidenceBadge
   - 🟢/🟡/🔴 with text label
   - Tappable for explanation

3. IssueListItem
   - Severity indicator
   - Confidence badge
   - Description
   - Action button

4. RecommendationCard
   - Category icon
   - Title + description
   - Estimated impact/effort
   - "Mark as Done" toggle

5. MetricChart
   - Line chart
   - Bar chart
   - Spider/Radar (for multi-dimensional)
   - Sparkline (for inline trends)

6. QuickActionFAB
   - Floating action button
   - Quick log behavior entry
   - Quick draft new post

7. ReportContainer
   - Standardized report layout
   - Section navigation
   - PDF export button
```

## 17.4 Accessibility

```
ACCESSIBILITY REQUIREMENTS:

- WCAG 2.1 AA compliance
- Screen reader support (VoiceOver, TalkBack)
- High contrast mode support
- Dynamic text size support
- Keyboard navigation (web)
- Voice input for behavior logging
- Color-blind friendly palettes (don't rely solely on red/green)
- Clear focus states
- Sufficient touch targets (min 44pt)
```

---

# 18. BUILD ROADMAP

## 18.1 Phase 1: MVP (Weeks 1-8)

### Week 1-2: Foundation
- [ ] Firebase project setup
- [ ] Flutter project structure
- [ ] Authentication flow (email + Google)
- [ ] Basic onboarding (user context capture)
- [ ] Firestore data models implementation
- [ ] Cloud Functions skeleton

### Week 3-4: Module 1 (Profile Analyzer)
- [ ] Profile data input UI
- [ ] Profile data Firestore integration
- [ ] Claude API integration via Cloud Functions
- [ ] Profile Analyzer prompt engineering
- [ ] Output validation layer
- [ ] Profile analysis UI rendering
- [ ] Analysis history view

### Week 5-6: Module 2 (Behavior Analyzer)
- [ ] Behavior logging quick-entry UI
- [ ] Behavior data Firestore integration
- [ ] Daily aggregation logic
- [ ] Behavior Analyzer prompt engineering
- [ ] Behavior dashboard UI
- [ ] Trend visualization
- [ ] Reset protocol UI

### Week 7-8: Module 3 (Content Analyzer)
- [ ] Content draft input UI
- [ ] Hook detection logic
- [ ] Content Analyzer prompt engineering
- [ ] Pre-publish analysis flow
- [ ] Edit suggestions UI
- [ ] Performance prediction display
- [ ] Polish + bug fixes

### Phase 1 Deliverables:
✅ Working Flutter app on iOS, Android, Web
✅ Three core analyzers operational
✅ Personal use ready (single-user mode)
✅ Basic auth + data security
✅ Cloud Functions deployed
✅ ~1000 lines of test coverage

## 18.2 Phase 2: Enhancement (Weeks 9-12)

### Week 9-10: Module 4 (Comparative Intelligence)
- [ ] Peer management UI
- [ ] Public profile data input
- [ ] Comparative analysis prompt
- [ ] Comparative dashboard

### Week 11-12: Module 5 (Reporting)
- [ ] Daily report generation
- [ ] Weekly report generation
- [ ] Monthly report generation
- [ ] PDF export functionality
- [ ] Push notifications
- [ ] Email delivery option

### Phase 2 Deliverables:
✅ All five modules operational
✅ Time-series tracking
✅ Automated reporting
✅ Multi-format export

## 18.3 Phase 3: Productization (Weeks 13-20)

### Week 13-14: Multi-User Foundation
- [ ] User tiers (Free, Pro, Team, Coach)
- [ ] Quota enforcement
- [ ] Stripe billing integration
- [ ] Subscription management UI

### Week 15-16: Marketing Site
- [ ] Landing page
- [ ] Documentation site
- [ ] Pricing page
- [ ] Sign-up funnel

### Week 17-18: Coach Tier Features
- [ ] Multi-client dashboard
- [ ] White-label reports
- [ ] Client management

### Week 19-20: Launch Preparation
- [ ] Beta user onboarding
- [ ] Bug bash
- [ ] Performance optimization
- [ ] Support documentation
- [ ] Public launch

### Phase 3 Deliverables:
✅ Full SaaS product
✅ Subscription billing
✅ Coach tier
✅ Marketing site
✅ Public launch ready

## 18.4 Resource Plan

```
TEAM REQUIRED:

Phase 1 (MVP):
- 1 Senior Flutter Developer (full-time, 8 weeks)
- 1 AI/Prompt Engineer (part-time, 4 weeks)
- 1 UI/UX Designer (part-time, 6 weeks)
- 1 Product Manager (part-time, 8 weeks - you)

Estimated cost: $30,000-$50,000

Phase 2 (Enhancement):
- Continue Flutter dev (full-time, 4 weeks)
- AI engineer (part-time, 2 weeks)
- Designer (part-time, 2 weeks)

Estimated cost: $15,000-$25,000

Phase 3 (Productization):
- Flutter dev (full-time, 8 weeks)
- Backend dev (part-time, 4 weeks)
- Marketing/content (full-time, 4 weeks)
- Designer (part-time, 4 weeks)

Estimated cost: $40,000-$80,000

GRAND TOTAL (MVP through public launch): $85,000-$155,000
```

---

# 19. QUALITY ASSURANCE

## 19.1 Testing Strategy

### 19.1.1 Unit Tests

```
COVERAGE TARGETS:

- Cloud Functions: 80%+
- Critical UI components: 70%+
- Data models: 90%+
- Validation logic: 100%
```

### 19.1.2 Integration Tests

```
KEY FLOWS TO TEST:

1. Profile Analysis End-to-End
   - User submits profile → Cloud Function called → 
     Claude API called → Result validated → UI rendered

2. Behavior Logging
   - User logs action → Stored → Aggregated → 
     Trends updated

3. Content Analysis
   - Draft submitted → All context loaded → 
     Analysis returned → UI displays results
```

### 19.1.3 Prompt Quality Tests

```
PROMPT VALIDATION:

For each prompt version:
1. Generate baseline test cases (10-20 example inputs)
2. Run Claude API with each
3. Manually validate output quality
4. Compare to previous version
5. Track regression metrics

PROMPT METRICS:
- Output adherence to JSON schema (target: 99%+)
- Recommendation actionability (manual review)
- Confidence tag accuracy (manual review)
- User satisfaction scores
```

### 19.1.4 User Acceptance Testing

```
UAT PHASES:

Alpha (5 users): Internal team
- Find critical bugs
- Validate basic flows

Beta (50 users): Vinay's network
- Test real-world usage
- Gather satisfaction data
- Identify missing features

Public Beta (500 users): Open registration
- Stress test infrastructure
- Validate pricing
- Refine onboarding
```

## 19.2 Monitoring & Observability

```
METRICS TRACKED:

1. Cloud Function Performance
   - Average execution time
   - p99 latency
   - Error rate
   - Cold start frequency

2. Claude API
   - Tokens used per call
   - Cost per analysis
   - Retry rates
   - Rate limit hits

3. User Engagement
   - DAU/MAU
   - Session length
   - Feature usage distribution
   - Onboarding completion rate

4. Business Metrics
   - Conversion rate (free → pro)
   - Churn rate
   - LTV
   - CAC

ALERTS:
- Error rate >5% → PagerDuty
- API costs >$X/day → Email
- User satisfaction <4.0 → Slack
```

---

# 20. PRIVACY, SECURITY & COMPLIANCE

## 20.1 Data Privacy

### 20.1.1 What We Collect

```
USER DATA COLLECTED:

REQUIRED:
- Email address (for auth)
- LinkedIn profile data (user-provided)
- Behavior log entries (user-provided)
- Content drafts (user-created)

OPTIONAL:
- Display name
- Phone number (for SMS notifications)
- Peer profile URLs (user-shared)

WE DO NOT COLLECT:
- LinkedIn passwords
- Direct messages
- Private connection details
- Payment info (handled by Stripe)
```

### 20.1.2 What We Don't Do

🚨 **NEVER:**
- Scrape LinkedIn
- Automate any LinkedIn actions
- Share user data with third parties (except Claude API for analysis)
- Sell user data
- Access user LinkedIn accounts directly

## 20.2 Security Measures

```
SECURITY LAYERS:

1. AUTHENTICATION
   - Firebase Auth (industry-standard)
   - Optional 2FA
   - Session token rotation

2. DATA ENCRYPTION
   - At rest: Firebase default AES-256
   - In transit: TLS 1.3
   - PII encryption: Additional layer for sensitive fields

3. ACCESS CONTROL
   - Firestore security rules
   - User can only access their own data
   - Cloud Function-level authorization

4. API KEY SECURITY
   - Anthropic API key in Firebase Functions config
   - Never exposed to client
   - Rotation every 90 days

5. AUDIT LOGGING
   - All data access logged
   - Retention: 1 year
```

## 20.3 LinkedIn ToS Compliance

🚨 **CRITICAL: This product must NEVER violate LinkedIn ToS.**

```
COMPLIANCE COMMITMENTS:

✅ DO:
- Accept user-provided data only
- Help users make informed decisions
- Provide analytical insights
- Support manual workflows

❌ DO NOT:
- Scrape LinkedIn profiles
- Automate likes, comments, connections
- Send messages on user's behalf
- Bulk extract LinkedIn data
- Use LinkedIn's API beyond approved use
- Maintain persistent LinkedIn sessions
```

## 20.4 GDPR / Privacy Compliance

```
PRIVACY RIGHTS SUPPORTED:

1. RIGHT TO ACCESS
   - User can download all their data anytime
   - Provided in JSON format

2. RIGHT TO DELETION  
   - User can delete account
   - All data removed within 30 days
   - Backups purged within 90 days

3. RIGHT TO PORTABILITY
   - Export feature provides all user data

4. RIGHT TO CORRECTION
   - User can edit any data they've entered

5. CONSENT MANAGEMENT
   - Clear opt-ins for analytics
   - Granular notification preferences
```

---

# 21. SUCCESS METRICS

## 21.1 Product Metrics

### 21.1.1 Engagement Metrics

```
DAILY ACTIVE USERS (DAU):
- Target Phase 1: 10 (alpha users daily)
- Target Phase 2: 50 (beta users daily)
- Target Phase 3 (6 mo post-launch): 1,000

FEATURE USAGE:
- Profile analyses run/user/quarter: Target 1+
- Behavior logs/user/day: Target 5+
- Content analyses/user/month: Target 8+
- Reports viewed/user/week: Target 1+
```

### 21.1.2 Quality Metrics

```
USER SATISFACTION:
- NPS: Target 50+
- App Store rating: Target 4.5+
- Recommendation accuracy (user feedback): Target 80%+

OUTPUT QUALITY:
- Prompt adherence to schema: 99%+
- Manual quality review pass rate: 90%+
- Confidence tag accuracy: 95%+
```

### 21.1.3 Business Metrics

```
REVENUE METRICS (Phase 3+):
- Free → Pro conversion: Target 5-10%
- Pro → Team upgrade: Target 2-3%
- Monthly churn: Target <5%
- LTV: Target $300+
- CAC: Target <$50

GROWTH METRICS:
- Organic signups/month: Target 500+ (Year 1)
- Paid customers (12 mo): Target 1,000+
- ARR (12 mo): Target $300K+
```

## 21.2 User Outcome Metrics

The ultimate measure of product value: **Do users actually grow on LinkedIn?**

```
USER OUTCOME TRACKING:

PER USER (60-day cohort):
- Followers growth: Target 30%+ improvement
- Profile views growth: Target 50%+ improvement  
- Recruiter inbound (Job seekers): Target 5x increase
- Post engagement rate: Target 20%+ improvement

ATTRIBUTION:
- Connect product usage to outcomes
- Survey users at 30/60/90 days
- Case studies from successful users
```

---

# 22. RISK REGISTER

## 22.1 Technical Risks

```
RISK 1: Claude API Outages
Likelihood: Medium
Impact: High
Mitigation: 
- Fallback to Claude Haiku for non-critical analyses
- Queue system for retries
- User-facing graceful degradation

RISK 2: Prompt Quality Drift
Likelihood: Medium
Impact: Medium
Mitigation:
- Version control all prompts
- A/B test changes
- Monthly quality reviews
- Automated regression tests

RISK 3: Cost Overruns
Likelihood: Medium
Impact: Medium
Mitigation:
- Per-user quotas enforced
- Real-time cost monitoring
- Pricing tiers with usage caps
- Caching aggressive
```

## 22.2 Business Risks

```
RISK 4: LinkedIn Algorithm Changes
Likelihood: HIGH
Impact: HIGH
Mitigation:
- Monitor LinkedIn Engineering blog
- Build framework for prompt updates
- Communicate changes transparently to users
- Position as "research-grounded" not "guaranteed"

RISK 5: LinkedIn Changes ToS
Likelihood: Low
Impact: Medium
Mitigation:
- Already 100% ToS-compliant (no automation)
- Stay informed on policy changes
- Have legal counsel review

RISK 6: Competitive Response
Likelihood: Medium
Impact: Medium
Mitigation:
- Move fast on features
- Build network effects (peer comparisons)
- Strong content moat (the methodology IS marketing)
```

## 22.3 Reputational Risks

```
RISK 7: Misleading Predictions
Likelihood: Medium
Impact: HIGH
Mitigation:
- Always show confidence levels
- Mandatory disclaimers
- "Directional, not literal" language
- Manage user expectations explicitly

RISK 8: AI Slop Reputation
Likelihood: Medium
Impact: Medium
Mitigation:
- High-quality prompt engineering
- Manual review of edge cases
- User feedback loops
- Iterate based on results

RISK 9: Privacy Concerns
Likelihood: Low
Impact: HIGH
Mitigation:
- Industry-standard security
- Clear privacy policy
- Easy data export/deletion
- No third-party data sharing
```

---

# 23. OPEN QUESTIONS

These are questions to resolve during development:

## 23.1 Product Questions

```
Q1: Should we build a Chrome extension companion?
- Pros: Easier behavior logging
- Cons: Maintenance overhead, ToS edge cases
- DECISION NEEDED: Phase 2

Q2: Should we offer team-wide analytics?
- Pros: Higher tier revenue
- Cons: Complexity, privacy implications
- DECISION NEEDED: Phase 3

Q3: White-label option for coaches?
- Pros: B2B revenue stream
- Cons: Custom branding overhead
- DECISION NEEDED: Phase 3
```

## 23.2 Technical Questions

```
Q4: Self-hosted Claude alternative?
- Should we offer enterprise customers self-hosted option?
- DECISION NEEDED: Year 2

Q5: Mobile-first vs cross-platform?
- Flutter handles both, but UX differs
- DECISION NEEDED: Phase 1 design

Q6: Real-time collaboration?
- Should team users see each other's analyses?
- DECISION NEEDED: Phase 3
```

## 23.3 Business Questions

```
Q7: Pricing model — subscription vs credit-based?
- Subscription: Predictable, simpler
- Credits: Pay-per-analysis, more flexible
- DECISION NEEDED: Phase 3

Q8: Free tier strategy?
- How much value to give free users?
- DECISION NEEDED: Phase 3

Q9: Geographic markets?
- Start US/India, expand to UK/Europe?
- DECISION NEEDED: Phase 3
```

---

# APPENDIX A: PAPER FOUNDATIONS QUICK REFERENCE

For developers and AI engineers, here's a quick reference of the paper findings driving each module's logic:

```
PROFILE ANALYZER GROUNDING:
🟢 Equation 1, Section 2.1 — Profile is verbalized as text
🟢 Section 2.1 — "u represents the member profile as text"

BEHAVIOR ANALYZER GROUNDING:
🟢 Equation 1, Section 2.1 — Interaction history is verbalized
🟢 Figure 4 — More history = better predictions
🟢 Figure 7 — Temporal adaptation works
🟢 Table 1 — 70% behavior + 30% profile for jobs

CONTENT ANALYZER GROUNDING:
🟢 Equation 2, Section 2.1 — Ranking is conditional on member + history + task
🟢 Section 2.1 — Many-shot in-context learning principle

COMPARATIVE INTELLIGENCE GROUNDING:
🟡 Implicit from many-shot ICL principle (peer signals inform)

REPORTING GROUNDING:
🟢 Figure 7 — Time-based adaptation
🟢 Figure 6 — Cold-start advantage
```

---

# APPENDIX B: GLOSSARY

```
360Brew — LinkedIn's 150B parameter decoder-only LLM 
  for ranking and recommendations

Decoder-only model — LLM architecture optimized for 
  generative tasks (next-token prediction)

Many-shot In-Context Learning (ICL) — Using user's 
  history as in-context examples for personalized prediction

Niche Coherence Ratio — % of user's actions in 
  their declared niche

Verbalization — Converting structured data 
  (profile, behavior) into text for LLM input

Cold-Start — User with few interactions; 360Brew 
  performs especially well here

Retrieval Layer — First stage of recommendation 
  (narrows from millions to ~2,000 candidates)

Ranking Layer — Second stage where 360Brew operates 
  (ranks ~2,000 candidates with high precision)
```

---

# APPENDIX C: PAPER EXCERPT REFERENCE

For verification, here's the exact paper Equation 1 reference:

> *"In any recommendation task, each member, with their unique profile and history of interactions, can be viewed as a many-shot problem. Consequently, when the ranking model is conditioned on the member's profile and interaction history, it can identify and generalize patterns that are highly personalized for that member, extending these patterns to future interactions."*

> *"P(m, (e₁, i₁), ..., (eₙ₋₁, iₙ₋₁), (eₙ, iₙ)) where u represents the member profile as text, and (eⱼ, iⱼ), j=1,...,N are the set of historical items and interactions encoded as text for member m."*

This is Equation 1 from Section 2.1 of arXiv 2501.16450, the foundation for our entire analyzer logic.

---

**END OF PRD**

Document version 1.0 - May 2026
Total pages: ~75 (when formatted)
Total word count: ~25,000

For questions or clarifications, reference the conversation thread that produced this document.
